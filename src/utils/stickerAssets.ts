import { Sticker } from '../types';
import { db } from './db';
import { logger } from './logger';
import { normalizeStickerCoordinatesForStorage, ViewportSize } from './stickerCoordinates';

const IMAGE_DATA_URL_PREFIX = 'data:image/';

const isImageDataUrl = (content: string): boolean =>
  typeof content === 'string' && content.startsWith(IMAGE_DATA_URL_PREFIX);

const hasContent = (content: string | undefined): boolean =>
  typeof content === 'string' && content.length > 0;

const createStickerAssetId = (): string =>
  `sticker_asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const ensureStickerAsset = async (sticker: Sticker): Promise<Sticker> => {
  if (sticker.type !== 'image') return sticker;
  if (sticker.assetId) return sticker;
  if (!isImageDataUrl(sticker.content)) return sticker;

  try {
    const assetId = createStickerAssetId();
    await db.saveStickerAsset({
      id: assetId,
      data: sticker.content,
      createdAt: Date.now(),
    });

    return {
      ...sticker,
      assetId,
    };
  } catch (error) {
    logger.warn('[ZenShelf] Failed to migrate sticker asset into IndexedDB', error);
    return sticker;
  }
};

export const hydrateStickerAsset = async (sticker: Sticker): Promise<Sticker> => {
  if (sticker.type !== 'image') return sticker;
  if (!sticker.assetId) return sticker;
  if (hasContent(sticker.content)) return sticker;

  try {
    const asset = await db.getStickerAsset(sticker.assetId);
    if (!asset?.data) return sticker;
    return {
      ...sticker,
      content: asset.data,
    };
  } catch (error) {
    logger.warn('[ZenShelf] Failed to hydrate sticker asset from IndexedDB', error);
    return sticker;
  }
};

export const normalizeStickerForStorage = async (
  sticker: Sticker,
  viewport: ViewportSize
): Promise<Sticker> => {
  const withCoordinates = normalizeStickerCoordinatesForStorage(sticker, viewport);
  const withAsset = await ensureStickerAsset(withCoordinates);

  return toStorageSticker(withAsset);
};

export const toStorageSticker = (sticker: Sticker): Sticker => {
  if (sticker.type === 'image' && sticker.assetId) {
    return {
      ...sticker,
      content: '',
    };
  }

  return sticker;
};

export const hydrateStickerForRuntime = async (
  sticker: Sticker,
  viewport: ViewportSize
): Promise<Sticker> => {
  const withCoordinates = normalizeStickerCoordinatesForStorage(sticker, viewport);
  return hydrateStickerAsset(withCoordinates);
};

export const removeStickerAssetIfPresent = async (sticker: Sticker): Promise<void> => {
  if (sticker.type !== 'image' || !sticker.assetId) return;

  try {
    await db.removeStickerAsset(sticker.assetId);
  } catch (error) {
    logger.warn('[ZenShelf] Failed to remove sticker asset from IndexedDB', error);
  }
};
