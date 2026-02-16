export type StickerFontPreset = 'handwritten' | 'normal' | 'code';

export const STICKER_FONT_FAMILIES: Record<StickerFontPreset, string> = {
    handwritten: '"Virgil", "HanziPen SC", "Cangnanshoujiti", "KaiTi", "Segoe UI Emoji"',
    normal: '"Helvetica", "Segoe UI Emoji"',
    code: '"Cascadia", "Segoe UI Emoji"',
};

export const DEFAULT_STICKER_FONT_PRESET: StickerFontPreset = 'handwritten';

export const resolveStickerFontFamily = (preset?: StickerFontPreset): string | undefined => {
    if (!preset) return undefined;
    return STICKER_FONT_FAMILIES[preset];
};

export const isStickerFontPreset = (value: unknown): value is StickerFontPreset => {
    return value === 'handwritten' || value === 'normal' || value === 'code';
};
