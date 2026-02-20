import { DeletedDockItemRecord, DeletedSpaceRecord, Sticker } from '../types';
import { db } from './db';
import { compressStickerImage } from './imageCompression';
import { STORAGE_KEYS, storage } from './storage';

export interface StorageOverview {
  usedBytes: number | null;
  quotaBytes: number | null;
}

export interface StorageStats {
  overview: StorageOverview;
  stickersCount: number;
  deletedStickersCount: number;
  deletedDockItemsCount: number;
  deletedSpacesCount: number;
  imageStickerBytes: number;
  wallpaperBytes: number;
  recycleBytes: number;
  iconBytes: number;
}

const getUtf8Bytes = (value: string): number => new Blob([value]).size;

const safeParse = <T>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

const getIconBytesFromDockItems = (items: Array<{ icon?: string; items?: Array<{ icon?: string }> }>): number => {
  let total = 0;
  items.forEach((item) => {
    if (item.icon) {
      total += getUtf8Bytes(item.icon);
    }
    if (item.items) {
      total += getIconBytesFromDockItems(item.items);
    }
  });
  return total;
};

const estimateOverview = async (): Promise<StorageOverview> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return {
      usedBytes: null,
      quotaBytes: null,
    };
  }

  const estimate = await navigator.storage.estimate();
  return {
    usedBytes: typeof estimate.usage === 'number' ? estimate.usage : null,
    quotaBytes: typeof estimate.quota === 'number' ? estimate.quota : null,
  };
};

export const collectStorageStats = async (): Promise<StorageStats> => {
  const [overview, wallpapers, stickerAssets] = await Promise.all([
    estimateOverview(),
    db.getAll(),
    db.getAllStickerAssets(),
  ]);

  const stickers = storage.getStickers();
  const deletedStickers = storage.getDeletedStickers();
  const deletedDockItems = storage.getDeletedDockItems();
  const deletedSpaces = storage.getDeletedSpaces();
  const spacesJson = localStorage.getItem(STORAGE_KEYS.SPACES);
  const spacesState = safeParse<{ spaces?: Array<{ apps?: Array<{ icon?: string; items?: Array<{ icon?: string }> }> }> }>(
    spacesJson,
    { spaces: [] }
  );

  const imageStickerBytes = stickerAssets.reduce((sum, item) => sum + getUtf8Bytes(item.data), 0);
  const wallpaperBytes = wallpapers.reduce((sum, item) => sum + item.data.size + (item.thumbnail?.size || 0), 0);
  const recycleBytes = estimateRecycleBytes(deletedDockItems, deletedSpaces, deletedStickers);

  const iconBytes = getIconBytesFromDockItems(
    (spacesState.spaces || []).flatMap((space) => space.apps || [])
  );

  return {
    overview,
    stickersCount: stickers.length,
    deletedStickersCount: deletedStickers.length,
    deletedDockItemsCount: deletedDockItems.length,
    deletedSpacesCount: deletedSpaces.length,
    imageStickerBytes,
    wallpaperBytes,
    recycleBytes,
    iconBytes,
  };
};

export const estimateRecycleBytes = (
  deletedDockItems: DeletedDockItemRecord[],
  deletedSpaces: DeletedSpaceRecord[],
  deletedStickers: Sticker[]
): number => {
  return (
    getUtf8Bytes(JSON.stringify(deletedDockItems)) +
    getUtf8Bytes(JSON.stringify(deletedSpaces)) +
    getUtf8Bytes(JSON.stringify(deletedStickers))
  );
};

export interface CleanupResult {
  removedCount: number;
  estimatedFreedBytes: number;
}

export const cleanupOldWallpapers = async (keepLatest: number = 6): Promise<CleanupResult> => {
  const wallpapers = await db.getAll();
  const sorted = [...wallpapers].sort((a, b) => b.createdAt - a.createdAt);
  const toDelete = sorted.slice(Math.max(keepLatest, 0));
  const ids = toDelete.map((item) => item.id);
  const estimatedFreedBytes = toDelete.reduce((sum, item) => sum + item.data.size + (item.thumbnail?.size || 0), 0);

  await db.removeMultiple(ids);
  return {
    removedCount: toDelete.length,
    estimatedFreedBytes,
  };
};

export const recompressStickerAssets = async (
  minBytesToRecompress: number = 256 * 1024
): Promise<CleanupResult> => {
  const assets = await db.getAllStickerAssets();
  let removedBytes = 0;
  let changed = 0;

  for (const asset of assets) {
    const originalBytes = getUtf8Bytes(asset.data);
    if (originalBytes < minBytesToRecompress) {
      continue;
    }

    const compressed = await compressStickerImage(asset.data);
    const compressedBytes = getUtf8Bytes(compressed);
    if (compressedBytes >= originalBytes) {
      continue;
    }

    await db.saveStickerAsset({
      ...asset,
      data: compressed,
    });
    removedBytes += originalBytes - compressedBytes;
    changed += 1;
  }

  return {
    removedCount: changed,
    estimatedFreedBytes: removedBytes,
  };
};

export const clearDockAndSpaceRecycleBins = (): void => {
  storage.saveDeletedDockItems([]);
  storage.saveDeletedSpaces([]);
};

export const formatBytes = (bytes: number | null): string => {
  if (bytes === null || Number.isNaN(bytes)) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const summarizeRecycleCounts = (
  deletedStickers: Sticker[],
  deletedDockItems: DeletedDockItemRecord[],
  deletedSpaces: DeletedSpaceRecord[]
): number => {
  return deletedStickers.length + deletedDockItems.length + deletedSpaces.length;
};
