/**
 * Zen Shelf 贴纸相关类型定义
 */
import { DEFAULT_STICKER_FONT_PRESET, type StickerFontPreset } from '../constants/stickerFonts';

/**
 * 文字贴纸的样式配置
 */
export interface TextStickerStyle {
    color: string;                           // 字体颜色
    textAlign: 'left' | 'center' | 'right';  // 文字对齐
    fontSize: number;                        // 字号大小 (px)
    fontPreset?: StickerFontPreset;          // 字体类型
    maxWidth?: number;                       // 最大宽度限制 (px)
}

export type StickerType = 'text' | 'image' | 'clock' | 'timer' | 'todo' | 'calendar';

/**
 * 贴纸数据结构
 */
export interface Sticker {
    id: string;              // UUID 唯一标识
    type: StickerType;       // 贴纸类型
    content: string;         // 文字内容 或 图片URL（运行时）
    x: number;               // 屏幕 X 坐标 (px)
    y: number;               // 屏幕 Y 坐标 (px)
    xPct?: number;           // X 百分比坐标 (0-1)
    yPct?: number;           // Y 百分比坐标 (0-1)
    assetId?: string;        // 图片贴纸在 IndexedDB 中的资源 ID
    zIndex?: number;         // 层级顺序（双击置顶）
    scale?: number;          // 图片缩放比例（仅图片贴纸）
    groupId?: string;        // 白板分组 ID（可选）
    locked?: boolean;        // 是否锁定（锁定后不可拖拽/编辑）
    style?: TextStickerStyle; // 仅针对文字贴纸的样式
}

/**
 * 创建贴纸时的输入类型（不需要 id，由系统生成）
 */
export type StickerInput = Omit<Sticker, 'id'>;

/**
 * 默认的文字贴纸样式
 */
export const DEFAULT_TEXT_STYLE: TextStickerStyle = {
    color: '#1C1C1E',        // 深色文字
    textAlign: 'left',
    fontSize: 40,
    fontPreset: DEFAULT_STICKER_FONT_PRESET,
};

/**
 * 图片贴纸的最大宽度限制
 */
export const IMAGE_MAX_WIDTH = 400;
