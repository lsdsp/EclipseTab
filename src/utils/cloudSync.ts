import type { BackupImportScope, BackupPackage } from './fullBackup';
import { parseBackupPackageJson } from './fullBackup';
import { STORAGE_KEYS } from './storage';

const CLOUD_SYNC_SCHEMA_VERSION = 1;
const LANGUAGE_KEY = 'app_language';

const SPACE_KEYS: ReadonlyArray<string> = [
  STORAGE_KEYS.SPACES,
  STORAGE_KEYS.DELETED_DOCK_ITEMS,
  STORAGE_KEYS.DELETED_SPACES,
];

const ZENSHELF_KEYS: ReadonlyArray<string> = [
  STORAGE_KEYS.STICKERS,
  STORAGE_KEYS.DELETED_STICKERS,
];

const CONFIG_KEYS: ReadonlyArray<string> = [
  STORAGE_KEYS.SEARCH_ENGINE,
  STORAGE_KEYS.SEARCH_ENGINES,
  STORAGE_KEYS.CONFIG,
  STORAGE_KEYS.WALLPAPER,
  STORAGE_KEYS.LAST_WALLPAPER,
  STORAGE_KEYS.WALLPAPER_ID,
  STORAGE_KEYS.SPACE_RULES,
  STORAGE_KEYS.SPACE_OVERRIDES,
  LANGUAGE_KEY,
];

export type CloudSyncSection = 'space' | 'zenShelf' | 'config';

export interface CloudSyncSectionHashes {
  space: string;
  zenShelf: string;
  config: string;
}

export interface CloudSyncEnvelope {
  schemaVersion: number;
  generatedAt: number;
  backup: BackupPackage;
  sectionHashes: CloudSyncSectionHashes;
}

export interface CloudSyncDiffResult {
  changedSections: CloudSyncSection[];
  localHashes: CloudSyncSectionHashes;
  remoteHashes: CloudSyncSectionHashes;
}

const pickEntries = (
  entries: Record<string, string | null>,
  keys: ReadonlyArray<string>
): Record<string, string | null> => {
  const selected: Record<string, string | null> = {};
  keys.forEach((key) => {
    selected[key] = entries[key] ?? null;
  });
  return selected;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const hashObject = async (value: unknown): Promise<string> => {
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable');
  }
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return toBase64Url(new Uint8Array(digest));
};

export const buildCloudSyncSectionHashes = async (
  backup: BackupPackage
): Promise<CloudSyncSectionHashes> => {
  const spacePayload = {
    entries: pickEntries(backup.localStorageEntries, SPACE_KEYS),
  };
  const zenShelfPayload = {
    entries: pickEntries(backup.localStorageEntries, ZENSHELF_KEYS),
    stickerAssets: backup.assets.stickerAssets,
  };
  const configPayload = {
    entries: pickEntries(backup.localStorageEntries, CONFIG_KEYS),
    wallpapers: backup.assets.wallpapers,
  };

  const [space, zenShelf, config] = await Promise.all([
    hashObject(spacePayload),
    hashObject(zenShelfPayload),
    hashObject(configPayload),
  ]);

  return { space, zenShelf, config };
};

export const buildCloudSyncEnvelope = async (
  backup: BackupPackage
): Promise<CloudSyncEnvelope> => ({
  schemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
  generatedAt: Date.now(),
  backup,
  sectionHashes: await buildCloudSyncSectionHashes(backup),
});

export const parseCloudSyncEnvelopeJson = async (
  content: string
): Promise<CloudSyncEnvelope> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    const legacyBackup = parseBackupPackageJson(content);
    return buildCloudSyncEnvelope(legacyBackup);
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as Partial<CloudSyncEnvelope>;
    const hasEnvelopeShape =
      candidate.schemaVersion === CLOUD_SYNC_SCHEMA_VERSION &&
      typeof candidate.generatedAt === 'number' &&
      typeof candidate.sectionHashes?.space === 'string' &&
      typeof candidate.sectionHashes?.zenShelf === 'string' &&
      typeof candidate.sectionHashes?.config === 'string' &&
      candidate.backup !== undefined;

    if (hasEnvelopeShape) {
      const validatedBackup = parseBackupPackageJson(JSON.stringify(candidate.backup));
      return {
        schemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
        generatedAt: Number(candidate.generatedAt),
        sectionHashes: candidate.sectionHashes as CloudSyncSectionHashes,
        backup: validatedBackup,
      };
    }
  }

  const legacyBackup = parseBackupPackageJson(content);
  return buildCloudSyncEnvelope(legacyBackup);
};

export const diffCloudSyncSections = (
  localEnvelope: CloudSyncEnvelope,
  remoteEnvelope: CloudSyncEnvelope
): CloudSyncDiffResult => {
  const changedSections: CloudSyncSection[] = [];
  if (localEnvelope.sectionHashes.space !== remoteEnvelope.sectionHashes.space) {
    changedSections.push('space');
  }
  if (localEnvelope.sectionHashes.zenShelf !== remoteEnvelope.sectionHashes.zenShelf) {
    changedSections.push('zenShelf');
  }
  if (localEnvelope.sectionHashes.config !== remoteEnvelope.sectionHashes.config) {
    changedSections.push('config');
  }
  return {
    changedSections,
    localHashes: localEnvelope.sectionHashes,
    remoteHashes: remoteEnvelope.sectionHashes,
  };
};

export const buildChangedSectionImportScope = (
  scope: BackupImportScope,
  changedSections: CloudSyncSection[]
): BackupImportScope => {
  const changedSet = new Set(changedSections);
  return {
    space: scope.space && changedSet.has('space'),
    zenShelf: scope.zenShelf && changedSet.has('zenShelf'),
    config: scope.config && changedSet.has('config'),
  };
};

export const hasAnyImportScopeEnabled = (scope: BackupImportScope): boolean =>
  scope.space || scope.zenShelf || scope.config;
