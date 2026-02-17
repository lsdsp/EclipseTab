/**
 * 图标压缩工具
 * 用于压缩上传的图标和导入的 Space 中的图标，减少 localStorage 使用
 */

import { DockItem } from '../types';

/** 目标压缩尺寸 - 图标 (192px 足够显示 56px 图标) */
const ICON_TARGET_SIZE = 192;

/** 目标压缩尺寸 - 贴纸图片 (800px 保证高清晰度) */
const STICKER_TARGET_WIDTH = 800;

/** WebP 压缩质量 - 图标 (更高压缩) */
const ICON_COMPRESSION_QUALITY = 0.6;

/** WebP 压缩质量 - 贴纸 (0.85 平衡质量与大小) */
const STICKER_COMPRESSION_QUALITY = 0.85;

// ============================================================================
// 性能优化: 复用单个 Canvas 实例，避免每次压缩都创建 DOM 元素
// ============================================================================

let reusableIconCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let reusableIconCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

interface CompressIconOptions {
    fetchImpl?: typeof fetch;
    blobToDataUrl?: (blob: Blob) => Promise<string>;
}

/**
 * 获取可复用的 Canvas (优先使用 OffscreenCanvas)
 */
function getReusableIconCanvas(width: number, height: number): {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} | null {
    try {
        // 首次使用时创建 Canvas
        if (!reusableIconCanvas) {
            // 优先使用 OffscreenCanvas (不阻塞主线程)
            if (typeof OffscreenCanvas !== 'undefined') {
                reusableIconCanvas = new OffscreenCanvas(width, height);
                reusableIconCtx = reusableIconCanvas.getContext('2d');
            } else {
                if (typeof document === 'undefined') {
                    return null;
                }
                // 回退到普通 Canvas
                reusableIconCanvas = document.createElement('canvas');
                reusableIconCanvas.width = width;
                reusableIconCanvas.height = height;
                reusableIconCtx = reusableIconCanvas.getContext('2d');
            }
        }

        if (!reusableIconCtx) return null;

        // 调整尺寸 (仅在需要时)
        if (reusableIconCanvas.width !== width || reusableIconCanvas.height !== height) {
            reusableIconCanvas.width = width;
            reusableIconCanvas.height = height;
        }

        // 清空画布
        reusableIconCtx.clearRect(0, 0, width, height);

        return { canvas: reusableIconCanvas, ctx: reusableIconCtx };
    } catch {
        return null;
    }
}

const isHttpIconUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
    if (typeof FileReader === 'undefined') {
        return Promise.reject(new Error('FileReader is not available'));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                resolve(result);
                return;
            }
            reject(new Error('Failed to read image blob'));
        };
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(blob);
    });
};

const convertCanvasToDataUrl = async (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    quality: number
): Promise<string | null> => {
    try {
        if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            if (typeof canvas.convertToBlob === 'function') {
                const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
                return await readBlobAsDataUrl(blob);
            }

            if (typeof document === 'undefined') {
                return null;
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                return null;
            }
            tempCtx.drawImage(canvas, 0, 0);
            return tempCanvas.toDataURL('image/webp', quality);
        }

        if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
            return canvas.toDataURL('image/webp', quality);
        }
    } catch {
        return null;
    }

    return null;
};

const compressDataUrlIcon = async (dataUrl: string): Promise<string> => {
    // 如果不是有效的 data URL，直接返回
    if (!dataUrl?.startsWith('data:image')) {
        return dataUrl;
    }

    if (typeof Image === 'undefined') {
        return dataUrl;
    }

    return new Promise((resolve, _reject) => {
        const img = new Image();

        img.onload = async () => {
            try {
                // 计算目标尺寸（保持宽高比，最大边为 ICON_TARGET_SIZE）
                let { width, height } = img;

                // 如果图片已经小于目标尺寸，不需要压缩尺寸，但仍然转换为 WebP 以减小体积
                if (width > ICON_TARGET_SIZE || height > ICON_TARGET_SIZE) {
                    if (width > height) {
                        height = Math.round((height * ICON_TARGET_SIZE) / width);
                        width = ICON_TARGET_SIZE;
                    } else {
                        width = Math.round((width * ICON_TARGET_SIZE) / height);
                        height = ICON_TARGET_SIZE;
                    }
                }

                const canvasData = getReusableIconCanvas(width, height);
                if (!canvasData) {
                    resolve(dataUrl);
                    return;
                }

                const { canvas, ctx } = canvasData;

                // 绘制图片
                ctx.drawImage(img, 0, 0, width, height);

                // 转换为 WebP 格式
                const compressedDataUrl = await convertCanvasToDataUrl(
                    canvas,
                    ICON_COMPRESSION_QUALITY
                );
                if (!compressedDataUrl) {
                    resolve(dataUrl);
                    return;
                }

                // 如果压缩后更大（极少数情况），返回原图
                if (compressedDataUrl.length > dataUrl.length) {
                    resolve(dataUrl);
                } else {
                    resolve(compressedDataUrl);
                }
            } catch (error) {
                console.error('Failed to compress icon:', error);
                resolve(dataUrl); // 出错时返回原图
            }
        };

        img.onerror = () => {
            console.error('Failed to load image for compression');
            resolve(dataUrl); // 加载失败时返回原图
        };

        img.src = dataUrl;
    });
};

/**
 * 压缩图标到指定尺寸 (192x192)
 * 支持 data URL 与网络 URL；网络 URL 会先转成 data URL 再压缩
 * 性能优化: 使用复用的 Canvas 实例
 * @param iconSource 图标来源（data URL 或 http(s) URL）
 * @returns 压缩后的 Base64 图片
 */
export async function compressIcon(
    iconSource: string,
    options: CompressIconOptions = {}
): Promise<string> {
    if (!iconSource) {
        return iconSource;
    }

    if (iconSource.startsWith('data:image')) {
        return compressDataUrlIcon(iconSource);
    }

    if (!isHttpIconUrl(iconSource)) {
        return iconSource;
    }

    const { fetchImpl = fetch, blobToDataUrl = readBlobAsDataUrl } = options;

    try {
        const response = await fetchImpl(iconSource);
        if (!response.ok) {
            return iconSource;
        }

        const iconBlob = await response.blob();
        if (!iconBlob.type.startsWith('image/')) {
            return iconSource;
        }

        const iconDataUrl = await blobToDataUrl(iconBlob);
        if (!iconDataUrl.startsWith('data:image')) {
            return iconSource;
        }

        return await compressDataUrlIcon(iconDataUrl);
    } catch {
        return iconSource;
    }
}

/**
 * 压缩贴纸图片到最大宽度 800px（保持比例）
 * 性能优化: 使用复用的 Canvas 实例
 * @param dataUrl Base64 编码的图片
 * @returns 压缩后的 Base64 图片
 */
export async function compressStickerImage(dataUrl: string): Promise<string> {
    if (!dataUrl?.startsWith('data:image')) {
        return dataUrl;
    }

    if (typeof Image === 'undefined') {
        return dataUrl;
    }

    return new Promise((resolve) => {
        const img = new Image();

        img.onload = async () => {
            try {
                let { width, height } = img;

                // 只有宽度超过目标尺寸时才压缩
                if (width > STICKER_TARGET_WIDTH) {
                    height = Math.round((height * STICKER_TARGET_WIDTH) / width);
                    width = STICKER_TARGET_WIDTH;
                }

                const canvasData = getReusableIconCanvas(width, height);
                if (!canvasData) {
                    resolve(dataUrl);
                    return;
                }

                const { canvas, ctx } = canvasData;
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = await convertCanvasToDataUrl(
                    canvas,
                    STICKER_COMPRESSION_QUALITY
                );
                if (!compressedDataUrl) {
                    resolve(dataUrl);
                    return;
                }

                if (compressedDataUrl.length > dataUrl.length) {
                    resolve(dataUrl);
                } else {
                    resolve(compressedDataUrl);
                }
            } catch (error) {
                console.error('Failed to compress sticker image:', error);
                resolve(dataUrl);
            }
        };

        img.onerror = () => {
            console.error('Failed to load image for sticker compression');
            resolve(dataUrl);
        };

        img.src = dataUrl;
    });
}


/**
 * 递归压缩 DockItem 数组中的所有图标
 * @param items DockItem 数组
 * @returns 压缩图标后的 DockItem 数组
 */
export async function compressIconsInItems(items: DockItem[]): Promise<DockItem[]> {
    return compressIconsInItemsSequential(items, compressIcon);
}

type CompressIconFn = (iconSource: string) => Promise<string>;

export async function compressIconsInItemsSequential(
    items: DockItem[],
    compressIconFn: CompressIconFn
): Promise<DockItem[]> {
    const compressedItems: DockItem[] = [];

    // 串行压缩，避免共享可复用 Canvas 时的并发覆盖问题
    for (const item of items) {
        const compressedItem = { ...item };

        if (compressedItem.icon) {
            compressedItem.icon = await compressIconFn(compressedItem.icon);
        }

        if (compressedItem.type === 'folder' && compressedItem.items) {
            compressedItem.items = await compressIconsInItemsSequential(
                compressedItem.items,
                compressIconFn
            );
        }

        compressedItems.push(compressedItem);
    }

    return compressedItems;
}

/**
 * 估算 Base64 字符串的实际字节大小
 * @param base64 Base64 字符串
 * @returns 估算的字节数
 */
export function estimateBase64Size(base64: string): number {
    if (!base64) return 0;

    // 移除 data URL 前缀
    const base64Data = base64.split(',')[1] || base64;

    // Base64 编码后大小约为原始大小的 4/3
    return Math.ceil((base64Data.length * 3) / 4);
}

/**
 * 格式化字节大小为可读字符串
 * @param bytes 字节数
 * @returns 可读的大小字符串 (如 "1.5 MB")
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
