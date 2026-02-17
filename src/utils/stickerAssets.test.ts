import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sticker } from '../types';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    saveStickerAsset: vi.fn(),
    getStickerAsset: vi.fn(),
    removeStickerAsset: vi.fn(),
  },
}));

vi.mock('./db', () => ({
  db: dbMock,
}));

import {
  ensureStickerAsset,
  hydrateStickerAsset,
  normalizeStickerForStorage,
  toStorageSticker,
} from './stickerAssets';

const createImageSticker = (patch: Partial<Sticker> = {}): Sticker => ({
  id: 'sticker-image',
  type: 'image',
  content: 'data:image/png;base64,AAAA',
  x: 100,
  y: 100,
  ...patch,
});

describe('stickerAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('migrates inline image sticker content into indexedDB asset', async () => {
    dbMock.saveStickerAsset.mockResolvedValue('asset_1');
    const sticker = createImageSticker();

    const migrated = await ensureStickerAsset(sticker);

    expect(dbMock.saveStickerAsset).toHaveBeenCalledTimes(1);
    expect(migrated.assetId).toBeTruthy();
    expect(migrated.content).toBe(sticker.content);
  });

  it('does not migrate non-data-url image content', async () => {
    const sticker = createImageSticker({ content: 'https://example.com/image.png' });

    const migrated = await ensureStickerAsset(sticker);

    expect(dbMock.saveStickerAsset).not.toHaveBeenCalled();
    expect(migrated).toEqual(sticker);
  });

  it('hydrates image sticker content from indexedDB when content is empty', async () => {
    const sticker = createImageSticker({ content: '', assetId: 'asset_123' });
    dbMock.getStickerAsset.mockResolvedValue({
      id: 'asset_123',
      data: 'data:image/webp;base64,BBBB',
      createdAt: Date.now(),
    });

    const hydrated = await hydrateStickerAsset(sticker);

    expect(dbMock.getStickerAsset).toHaveBeenCalledWith('asset_123');
    expect(hydrated.content).toBe('data:image/webp;base64,BBBB');
  });

  it('strips image content for storage when asset id exists', () => {
    const sticker = createImageSticker({ assetId: 'asset_456' });

    const persisted = toStorageSticker(sticker);

    expect(persisted.content).toBe('');
    expect(persisted.assetId).toBe('asset_456');
  });

  it('normalizes coordinates and strips content in one pass', async () => {
    dbMock.saveStickerAsset.mockResolvedValue('asset_2');
    const sticker = createImageSticker({ x: 960, y: 540 });

    const persisted = await normalizeStickerForStorage(sticker, { width: 1280, height: 720 });

    expect(persisted.assetId).toBeTruthy();
    expect(persisted.xPct).toBeCloseTo(0.5, 4);
    expect(persisted.yPct).toBeCloseTo(0.5, 4);
    expect(persisted.content).toBe('');
  });
});
