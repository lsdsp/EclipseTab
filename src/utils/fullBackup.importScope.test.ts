/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBackupImport, type BackupPackage } from './fullBackup';
import { STORAGE_KEYS } from './storage';

const dbState = vi.hoisted(() => ({
  wallpapers: [] as Array<{ id: string; data: Blob; createdAt: number; thumbnail?: Blob }>,
  stickerAssets: [] as Array<{ id: string; data: string; createdAt: number }>,
}));

vi.mock('./db', () => ({
  db: {
    getAll: vi.fn(async () => dbState.wallpapers),
    getAllStickerAssets: vi.fn(async () => dbState.stickerAssets),
    clearWallpapers: vi.fn(async () => {
      dbState.wallpapers = [];
    }),
    clearStickerAssets: vi.fn(async () => {
      dbState.stickerAssets = [];
    }),
    saveMultiple: vi.fn(async (items: Array<{ id: string; data: Blob; createdAt: number; thumbnail?: Blob }>) => {
      dbState.wallpapers = items;
      return items.map((item) => item.id);
    }),
    saveStickerAssets: vi.fn(async (items: Array<{ id: string; data: string; createdAt: number }>) => {
      dbState.stickerAssets = items;
      return items.map((item) => item.id);
    }),
  },
}));

const WALL_DATA_CURRENT = 'data:text/plain;base64,QQ==';
const WALL_DATA_INCOMING = 'data:text/plain;base64,Qg==';
const createMockBlob = (text: string): Blob => ({
  type: 'text/plain',
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
} as unknown as Blob);

const createCurrentState = () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify({
    spaces: [
      {
        id: 'space-current',
        name: 'Current Space',
        iconType: 'text',
        apps: [{ id: 'dock-current', name: 'Current', url: 'https://current.example', type: 'app' }],
        createdAt: 1,
      },
    ],
    activeSpaceId: 'space-current',
    version: 1,
  }));
  localStorage.setItem(STORAGE_KEYS.STICKERS, JSON.stringify([
    { id: 'sticker-current', type: 'text', content: 'current', x: 0, y: 0 },
  ]));
  localStorage.setItem(STORAGE_KEYS.DELETED_STICKERS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.DELETED_DOCK_ITEMS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.DELETED_SPACES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SEARCH_ENGINES, JSON.stringify([
    { id: 'google', name: 'Google', url: 'https://google.com/search?q=%s' },
  ]));
  localStorage.setItem(STORAGE_KEYS.SEARCH_ENGINE, JSON.stringify({
    id: 'google',
    name: 'Google',
    url: 'https://google.com/search?q=%s',
  }));
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ theme: 'light', searchStickerContent: true }));
  localStorage.setItem('app_language', 'en');
  localStorage.setItem(STORAGE_KEYS.SPACE_RULES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SPACE_OVERRIDES, JSON.stringify({}));
  localStorage.setItem(STORAGE_KEYS.WALLPAPER_ID, 'wall-current');
  localStorage.setItem(STORAGE_KEYS.WALLPAPER, WALL_DATA_CURRENT);
  localStorage.setItem(STORAGE_KEYS.LAST_WALLPAPER, WALL_DATA_CURRENT);

  dbState.wallpapers = [{ id: 'wall-current', createdAt: 1, data: createMockBlob('A') }];
  dbState.stickerAssets = [{ id: 'asset-current', createdAt: 1, data: 'asset-current' }];
};

const createIncomingPackage = (): BackupPackage => ({
  type: 'eclipse-full-backup',
  exportVersion: '1.0.0',
  createdAt: Date.now(),
  localStorageEntries: {
    [STORAGE_KEYS.SPACES]: JSON.stringify({
      spaces: [
        {
          id: 'space-incoming',
          name: 'Incoming Space',
          iconType: 'text',
          apps: [{ id: 'dock-incoming', name: 'Incoming', url: 'https://incoming.example', type: 'app' }],
          createdAt: 2,
        },
      ],
      activeSpaceId: 'space-incoming',
      version: 1,
    }),
    [STORAGE_KEYS.STICKERS]: JSON.stringify([
      { id: 'sticker-incoming', type: 'text', content: 'incoming', x: 10, y: 10 },
    ]),
    [STORAGE_KEYS.DELETED_STICKERS]: JSON.stringify([]),
    [STORAGE_KEYS.DELETED_DOCK_ITEMS]: JSON.stringify([]),
    [STORAGE_KEYS.DELETED_SPACES]: JSON.stringify([]),
    [STORAGE_KEYS.SEARCH_ENGINES]: JSON.stringify([
      { id: 'bing', name: 'Bing', url: 'https://bing.com/search?q=%s' },
    ]),
    [STORAGE_KEYS.SEARCH_ENGINE]: JSON.stringify({
      id: 'bing',
      name: 'Bing',
      url: 'https://bing.com/search?q=%s',
    }),
    [STORAGE_KEYS.CONFIG]: JSON.stringify({ theme: 'dark', searchStickerContent: false }),
    [STORAGE_KEYS.SPACE_RULES]: JSON.stringify([{ id: 'r1', type: 'domain', enabled: true, spaceId: 'space-incoming', domain: 'incoming.example' }]),
    [STORAGE_KEYS.SPACE_OVERRIDES]: JSON.stringify({ 'space-incoming': { searchEngineId: 'bing' } }),
    [STORAGE_KEYS.WALLPAPER_ID]: 'wall-incoming',
    [STORAGE_KEYS.WALLPAPER]: WALL_DATA_INCOMING,
    [STORAGE_KEYS.LAST_WALLPAPER]: WALL_DATA_INCOMING,
    app_language: 'zh',
  },
  assets: {
    wallpapers: [{ id: 'wall-incoming', createdAt: 2, data: WALL_DATA_INCOMING }],
    stickerAssets: [{ id: 'asset-incoming', createdAt: 2, data: 'asset-incoming' }],
  },
});

describe('fullBackup import scope', () => {
  beforeEach(() => {
    createCurrentState();
  });

  it('overwrite import only updates space section when scope is space-only', async () => {
    const incoming = createIncomingPackage();
    const result = await applyBackupImport(incoming, 'overwrite', {
      space: true,
      zenShelf: false,
      config: false,
    });

    const spacesState = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPACES) || '{}');
    const stickers = JSON.parse(localStorage.getItem(STORAGE_KEYS.STICKERS) || '[]');
    const config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}');

    expect(spacesState.spaces?.[0]?.name).toBe('Incoming Space');
    expect(stickers).toHaveLength(1);
    expect(stickers[0]?.id).toBe('sticker-current');
    expect(config.theme).toBe('light');
    expect(dbState.wallpapers.map((item) => item.id)).toEqual(['wall-current']);
    expect(dbState.stickerAssets.map((item) => item.id)).toEqual(['asset-current']);
    expect(result.preview.stickers.incoming).toBe(0);
  });

  it('merge import only updates ZenShelf section when scope is zenShelf-only', async () => {
    const incoming = createIncomingPackage();
    const result = await applyBackupImport(incoming, 'merge', {
      space: false,
      zenShelf: true,
      config: false,
    });

    const spacesState = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPACES) || '{}');
    const stickers = JSON.parse(localStorage.getItem(STORAGE_KEYS.STICKERS) || '[]');
    const searchEngines = JSON.parse(localStorage.getItem(STORAGE_KEYS.SEARCH_ENGINES) || '[]');

    expect(spacesState.spaces?.[0]?.name).toBe('Current Space');
    expect(stickers).toHaveLength(2);
    expect(stickers.some((item: { id: string }) => item.id === 'sticker-current')).toBe(true);
    expect(stickers.some((item: { id: string }) => item.id === 'sticker-incoming')).toBe(true);
    expect(searchEngines).toHaveLength(1);
    expect(searchEngines[0]?.id).toBe('google');
    expect(dbState.wallpapers.map((item) => item.id)).toEqual(['wall-current']);
    expect(dbState.stickerAssets.map((item) => item.id)).toEqual(['asset-current', 'asset-incoming']);
    expect(result.preview.spaces.incoming).toBe(0);
    expect(result.preview.stickers.incoming).toBe(1);
  });
});
