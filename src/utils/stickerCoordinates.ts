import { Sticker } from '../types';

export const LEGACY_REFERENCE_WIDTH = 1920;

export interface ViewportSize {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const normalizeViewport = (viewport: ViewportSize): ViewportSize => ({
  width: Math.max(1, Number.isFinite(viewport.width) ? viewport.width : 1),
  height: Math.max(1, Number.isFinite(viewport.height) ? viewport.height : 1),
});

const toPercent = (value: number, total: number): number => {
  if (!Number.isFinite(value) || total <= 0) return 0;
  return clamp(value / total, 0, 1);
};

export interface ResolvedStickerPosition {
  x: number;
  y: number;
  xPct: number;
  yPct: number;
}

export const resolveStickerPosition = (
  sticker: Sticker,
  viewport: ViewportSize
): ResolvedStickerPosition => {
  const safeViewport = normalizeViewport(viewport);
  const hasPercentCoordinates =
    Number.isFinite(sticker.xPct) && Number.isFinite(sticker.yPct);

  if (hasPercentCoordinates) {
    const xPct = clamp(sticker.xPct as number, 0, 1);
    const yPct = clamp(sticker.yPct as number, 0, 1);
    return {
      x: xPct * safeViewport.width,
      y: yPct * safeViewport.height,
      xPct,
      yPct,
    };
  }

  // Legacy coordinates were stored in a virtual 1920 width coordinate space.
  const legacyX = Number.isFinite(sticker.x) ? sticker.x : 0;
  const legacyY = Number.isFinite(sticker.y) ? sticker.y : 0;
  const xPct = clamp(legacyX / LEGACY_REFERENCE_WIDTH, 0, 1);
  const legacyScreenY = (legacyY * safeViewport.width) / LEGACY_REFERENCE_WIDTH;
  const yPct = toPercent(legacyScreenY, safeViewport.height);

  return {
    x: xPct * safeViewport.width,
    y: yPct * safeViewport.height,
    xPct,
    yPct,
  };
};

export const updateStickerPercentCoordinates = (
  sticker: Sticker,
  viewport: ViewportSize
): Sticker => {
  const safeViewport = normalizeViewport(viewport);
  const x = Number.isFinite(sticker.x) ? sticker.x : 0;
  const y = Number.isFinite(sticker.y) ? sticker.y : 0;

  return {
    ...sticker,
    xPct: toPercent(x, safeViewport.width),
    yPct: toPercent(y, safeViewport.height),
  };
};

export const normalizeStickerCoordinatesForStorage = (
  sticker: Sticker,
  viewport: ViewportSize
): Sticker => {
  const resolved = resolveStickerPosition(sticker, viewport);
  return {
    ...sticker,
    x: resolved.x,
    y: resolved.y,
    xPct: resolved.xPct,
    yPct: resolved.yPct,
  };
};

