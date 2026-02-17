import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDockUI } from '../../context/DockContext';
import { useZenShelf } from '../../context/ZenShelfContext';
import { Sticker, IMAGE_MAX_WIDTH } from '../../types';
import { compressStickerImage } from '../../utils/imageCompression';
import { copyBlobToClipboard, createImageStickerImage, createTextStickerImage, downloadBlob, imageToBlob } from '../../utils/canvasUtils';
import { db } from '../../utils/db';
import { resolveStickerPosition, updateStickerPercentCoordinates } from '../../utils/stickerCoordinates';
import { StickerItem } from './StickerItem';
import { TextInput } from './TextInput';
import { ContextMenu } from './ContextMenu';
import { RecycleBin } from './RecycleBin';
import { RecycleBinModal } from './RecycleBinModal';
import { type StickerFontPreset } from '../../constants/stickerFonts';
import styles from './ZenShelf.module.css';

const UI_ZONE_SELECTOR = '[data-ui-zone]';


// ============================================================================
// ZenShelf 主组件
// ============================================================================

interface ZenShelfProps {
    onOpenSettings?: (position: { x: number; y: number }) => void;
}

export const ZenShelf: React.FC<ZenShelfProps> = ({ onOpenSettings }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { stickers, selectedStickerId, addSticker, updateSticker, deleteSticker, selectSticker, bringToTop } = useZenShelf();
    const { isEditMode, setIsEditMode } = useDockUI();

    const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        type: 'background' | 'sticker';
        stickerId?: string;
    } | null>(null);

    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

    const [viewport, setViewport] = useState(() => ({
        width: Math.max(window.innerWidth, 1),
        height: Math.max(window.innerHeight, 1),
    }));

    // 处理窗口调整大小以实现响应式贴纸布局
    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: Math.max(window.innerWidth, 1),
                height: Math.max(window.innerHeight, 1),
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [editingSticker, setEditingSticker] = useState<Sticker | null>(null);
    const [isAnyDragging, setIsAnyDragging] = useState(false);

    const runtimeStickers = stickers.map((sticker) => ({
        ...sticker,
        ...resolveStickerPosition(sticker, viewport),
    }));

    const resolveImageStickerContent = useCallback(async (sticker: Sticker): Promise<string | null> => {
        if (sticker.type !== 'image') return null;
        if (sticker.content) return sticker.content;
        if (!sticker.assetId) return null;

        const asset = await db.getStickerAsset(sticker.assetId);
        return asset?.data || null;
    }, []);

    const handleStickerDragStart = useCallback(() => {
        setIsAnyDragging(true);
    }, []);

    const handleStickerDragEnd = useCallback(() => {
        setIsAnyDragging(false);
    }, []);

    // 上下文菜单的全局右键处理程序
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // 不在 UI 元素上显示
            if (target.closest(UI_ZONE_SELECTOR)) {
                return;
            }

            // 事件委托优化: 使用 data-sticker-id 属性检测贴纸
            const stickerEl = target.closest('[data-sticker-id]') as HTMLElement;
            if (stickerEl) {
                e.preventDefault();
                const stickerId = stickerEl.dataset.stickerId;
                if (stickerId) {
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'sticker',
                        stickerId,
                    });
                }
                return;
            }

            // 在背景上右键单击
            e.preventDefault();
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'background',
            });
        };

        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    // 双击背景以快速添加贴纸
    useEffect(() => {
        const handleDoubleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            if (target.closest(UI_ZONE_SELECTOR)) {
                return;
            }

            // 事件委托优化: 使用 data-sticker-id 属性检测贴纸
            if (target.closest('[data-sticker-id]')) {
                return;
            }

            if (textInputPos) {
                return;
            }

            setTextInputPos({ x: e.clientX, y: e.clientY });
        };

        document.addEventListener('dblclick', handleDoubleClick);
        return () => document.removeEventListener('dblclick', handleDoubleClick);
    }, [textInputPos]);

    // 热键：Delete 键删除贴纸
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeElement = document.activeElement;
                // Avoid deleting when typing in input
                if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                    return;
                }

                if (selectedStickerId) {
                    deleteSticker(selectedStickerId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedStickerId, deleteSticker]);

    // 处理图片文件选择
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result as string;
            const compressed = await compressStickerImage(base64);
            const img = new Image();
            img.onload = () => {
                const x = window.innerWidth / 2 - Math.min(img.width, IMAGE_MAX_WIDTH) / 2;
                const y = window.innerHeight / 2 - (img.height * Math.min(img.width, IMAGE_MAX_WIDTH) / img.width) / 2;
                const withPercent = updateStickerPercentCoordinates({
                    id: '',
                    type: 'image',
                    content: compressed,
                    x,
                    y,
                }, viewport);
                addSticker({
                    type: 'image',
                    content: compressed,
                    x: withPercent.x,
                    y: withPercent.y,
                    xPct: withPercent.xPct,
                    yPct: withPercent.yPct,
                });
            };
            img.src = compressed;
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [addSticker, viewport]);

    // 处理文本输入提交
    const handleTextSubmit = useCallback((content: string, style?: { color: string; textAlign: 'left' | 'center' | 'right'; fontSize: number; fontPreset: StickerFontPreset }) => {
        if (editingSticker) {
            updateSticker(editingSticker.id, {
                content,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : editingSticker.style,
            });
        } else if (textInputPos) {
            const withPercent = updateStickerPercentCoordinates({
                id: '',
                type: 'text',
                content,
                x: textInputPos.x,
                y: textInputPos.y,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : undefined,
            }, viewport);
            addSticker({
                type: 'text',
                content,
                x: withPercent.x,
                y: withPercent.y,
                xPct: withPercent.xPct,
                yPct: withPercent.yPct,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : undefined,
            });
        }
        setTextInputPos(null);
        setEditingSticker(null);
    }, [textInputPos, editingSticker, addSticker, updateSticker, viewport]);

    const handleTextCancel = useCallback(() => {
        setTextInputPos(null);
        setEditingSticker(null);
    }, []);

    const handleEditSticker = useCallback((sticker: Sticker) => {
        setEditingSticker(sticker);
        setTextInputPos({ x: sticker.x, y: sticker.y });
    }, []);

    // 处理粘贴 - 添加图片贴纸
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                if (activeElement.closest('[data-ui-zone]')) {
                    return;
                }
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = async () => {
                        const base64 = reader.result as string;
                        const compressed = await compressStickerImage(base64);
                        const img = new Image();
                        img.onload = () => {
                            const x = window.innerWidth / 2 - Math.min(img.width, IMAGE_MAX_WIDTH) / 2;
                            const y = window.innerHeight / 2 - (img.height * Math.min(img.width, IMAGE_MAX_WIDTH) / img.width) / 2;
                            const withPercent = updateStickerPercentCoordinates({
                                id: '',
                                type: 'image',
                                content: compressed,
                                x,
                                y,
                            }, viewport);
                            addSticker({
                                type: 'image',
                                content: compressed,
                                x: withPercent.x,
                                y: withPercent.y,
                                xPct: withPercent.xPct,
                                yPct: withPercent.yPct,
                            });
                        };
                        img.src = compressed;
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [addSticker, viewport]);

    return (
        <div
            ref={canvasRef}
            className={`${styles.canvas} ${isEditMode ? styles.creativeMode : ''} ${isAnyDragging ? styles.dragging : ''}`}
        >
            {runtimeStickers
                .filter((sticker) => !editingSticker || sticker.id !== editingSticker.id)
                .map((sticker) => (
                    <StickerItem
                        key={sticker.id}
                        sticker={sticker}
                        isSelected={selectedStickerId === sticker.id}
                        isCreativeMode={isEditMode}
                        onSelect={() => selectSticker(sticker.id)}
                        onDelete={() => deleteSticker(sticker.id)}
                        onPositionChange={(x, y) => {
                            const next = updateStickerPercentCoordinates({ ...sticker, x, y }, viewport);
                            updateSticker(sticker.id, {
                                x: next.x,
                                y: next.y,
                                xPct: next.xPct,
                                yPct: next.yPct,
                            });
                        }}
                        onStyleChange={(updates) => {
                            if (sticker.style) {
                                updateSticker(sticker.id, { style: { ...sticker.style, ...updates } });
                            }
                        }}
                        onBringToTop={() => bringToTop(sticker.id)}
                        onScaleChange={(scale) => {
                            updateSticker(sticker.id, { scale });
                        }}
                        isEditMode={isEditMode}
                        onDoubleClick={() => {
                            if (sticker.type === 'text') {
                                handleEditSticker(sticker);
                            }
                        }}
                        onDragStart={handleStickerDragStart}
                        onDragEnd={handleStickerDragEnd}
                    />
                ))}

            {textInputPos && (
                <TextInput
                    x={textInputPos.x}
                    y={textInputPos.y}
                    initialText={editingSticker?.content || ''}
                    initialStyle={editingSticker?.style}
                    onSubmit={handleTextSubmit}
                    onCancel={handleTextCancel}
                />
            )}

            <RecycleBin
                isVisible={isAnyDragging}
                onClick={() => setIsRecycleBinOpen(true)}
            />

            <RecycleBinModal
                isOpen={isRecycleBinOpen}
                onClose={() => setIsRecycleBinOpen(false)}
            />

            {/* 上下文菜单 */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    type={contextMenu.type}
                    stickerId={contextMenu.stickerId}
                    isImageSticker={(() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        return sticker?.type === 'image';
                    })()}
                    onClose={() => setContextMenu(null)}
                    onAddSticker={() => {
                        setTextInputPos({ x: contextMenu.x, y: contextMenu.y });
                    }}
                    onUploadImage={() => {
                        fileInputRef.current?.click();
                    }}
                    onToggleEditMode={() => {
                        setIsEditMode(!isEditMode);
                    }}
                    isEditMode={isEditMode}
                    onEditSticker={() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker) {
                            handleEditSticker(sticker);
                        }
                    }}
                    onDeleteSticker={() => {
                        if (contextMenu.stickerId) {
                            deleteSticker(contextMenu.stickerId);
                        }
                    }}
                    onCopyImage={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'image') {
                            try {
                                const source = await resolveImageStickerContent(sticker);
                                if (!source) return;
                                const img = new Image();
                                img.onload = async () => {
                                    const blob = await imageToBlob(img);
                                    if (blob) {
                                        await copyBlobToClipboard(blob);
                                    }
                                };
                                img.src = source;
                            } catch (error) {
                                console.error('Failed to copy image:', error);
                            }
                        }
                    }}
                    onExportImage={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'text') {
                            try {
                                const blob = await createTextStickerImage(sticker);
                                if (blob) {
                                    downloadBlob(blob, `sticker-${Date.now()}.png`);
                                }
                            } catch (error) {
                                console.error('Failed to export sticker:', error);
                            }
                        }
                    }}
                    onCopyText={() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'text') {
                            navigator.clipboard.writeText(sticker.content);
                        }
                    }}
                    onExportImageSticker={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'image') {
                            try {
                                const source = await resolveImageStickerContent(sticker);
                                if (!source) return;

                                const blob = await createImageStickerImage({
                                    ...sticker,
                                    content: source,
                                });
                                if (blob) {
                                    downloadBlob(blob, `sticker-${Date.now()}.png`);
                                }
                            } catch (error) {
                                console.error('Failed to export image sticker:', error);
                            }
                        }
                    }}
                    onOpenSettings={() => {
                        if (contextMenu) {
                            onOpenSettings?.({ x: contextMenu.x, y: contextMenu.y });
                        }
                    }}
                />
            )}

            {/* 用于图片上传的隐藏文件输入框 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </div>
    );
};
