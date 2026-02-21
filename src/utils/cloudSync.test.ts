import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BackupPackage } from './fullBackup';
import {
  collectCloudSyncConflicts,
  DEFAULT_CLOUD_SYNC_MERGE_CONFLICT_POLICY,
  buildChangedSectionImportScope,
  buildCloudSyncEnvelope,
  diffCloudSyncSections,
  hasAnyImportScopeEnabled,
  hasCloudSyncConflicts,
  parseCloudSyncEnvelopeJson,
  prepareMergePackageWithConflictPolicy,
  prepareMergePackageWithConflictCopies,
} from './cloudSync';
import { STORAGE_KEYS } from './storage';

const createBackupPackage = (overrides?: Partial<BackupPackage>): BackupPackage => ({
  type: 'eclipse-full-backup',
  exportVersion: '1.0.0',
  createdAt: Date.now(),
  localStorageEntries: {
    EclipseTab_spaces: '{"spaces":[{"id":"space-1","name":"Main","apps":[]}],"activeSpaceId":"space-1","version":1}',
    EclipseTab_stickers: '[]',
    EclipseTab_deletedStickers: '[]',
    EclipseTab_deletedDockItems: '[]',
    EclipseTab_deletedSpaces: '[]',
    EclipseTab_config: '{"theme":"light"}',
    app_language: 'en',
  },
  assets: {
    wallpapers: [],
    stickerAssets: [],
  },
  ...overrides,
});

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
});

describe('cloudSync', () => {
  it('builds section hashes and detects changed sections', async () => {
    const local = await buildCloudSyncEnvelope(createBackupPackage());
    const remote = await buildCloudSyncEnvelope(
      createBackupPackage({
        localStorageEntries: {
          ...createBackupPackage().localStorageEntries,
          EclipseTab_config: '{"theme":"dark"}',
        },
      })
    );

    const diff = diffCloudSyncSections(local, remote);
    expect(diff.changedSections).toEqual(['config']);
  });

  it('parses legacy backup json into envelope', async () => {
    const legacy = createBackupPackage();
    const parsed = await parseCloudSyncEnvelopeJson(JSON.stringify(legacy));

    expect(parsed.backup.type).toBe('eclipse-full-backup');
    expect(typeof parsed.sectionHashes.space).toBe('string');
    expect(parsed.sectionHashes.space.length).toBeGreaterThan(10);
  });

  it('builds effective scope from changed sections', () => {
    const scope = buildChangedSectionImportScope(
      { space: true, zenShelf: true, config: true },
      ['space', 'config']
    );

    expect(scope).toEqual({ space: true, zenShelf: false, config: true });
    expect(hasAnyImportScopeEnabled(scope)).toBe(true);
    expect(hasAnyImportScopeEnabled({ space: false, zenShelf: false, config: false })).toBe(false);
  });

  it('collects space/search-engine conflicts between local and remote backups', () => {
    const local = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-local-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-local-work', name: 'Work', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-local-main',
          version: 1,
        }),
        [STORAGE_KEYS.SEARCH_ENGINES]: JSON.stringify([
          { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
          { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
        ]),
      },
    });
    const remote = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-remote-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-remote-lab', name: 'Lab', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-remote-main',
          version: 1,
        }),
        [STORAGE_KEYS.SEARCH_ENGINES]: JSON.stringify([
          { id: 'google', name: 'Google Copy', url: 'https://google.example/search?q=%s' },
          { id: 'brave', name: 'Brave', url: 'https://duckduckgo.com/?q=%s' },
          { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
        ]),
      },
    });

    const report = collectCloudSyncConflicts(local, remote);

    expect(report.spaceNameConflicts).toEqual(['Main']);
    expect(report.searchEngineIdConflicts).toEqual(['google']);
    expect(report.searchEngineUrlConflicts).toEqual(['https://duckduckgo.com/?q=%s']);
    expect(hasCloudSyncConflicts(report)).toBe(true);
  });

  it('prepares merge package by renaming conflicting spaces as conflict copies', () => {
    const local = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-local-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-local-main-copy', name: 'Main (conflict-20260101-120000)', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-local-main',
          version: 1,
        }),
      },
    });
    const remote = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-remote-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-remote-lab', name: 'Lab', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-remote-main',
          version: 1,
        }),
      },
    });

    const result = prepareMergePackageWithConflictCopies(local, remote, Date.UTC(2026, 0, 1, 12, 0, 0));
    const parsedSpaces = JSON.parse(result.package.localStorageEntries[STORAGE_KEYS.SPACES] || '{}') as {
      spaces?: Array<{ id: string; name: string }>;
    };

    expect(result.renamedSpaces).toHaveLength(1);
    expect(result.renamedSpaces[0]?.from).toBe('Main');
    expect(result.renamedSpaces[0]?.to).toMatch(/^Main \(conflict-\d{8}-\d{6}(?:-\d+)?\)$/);
    expect(result.renamedSpaces[0]?.to).not.toBe('Main');
    expect(result.renamedSpaces[0]?.to).not.toBe('Main (conflict-20260101-120000)');
    expect(parsedSpaces.spaces?.find((space) => space.id === 'space-remote-main')?.name).toBe(
      result.renamedSpaces[0]?.to
    );
    expect(parsedSpaces.spaces?.find((space) => space.id === 'space-remote-lab')?.name).toBe('Lab');
    expect(result.skippedSpaceConflicts).toEqual([]);
  });

  it('supports keep-local policy for space name conflicts', () => {
    const local = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-local-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-local-work', name: 'Work', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-local-main',
          version: 1,
        }),
      },
    });
    const remote = createBackupPackage({
      localStorageEntries: {
        ...createBackupPackage().localStorageEntries,
        [STORAGE_KEYS.SPACES]: JSON.stringify({
          spaces: [
            { id: 'space-remote-main', name: 'Main', iconType: 'text', apps: [], createdAt: 1 },
            { id: 'space-remote-lab', name: 'Lab', iconType: 'text', apps: [], createdAt: 1 },
          ],
          activeSpaceId: 'space-remote-main',
          version: 1,
        }),
      },
    });

    const result = prepareMergePackageWithConflictPolicy(
      local,
      remote,
      {
        ...DEFAULT_CLOUD_SYNC_MERGE_CONFLICT_POLICY,
        spaceName: 'keepLocal',
      },
      Date.UTC(2026, 0, 1, 12, 0, 0)
    );

    const parsedSpaces = JSON.parse(result.package.localStorageEntries[STORAGE_KEYS.SPACES] || '{}') as {
      spaces?: Array<{ id: string; name: string }>;
      activeSpaceId?: string;
    };
    const names = (parsedSpaces.spaces || []).map((space) => space.name);

    expect(result.renamedSpaces).toEqual([]);
    expect(result.skippedSpaceConflicts).toEqual(['Main']);
    expect(names).toEqual(['Lab']);
    expect(parsedSpaces.activeSpaceId).toBe('space-remote-lab');
  });
});
