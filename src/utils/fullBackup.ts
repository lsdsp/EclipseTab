import {
  createDefaultSpacesState,
  DeletedDockItemRecord,
  DeletedSpaceRecord,
  DockItem,
  SearchEngine,
  Space,
  SpacesState,
  Sticker,
} from '../types';
import { db, StickerAssetItem } from './db';
import { logger } from './logger';
import { STORAGE_KEYS, storage } from './storage';
import { createSingleFileZip, readSingleFileZip } from './zipStore';

const BACKUP_EXPORT_VERSION = '1.0.0';
const LANGUAGE_KEY = 'app_language';

export type BackupPackageType = 'eclipse-full-backup' | 'eclipse-space-snapshot';
export type BackupImportStrategy = 'merge' | 'overwrite';

export interface SerializedWallpaperAsset {
  id: string;
  createdAt: number;
  data: string;
  thumbnail?: string;
}

export interface BackupIndexedDbAssets {
  wallpapers: SerializedWallpaperAsset[];
  stickerAssets: StickerAssetItem[];
}

export interface BackupPackage {
  type: BackupPackageType;
  exportVersion: string;
  createdAt: number;
  localStorageEntries: Record<string, string | null>;
  assets: BackupIndexedDbAssets;
}

export interface ImportPreviewSection {
  current: number;
  incoming: number;
  add: number;
  overwrite: number;
  conflict: number;
}

export interface ImportPreview {
  spaces: ImportPreviewSection;
  dockUrls: ImportPreviewSection;
  stickers: ImportPreviewSection;
  deletedStickers: ImportPreviewSection;
  searchEngines: ImportPreviewSection;
  wallpapers: ImportPreviewSection;
  stickerAssets: ImportPreviewSection;
}

export interface ImportResult {
  strategy: BackupImportStrategy;
  restoredFromRollback: boolean;
  preview: ImportPreview;
}

const backupKeys = (): string[] => [...storage.getManagedStorageKeys(), LANGUAGE_KEY];

const toDataUrl = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
};

const fromDataUrl = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(',');
  if (!meta || !base64) {
    throw new Error('Invalid data url');
  }

  const mimeMatch = meta.match(/^data:(.*?);base64$/);
  const mime = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const generateId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const ensureUniqueId = (id: string, usedIds: Set<string>, prefix: string): string => {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  let candidate = generateId(prefix);
  while (usedIds.has(candidate)) {
    candidate = generateId(prefix);
  }
  usedIds.add(candidate);
  return candidate;
};

const cloneDockItemsWithUniqueIds = (items: DockItem[], usedIds: Set<string>): DockItem[] => {
  return items.map((item) => {
    const nextId = ensureUniqueId(item.id || generateId('dock_item'), usedIds, 'dock_item');
    if (item.type === 'folder') {
      const nextChildren = cloneDockItemsWithUniqueIds(item.items || [], usedIds);
      return {
        ...item,
        id: nextId,
        items: nextChildren,
      };
    }
    return {
      ...item,
      id: nextId,
    };
  });
};

const collectDockUrls = (items: DockItem[]): Set<string> => {
  const urls = new Set<string>();

  const walk = (list: DockItem[]) => {
    list.forEach((item) => {
      if (item.type === 'folder') {
        walk(item.items || []);
        return;
      }
      if (item.url) {
        urls.add(item.url);
      }
    });
  };

  walk(items);
  return urls;
};

const filterDockItemsWithUrlDedup = (
  items: DockItem[],
  existingUrls: Set<string>,
  usedIds: Set<string>
): { items: DockItem[]; duplicates: number } => {
  let duplicates = 0;

  const walk = (list: DockItem[]): DockItem[] => {
    const result: DockItem[] = [];
    list.forEach((item) => {
      if (item.type === 'folder') {
        const children = walk(item.items || []);
        if (children.length === 0) {
          return;
        }
        const folderId = ensureUniqueId(item.id || generateId('folder'), usedIds, 'folder');
        result.push({
          ...item,
          id: folderId,
          items: children,
        });
        return;
      }

      if (item.url && existingUrls.has(item.url)) {
        duplicates += 1;
        return;
      }

      if (item.url) {
        existingUrls.add(item.url);
      }

      const nextId = ensureUniqueId(item.id || generateId('dock_item'), usedIds, 'dock_item');
      result.push({
        ...item,
        id: nextId,
      });
    });
    return result;
  };

  return { items: walk(items), duplicates };
};

const parseLocalEntries = (entries: Record<string, string | null>) => {
  return {
    spacesState: safeJsonParse<SpacesState>(entries[STORAGE_KEYS.SPACES], createDefaultSpacesState()),
    stickers: safeJsonParse<Sticker[]>(entries[STORAGE_KEYS.STICKERS], []),
    deletedStickers: safeJsonParse<Sticker[]>(entries[STORAGE_KEYS.DELETED_STICKERS], []),
    deletedDockItems: safeJsonParse<DeletedDockItemRecord[]>(entries[STORAGE_KEYS.DELETED_DOCK_ITEMS], []),
    deletedSpaces: safeJsonParse<DeletedSpaceRecord[]>(entries[STORAGE_KEYS.DELETED_SPACES], []),
    searchEngine: safeJsonParse<SearchEngine | null>(entries[STORAGE_KEYS.SEARCH_ENGINE], null),
    searchEngines: safeJsonParse<SearchEngine[] | null>(entries[STORAGE_KEYS.SEARCH_ENGINES], null),
    language: entries[LANGUAGE_KEY] || 'en',
    configRaw: entries[STORAGE_KEYS.CONFIG] ?? null,
    wallpaperIdRaw: entries[STORAGE_KEYS.WALLPAPER_ID] ?? null,
    wallpaperRaw: entries[STORAGE_KEYS.WALLPAPER] ?? null,
    lastWallpaperRaw: entries[STORAGE_KEYS.LAST_WALLPAPER] ?? null,
  };
};

const readCurrentLocalStorageEntries = (): Record<string, string | null> => {
  const entries: Record<string, string | null> = {};
  backupKeys().forEach((key) => {
    entries[key] = localStorage.getItem(key);
  });
  return entries;
};

const readCurrentAssets = async (): Promise<BackupIndexedDbAssets> => {
  const [wallpapers, stickerAssets] = await Promise.all([
    db.getAll(),
    db.getAllStickerAssets(),
  ]);

  const serializedWallpapers = await Promise.all(
    wallpapers.map(async (item) => ({
      id: item.id,
      createdAt: item.createdAt,
      data: await toDataUrl(item.data),
      thumbnail: item.thumbnail ? await toDataUrl(item.thumbnail) : undefined,
    }))
  );

  return {
    wallpapers: serializedWallpapers,
    stickerAssets,
  };
};

const writeLocalStorageEntries = (entries: Record<string, string | null>): void => {
  backupKeys().forEach((key) => {
    const value = entries[key];
    if (value === undefined || value === null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  });
};

const writeAssets = async (assets: BackupIndexedDbAssets): Promise<void> => {
  await db.clearWallpapers();
  await db.clearStickerAssets();

  const wallpapers = assets.wallpapers.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    data: fromDataUrl(item.data),
    thumbnail: item.thumbnail ? fromDataUrl(item.thumbnail) : undefined,
  }));

  await Promise.all([
    db.saveMultiple(wallpapers),
    db.saveStickerAssets(assets.stickerAssets),
  ]);
};

const createPackage = async (
  type: BackupPackageType,
  customEntries?: Record<string, string | null>
): Promise<BackupPackage> => {
  return {
    type,
    exportVersion: BACKUP_EXPORT_VERSION,
    createdAt: Date.now(),
    localStorageEntries: customEntries || readCurrentLocalStorageEntries(),
    assets: await readCurrentAssets(),
  };
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const serializePackage = (pkg: BackupPackage): string => JSON.stringify(pkg);
const deserializePackage = (json: string): BackupPackage => JSON.parse(json) as BackupPackage;

const buildDateTag = (): string => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const mergeSpaces = (current: SpacesState, incoming: SpacesState) => {
  const nextSpaces: Space[] = [...current.spaces];
  const usedSpaceIds = new Set(current.spaces.map((space) => space.id));
  const usedDockIds = new Set<string>();
  current.spaces.forEach((space) => {
    cloneDockItemsWithUniqueIds(space.apps, usedDockIds);
  });

  const existingByName = new Map<string, Space>();
  nextSpaces.forEach((space) => {
    existingByName.set(space.name.trim().toLowerCase(), space);
  });

  let nameConflicts = 0;
  let dockUrlConflicts = 0;

  incoming.spaces.forEach((space) => {
    const key = space.name.trim().toLowerCase();
    const currentSpace = existingByName.get(key);
    if (!currentSpace) {
      const nextId = ensureUniqueId(space.id || generateId('space'), usedSpaceIds, 'space');
      const clonedApps = cloneDockItemsWithUniqueIds(space.apps || [], usedDockIds);
      const appended: Space = {
        ...space,
        id: nextId,
        apps: clonedApps,
      };
      nextSpaces.push(appended);
      existingByName.set(key, appended);
      return;
    }

    nameConflicts += 1;
    const existingUrls = collectDockUrls(currentSpace.apps || []);
    const filtered = filterDockItemsWithUrlDedup(space.apps || [], existingUrls, usedDockIds);
    dockUrlConflicts += filtered.duplicates;
    currentSpace.apps = [...(currentSpace.apps || []), ...filtered.items];
  });

  return {
    merged: {
      spaces: nextSpaces,
      activeSpaceId: current.activeSpaceId,
      version: Math.max(current.version || 1, incoming.version || 1),
    } satisfies SpacesState,
    nameConflicts,
    dockUrlConflicts,
  };
};

const remapStickerIds = (
  incoming: Sticker[],
  usedStickerIds: Set<string>,
  assetIdRemap: Map<string, string>
): { stickers: Sticker[]; conflicts: number } => {
  let conflicts = 0;
  const stickers = incoming.map((sticker) => {
    const nextId = ensureUniqueId(sticker.id || generateId('sticker'), usedStickerIds, 'sticker');
    if (nextId !== sticker.id) {
      conflicts += 1;
    }
    const nextAssetId = sticker.assetId ? assetIdRemap.get(sticker.assetId) || sticker.assetId : undefined;
    return {
      ...sticker,
      id: nextId,
      assetId: nextAssetId,
    };
  });

  return { stickers, conflicts };
};

const mergeAssets = (
  current: BackupIndexedDbAssets,
  incoming: BackupIndexedDbAssets
): {
  assets: BackupIndexedDbAssets;
  wallpaperConflicts: number;
  stickerAssetConflicts: number;
  stickerAssetIdRemap: Map<string, string>;
} => {
  const wallpapers = [...current.wallpapers];
  const stickerAssets = [...current.stickerAssets];
  const usedWallpaperIds = new Set(wallpapers.map((item) => item.id));
  const usedStickerAssetIds = new Set(stickerAssets.map((item) => item.id));
  const stickerAssetIdRemap = new Map<string, string>();

  let wallpaperConflicts = 0;
  incoming.wallpapers.forEach((asset) => {
    let nextId = asset.id;
    if (usedWallpaperIds.has(nextId)) {
      wallpaperConflicts += 1;
      nextId = ensureUniqueId(generateId('wallpaper'), usedWallpaperIds, 'wallpaper');
    } else {
      usedWallpaperIds.add(nextId);
    }
    wallpapers.push({
      ...asset,
      id: nextId,
    });
  });

  let stickerAssetConflicts = 0;
  incoming.stickerAssets.forEach((asset) => {
    let nextId = asset.id;
    if (usedStickerAssetIds.has(nextId)) {
      stickerAssetConflicts += 1;
      nextId = ensureUniqueId(generateId('sticker_asset'), usedStickerAssetIds, 'sticker_asset');
    } else {
      usedStickerAssetIds.add(nextId);
    }
    stickerAssetIdRemap.set(asset.id, nextId);
    stickerAssets.push({
      ...asset,
      id: nextId,
    });
  });

  return {
    assets: {
      wallpapers,
      stickerAssets,
    },
    wallpaperConflicts,
    stickerAssetConflicts,
    stickerAssetIdRemap,
  };
};

const mergeEntries = (
  currentEntries: Record<string, string | null>,
  incomingEntries: Record<string, string | null>,
  assetIdRemap: Map<string, string>
): {
  entries: Record<string, string | null>;
  preview: ImportPreview;
} => {
  const current = parseLocalEntries(currentEntries);
  const incoming = parseLocalEntries(incomingEntries);

  const { merged: mergedSpaces, nameConflicts, dockUrlConflicts } = mergeSpaces(current.spacesState, incoming.spacesState);

  const usedStickerIds = new Set(current.stickers.map((sticker) => sticker.id));
  const mergedStickersResult = remapStickerIds(incoming.stickers, usedStickerIds, assetIdRemap);
  const usedDeletedStickerIds = new Set(current.deletedStickers.map((sticker) => sticker.id));
  const mergedDeletedStickersResult = remapStickerIds(incoming.deletedStickers, usedDeletedStickerIds, assetIdRemap);

  const searchEnginesCurrent = current.searchEngines || [];
  const searchEnginesIncoming = incoming.searchEngines || [];
  const searchEnginesById = new Map<string, SearchEngine>();
  searchEnginesCurrent.forEach((engine) => {
    searchEnginesById.set(engine.id, engine);
  });
  let searchEngineConflicts = 0;
  searchEnginesIncoming.forEach((engine) => {
    if (searchEnginesById.has(engine.id)) {
      searchEngineConflicts += 1;
      return;
    }
    const sameUrl = Array.from(searchEnginesById.values()).some((existing) => existing.url === engine.url);
    if (sameUrl) {
      searchEngineConflicts += 1;
      return;
    }
    searchEnginesById.set(engine.id, engine);
  });
  const mergedSearchEngines = Array.from(searchEnginesById.values());

  const mergedDeletedDockItems: DeletedDockItemRecord[] = [...current.deletedDockItems];
  const usedDeletedDockRecordIds = new Set(mergedDeletedDockItems.map((record) => record.id));
  let deletedDockConflicts = 0;
  incoming.deletedDockItems.forEach((record) => {
    const nextId = ensureUniqueId(record.id || generateId('deleted_dock'), usedDeletedDockRecordIds, 'deleted_dock');
    if (nextId !== record.id) deletedDockConflicts += 1;
    mergedDeletedDockItems.push({ ...record, id: nextId });
  });

  const mergedDeletedSpaces: DeletedSpaceRecord[] = [...current.deletedSpaces];
  const usedDeletedSpaceRecordIds = new Set(mergedDeletedSpaces.map((record) => record.id));
  let deletedSpaceConflicts = 0;
  incoming.deletedSpaces.forEach((record) => {
    const nextId = ensureUniqueId(record.id || generateId('deleted_space'), usedDeletedSpaceRecordIds, 'deleted_space');
    if (nextId !== record.id) deletedSpaceConflicts += 1;
    mergedDeletedSpaces.push({ ...record, id: nextId });
  });

  const entries: Record<string, string | null> = {
    ...currentEntries,
    [STORAGE_KEYS.SPACES]: JSON.stringify(mergedSpaces),
    [STORAGE_KEYS.STICKERS]: JSON.stringify([...current.stickers, ...mergedStickersResult.stickers]),
    [STORAGE_KEYS.DELETED_STICKERS]: JSON.stringify([...current.deletedStickers, ...mergedDeletedStickersResult.stickers]),
    [STORAGE_KEYS.DELETED_DOCK_ITEMS]: JSON.stringify(mergedDeletedDockItems),
    [STORAGE_KEYS.DELETED_SPACES]: JSON.stringify(mergedDeletedSpaces),
    [STORAGE_KEYS.SEARCH_ENGINES]: JSON.stringify(mergedSearchEngines),
    [STORAGE_KEYS.SEARCH_ENGINE]:
      current.searchEngine && mergedSearchEngines.some((engine) => engine.id === current.searchEngine?.id)
        ? JSON.stringify(current.searchEngine)
        : (mergedSearchEngines[0] ? JSON.stringify(mergedSearchEngines[0]) : null),
    // Merge strategy keeps current config and language
    [STORAGE_KEYS.CONFIG]: current.configRaw,
    [LANGUAGE_KEY]: current.language,
    [STORAGE_KEYS.WALLPAPER]: current.wallpaperRaw,
    [STORAGE_KEYS.LAST_WALLPAPER]: current.lastWallpaperRaw,
    [STORAGE_KEYS.WALLPAPER_ID]: current.wallpaperIdRaw,
  };

  return {
    entries,
    preview: {
      spaces: {
        current: current.spacesState.spaces.length,
        incoming: incoming.spacesState.spaces.length,
        add: incoming.spacesState.spaces.length - nameConflicts,
        overwrite: nameConflicts,
        conflict: nameConflicts,
      },
      dockUrls: {
        current: collectDockUrls(current.spacesState.spaces.flatMap((space) => space.apps || [])).size,
        incoming: collectDockUrls(incoming.spacesState.spaces.flatMap((space) => space.apps || [])).size,
        add: Math.max(0, collectDockUrls(incoming.spacesState.spaces.flatMap((space) => space.apps || [])).size - dockUrlConflicts),
        overwrite: dockUrlConflicts,
        conflict: dockUrlConflicts,
      },
      stickers: {
        current: current.stickers.length,
        incoming: incoming.stickers.length,
        add: incoming.stickers.length - mergedStickersResult.conflicts,
        overwrite: mergedStickersResult.conflicts,
        conflict: mergedStickersResult.conflicts,
      },
      deletedStickers: {
        current: current.deletedStickers.length,
        incoming: incoming.deletedStickers.length,
        add: incoming.deletedStickers.length - mergedDeletedStickersResult.conflicts,
        overwrite: mergedDeletedStickersResult.conflicts,
        conflict: mergedDeletedStickersResult.conflicts,
      },
      searchEngines: {
        current: searchEnginesCurrent.length,
        incoming: searchEnginesIncoming.length,
        add: searchEnginesIncoming.length - searchEngineConflicts,
        overwrite: searchEngineConflicts,
        conflict: searchEngineConflicts,
      },
      wallpapers: {
        current: 0,
        incoming: 0,
        add: 0,
        overwrite: 0,
        conflict: 0,
      },
      stickerAssets: {
        current: 0,
        incoming: 0,
        add: 0,
        overwrite: deletedDockConflicts + deletedSpaceConflicts,
        conflict: deletedDockConflicts + deletedSpaceConflicts,
      },
    },
  };
};

const buildPreview = (
  current: BackupPackage,
  incoming: BackupPackage,
  strategy: BackupImportStrategy
): ImportPreview => {
  const currentParsed = parseLocalEntries(current.localStorageEntries);
  const incomingParsed = parseLocalEntries(incoming.localStorageEntries);

  const currentSpaceNames = new Set(currentParsed.spacesState.spaces.map((space) => space.name.trim().toLowerCase()));
  const incomingSpaceConflicts = incomingParsed.spacesState.spaces.filter((space) =>
    currentSpaceNames.has(space.name.trim().toLowerCase())
  ).length;

  const currentStickerIds = new Set(currentParsed.stickers.map((sticker) => sticker.id));
  const incomingStickerConflicts = incomingParsed.stickers.filter((sticker) => currentStickerIds.has(sticker.id)).length;

  const currentDeletedStickerIds = new Set(currentParsed.deletedStickers.map((sticker) => sticker.id));
  const incomingDeletedStickerConflicts = incomingParsed.deletedStickers.filter((sticker) =>
    currentDeletedStickerIds.has(sticker.id)
  ).length;

  const currentSearchIds = new Set((currentParsed.searchEngines || []).map((engine) => engine.id));
  const currentSearchUrls = new Set((currentParsed.searchEngines || []).map((engine) => engine.url));
  const incomingSearchConflicts = (incomingParsed.searchEngines || []).filter((engine) =>
    currentSearchIds.has(engine.id) || currentSearchUrls.has(engine.url)
  ).length;

  const currentWallpaperIds = new Set(current.assets.wallpapers.map((asset) => asset.id));
  const incomingWallpaperConflicts = incoming.assets.wallpapers.filter((asset) => currentWallpaperIds.has(asset.id)).length;

  const currentStickerAssetIds = new Set(current.assets.stickerAssets.map((asset) => asset.id));
  const incomingStickerAssetConflicts = incoming.assets.stickerAssets.filter((asset) =>
    currentStickerAssetIds.has(asset.id)
  ).length;

  const overwriteSection = (currentCount: number, incomingCount: number, conflict: number): ImportPreviewSection => ({
    current: currentCount,
    incoming: incomingCount,
    add: strategy === 'overwrite' ? incomingCount : incomingCount - conflict,
    overwrite: strategy === 'overwrite' ? currentCount : conflict,
    conflict,
  });

  return {
    spaces: overwriteSection(currentParsed.spacesState.spaces.length, incomingParsed.spacesState.spaces.length, incomingSpaceConflicts),
    dockUrls: overwriteSection(
      collectDockUrls(currentParsed.spacesState.spaces.flatMap((space) => space.apps || [])).size,
      collectDockUrls(incomingParsed.spacesState.spaces.flatMap((space) => space.apps || [])).size,
      0
    ),
    stickers: overwriteSection(currentParsed.stickers.length, incomingParsed.stickers.length, incomingStickerConflicts),
    deletedStickers: overwriteSection(
      currentParsed.deletedStickers.length,
      incomingParsed.deletedStickers.length,
      incomingDeletedStickerConflicts
    ),
    searchEngines: overwriteSection(
      (currentParsed.searchEngines || []).length,
      (incomingParsed.searchEngines || []).length,
      incomingSearchConflicts
    ),
    wallpapers: overwriteSection(current.assets.wallpapers.length, incoming.assets.wallpapers.length, incomingWallpaperConflicts),
    stickerAssets: overwriteSection(
      current.assets.stickerAssets.length,
      incoming.assets.stickerAssets.length,
      incomingStickerAssetConflicts
    ),
  };
};

const mergePackages = (current: BackupPackage, incoming: BackupPackage): { merged: BackupPackage; preview: ImportPreview } => {
  const mergedAssetsResult = mergeAssets(current.assets, incoming.assets);
  const mergedEntriesResult = mergeEntries(
    current.localStorageEntries,
    incoming.localStorageEntries,
    mergedAssetsResult.stickerAssetIdRemap
  );

  const preview = buildPreview(current, incoming, 'merge');
  preview.wallpapers.conflict = mergedAssetsResult.wallpaperConflicts;
  preview.wallpapers.overwrite = mergedAssetsResult.wallpaperConflicts;
  preview.wallpapers.add = incoming.assets.wallpapers.length - mergedAssetsResult.wallpaperConflicts;
  preview.stickerAssets.conflict = mergedAssetsResult.stickerAssetConflicts;
  preview.stickerAssets.overwrite = mergedAssetsResult.stickerAssetConflicts;
  preview.stickerAssets.add = incoming.assets.stickerAssets.length - mergedAssetsResult.stickerAssetConflicts;

  return {
    merged: {
      type: 'eclipse-full-backup',
      exportVersion: BACKUP_EXPORT_VERSION,
      createdAt: Date.now(),
      localStorageEntries: mergedEntriesResult.entries,
      assets: mergedAssetsResult.assets,
    },
    preview,
  };
};

const assertPackage = (value: unknown): BackupPackage => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid backup package');
  }
  const candidate = value as BackupPackage;
  if (
    (candidate.type !== 'eclipse-full-backup' && candidate.type !== 'eclipse-space-snapshot') ||
    typeof candidate.exportVersion !== 'string' ||
    !candidate.localStorageEntries ||
    !candidate.assets
  ) {
    throw new Error('Invalid backup package structure');
  }
  if (candidate.exportVersion !== BACKUP_EXPORT_VERSION) {
    throw new Error(`Unsupported backup version: ${candidate.exportVersion}`);
  }
  return candidate;
};

export const buildSpaceSnapshotEntries = (space: Space): Record<string, string | null> => {
  const entries = readCurrentLocalStorageEntries();
  const currentSpaces = safeJsonParse<SpacesState>(entries[STORAGE_KEYS.SPACES], createDefaultSpacesState());
  const nextSpaces: SpacesState = {
    spaces: [{ ...space }],
    activeSpaceId: space.id,
    version: currentSpaces.version || 1,
  };
  entries[STORAGE_KEYS.SPACES] = JSON.stringify(nextSpaces);

  const deletedDockItems = safeJsonParse<DeletedDockItemRecord[]>(entries[STORAGE_KEYS.DELETED_DOCK_ITEMS], []);
  entries[STORAGE_KEYS.DELETED_DOCK_ITEMS] = JSON.stringify(
    deletedDockItems.filter((record) => record.spaceId === space.id)
  );

  const deletedSpaces = safeJsonParse<DeletedSpaceRecord[]>(entries[STORAGE_KEYS.DELETED_SPACES], []);
  entries[STORAGE_KEYS.DELETED_SPACES] = JSON.stringify(deletedSpaces.filter((record) => record.space.id === space.id));
  return entries;
};

export const exportFullBackupToZip = async (): Promise<void> => {
  const pkg = await createPackage('eclipse-full-backup');
  const zip = createSingleFileZip('backup.json', serializePackage(pkg));
  downloadBlob(zip, `eclipse-full-backup-${buildDateTag()}.zip`);
};

export const exportSpaceSnapshotToZip = async (space: Space): Promise<void> => {
  const entries = buildSpaceSnapshotEntries(space);
  const pkg = await createPackage('eclipse-space-snapshot', entries);
  const zip = createSingleFileZip('snapshot.json', serializePackage(pkg));
  downloadBlob(zip, `eclipse-space-snapshot-${space.name.toLowerCase()}-${buildDateTag()}.zip`);
};

export const parseBackupFile = async (file: File): Promise<BackupPackage> => {
  const readAsJson = async (): Promise<BackupPackage> => {
    const content = await file.text();
    return assertPackage(deserializePackage(content));
  };

  try {
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { content } = await readSingleFileZip(file);
      return assertPackage(deserializePackage(content));
    }
    return await readAsJson();
  } catch (error) {
    logger.warn('Failed to parse as zip, fallback to JSON parsing', error);
    return readAsJson();
  }
};

export const previewBackupImport = async (
  incoming: BackupPackage,
  strategy: BackupImportStrategy
): Promise<ImportPreview> => {
  const current = await createPackage('eclipse-full-backup');
  return buildPreview(current, incoming, strategy);
};

export const applyBackupImport = async (
  incoming: BackupPackage,
  strategy: BackupImportStrategy
): Promise<ImportResult> => {
  const snapshot = await createPackage('eclipse-full-backup');
  let restoredFromRollback = false;

  try {
    if (strategy === 'overwrite') {
      const preview = buildPreview(snapshot, incoming, strategy);
      writeLocalStorageEntries(incoming.localStorageEntries);
      await writeAssets(incoming.assets);
      storage.resetMemoryCache();
      return {
        strategy,
        preview,
        restoredFromRollback,
      };
    }

    const merged = mergePackages(snapshot, incoming);
    writeLocalStorageEntries(merged.merged.localStorageEntries);
    await writeAssets(merged.merged.assets);
    storage.resetMemoryCache();

    return {
      strategy,
      preview: merged.preview,
      restoredFromRollback,
    };
  } catch (error) {
    logger.error('[Backup] Import failed, rolling back snapshot', error);
    restoredFromRollback = true;
    writeLocalStorageEntries(snapshot.localStorageEntries);
    await writeAssets(snapshot.assets);
    storage.resetMemoryCache();
    throw error;
  }
};
