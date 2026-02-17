import { describe, expect, it } from 'vitest';
import { Sticker } from '../types';
import {
  LEGACY_REFERENCE_WIDTH,
  normalizeStickerCoordinatesForStorage,
  resolveStickerPosition,
  updateStickerPercentCoordinates,
} from './stickerCoordinates';

const createTextSticker = (patch: Partial<Sticker> = {}): Sticker => ({
  id: 'sticker-1',
  type: 'text',
  content: 'hello',
  x: 100,
  y: 120,
  ...patch,
});

describe('stickerCoordinates', () => {
  it('resolves legacy coordinates using 1920-width scale', () => {
    const viewport = { width: 1280, height: 720 };
    const legacy = createTextSticker({ x: 960, y: 540 });

    const resolved = resolveStickerPosition(legacy, viewport);

    expect(resolved.xPct).toBeCloseTo(960 / LEGACY_REFERENCE_WIDTH, 6);
    expect(resolved.x).toBeCloseTo(640, 4);
    expect(resolved.y).toBeCloseTo(360, 4);
  });

  it('prefers percentage coordinates when available', () => {
    const viewport = { width: 1600, height: 900 };
    const sticker = createTextSticker({ xPct: 0.25, yPct: 0.4 });

    const resolved = resolveStickerPosition(sticker, viewport);

    expect(resolved.x).toBeCloseTo(400, 4);
    expect(resolved.y).toBeCloseTo(360, 4);
  });

  it('updates percentage coordinates from runtime pixel position', () => {
    const viewport = { width: 1000, height: 500 };
    const sticker = createTextSticker({ x: 250, y: 125 });

    const updated = updateStickerPercentCoordinates(sticker, viewport);

    expect(updated.xPct).toBeCloseTo(0.25, 6);
    expect(updated.yPct).toBeCloseTo(0.25, 6);
  });

  it('normalizes storage coordinates and keeps runtime pixels for percent stickers', () => {
    const viewport = { width: 1200, height: 800 };
    const sticker = createTextSticker({ xPct: 0.5, yPct: 0.5, x: 20, y: 20 });

    const normalized = normalizeStickerCoordinatesForStorage(sticker, viewport);

    expect(normalized.x).toBeCloseTo(600, 4);
    expect(normalized.y).toBeCloseTo(400, 4);
    expect(normalized.xPct).toBeCloseTo(0.5, 6);
    expect(normalized.yPct).toBeCloseTo(0.5, 6);
  });
});

