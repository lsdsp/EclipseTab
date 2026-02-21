import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BackupPackage } from './fullBackup';
import {
  buildChangedSectionImportScope,
  buildCloudSyncEnvelope,
  diffCloudSyncSections,
  hasAnyImportScopeEnabled,
  parseCloudSyncEnvelopeJson,
} from './cloudSync';

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
});

