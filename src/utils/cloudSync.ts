import type { BackupImportScope, BackupPackage } from './fullBackup';
import { parseBackupPackageJson } from './fullBackup';
import { STORAGE_KEYS } from './storage';
import type { SearchEngine, Space, SpacesState } from '../types';

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

export interface CloudSyncConflictReport {
  spaceNameConflicts: string[];
  searchEngineIdConflicts: string[];
  searchEngineUrlConflicts: string[];
}

export interface SpaceRenameMapping {
  from: string;
  to: string;
}

export type CloudSyncSpaceConflictPolicy = 'keepBoth' | 'keepLocal';
export type CloudSyncSearchEngineConflictPolicy = 'keepLocal' | 'keepRemote';

export interface CloudSyncMergeConflictPolicy {
  spaceName: CloudSyncSpaceConflictPolicy;
  searchEngine: CloudSyncSearchEngineConflictPolicy;
}

export const DEFAULT_CLOUD_SYNC_MERGE_CONFLICT_POLICY: CloudSyncMergeConflictPolicy = {
  spaceName: 'keepBoth',
  searchEngine: 'keepLocal',
};

export interface MergeConflictPreparationResult {
  package: BackupPackage;
  renamedSpaces: SpaceRenameMapping[];
  skippedSpaceConflicts: string[];
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

const safeParseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizeNameKey = (value: string): string => value.trim().toLowerCase();

const parseSpacesState = (entries: Record<string, string | null>): SpacesState => {
  const parsed = safeParseJson<Partial<SpacesState>>(
    entries[STORAGE_KEYS.SPACES],
    { spaces: [], activeSpaceId: '', version: 1 }
  );

  return {
    spaces: Array.isArray(parsed.spaces) ? parsed.spaces as Space[] : [],
    activeSpaceId: typeof parsed.activeSpaceId === 'string' ? parsed.activeSpaceId : '',
    version: typeof parsed.version === 'number' ? parsed.version : 1,
  };
};

const parseSearchEngines = (entries: Record<string, string | null>): SearchEngine[] =>
  safeParseJson<unknown[]>(entries[STORAGE_KEYS.SEARCH_ENGINES], [])
    .filter(
      (engine): engine is SearchEngine =>
        !!engine
        && typeof engine === 'object'
        && typeof (engine as Partial<SearchEngine>).id === 'string'
        && typeof (engine as Partial<SearchEngine>).url === 'string'
    )
    .map((engine) => ({
      id: engine.id.trim(),
      name: typeof engine.name === 'string' ? engine.name : '',
      url: engine.url.trim(),
    }))
    .filter((engine) => engine.id.length > 0 && engine.url.length > 0);

const formatConflictTimestampTag = (timestamp: number): string => {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const buildConflictSpaceName = (
  baseName: string,
  timestampTag: string,
  index: number
): string =>
  index <= 1
    ? `${baseName} (conflict-${timestampTag})`
    : `${baseName} (conflict-${timestampTag}-${index})`;

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

export const collectCloudSyncConflicts = (
  localBackup: BackupPackage,
  remoteBackup: BackupPackage
): CloudSyncConflictReport => {
  const localSpaces = parseSpacesState(localBackup.localStorageEntries).spaces;
  const remoteSpaces = parseSpacesState(remoteBackup.localStorageEntries).spaces;
  const localSpaceNameKeys = new Set<string>();
  localSpaces.forEach((space) => {
    const key = normalizeNameKey(space?.name || '');
    if (key) {
      localSpaceNameKeys.add(key);
    }
  });

  const spaceNameConflicts: string[] = [];
  const seenSpaceConflictKeys = new Set<string>();
  remoteSpaces.forEach((space) => {
    const name = typeof space?.name === 'string' ? space.name.trim() : '';
    const key = normalizeNameKey(name);
    if (!key || !localSpaceNameKeys.has(key) || seenSpaceConflictKeys.has(key)) {
      return;
    }
    seenSpaceConflictKeys.add(key);
    spaceNameConflicts.push(name);
  });

  const localSearchEngines = parseSearchEngines(localBackup.localStorageEntries);
  const remoteSearchEngines = parseSearchEngines(remoteBackup.localStorageEntries);
  const localSearchEngineIds = new Set(localSearchEngines.map((engine) => engine.id));
  const localSearchEngineUrls = new Set(localSearchEngines.map((engine) => engine.url));
  const searchEngineIdConflicts: string[] = [];
  const searchEngineUrlConflicts: string[] = [];
  const seenSearchEngineIds = new Set<string>();
  const seenSearchEngineUrls = new Set<string>();

  remoteSearchEngines.forEach((engine) => {
    if (localSearchEngineIds.has(engine.id)) {
      if (!seenSearchEngineIds.has(engine.id)) {
        seenSearchEngineIds.add(engine.id);
        searchEngineIdConflicts.push(engine.id);
      }
      return;
    }
    if (localSearchEngineUrls.has(engine.url) && !seenSearchEngineUrls.has(engine.url)) {
      seenSearchEngineUrls.add(engine.url);
      searchEngineUrlConflicts.push(engine.url);
    }
  });

  return {
    spaceNameConflicts,
    searchEngineIdConflicts,
    searchEngineUrlConflicts,
  };
};

export const hasCloudSyncConflicts = (report: CloudSyncConflictReport): boolean =>
  report.spaceNameConflicts.length > 0
  || report.searchEngineIdConflicts.length > 0
  || report.searchEngineUrlConflicts.length > 0;

export const prepareMergePackageWithConflictPolicy = (
  localBackup: BackupPackage,
  remoteBackup: BackupPackage,
  policy: CloudSyncMergeConflictPolicy = DEFAULT_CLOUD_SYNC_MERGE_CONFLICT_POLICY,
  now: number = Date.now()
): MergeConflictPreparationResult => {
  const localSpaces = parseSpacesState(localBackup.localStorageEntries).spaces;
  const remoteSpacesState = parseSpacesState(remoteBackup.localStorageEntries);
  const localSpaceNameKeys = new Set<string>();
  const usedSpaceNameKeys = new Set<string>();
  localSpaces.forEach((space) => {
    const key = normalizeNameKey(space?.name || '');
    localSpaceNameKeys.add(key);
    usedSpaceNameKeys.add(key);
  });

  const timestampTag = formatConflictTimestampTag(now);
  const renamedSpaces: SpaceRenameMapping[] = [];
  const skippedSpaceConflicts: string[] = [];
  const nextSpaces: Space[] = [];

  remoteSpacesState.spaces.forEach((space) => {
    const rawName = typeof space?.name === 'string' ? space.name : '';
    const normalizedRawName = normalizeNameKey(rawName);
    const conflictWithLocal = !!normalizedRawName && localSpaceNameKeys.has(normalizedRawName);
    const nameAlreadyUsed = !!normalizedRawName && usedSpaceNameKeys.has(normalizedRawName);

    if (!nameAlreadyUsed) {
      usedSpaceNameKeys.add(normalizedRawName);
      nextSpaces.push(space);
      return;
    }

    if (conflictWithLocal && policy.spaceName === 'keepLocal') {
      skippedSpaceConflicts.push(rawName);
      return;
    }

    const baseName = rawName.trim() || 'Space';
    let candidateIndex = 1;
    let candidateName = buildConflictSpaceName(baseName, timestampTag, candidateIndex);
    let candidateKey = normalizeNameKey(candidateName);

    while (usedSpaceNameKeys.has(candidateKey)) {
      candidateIndex += 1;
      candidateName = buildConflictSpaceName(baseName, timestampTag, candidateIndex);
      candidateKey = normalizeNameKey(candidateName);
    }

    usedSpaceNameKeys.add(candidateKey);
    renamedSpaces.push({
      from: rawName,
      to: candidateName,
    });

    nextSpaces.push({
      ...space,
      name: candidateName,
    });
  });

  if (renamedSpaces.length === 0 && skippedSpaceConflicts.length === 0) {
    return {
      package: remoteBackup,
      renamedSpaces: [],
      skippedSpaceConflicts: [],
    };
  }

  const preparedSpacesState: SpacesState = {
    ...remoteSpacesState,
    spaces: nextSpaces,
    activeSpaceId:
      nextSpaces.some((space) => space.id === remoteSpacesState.activeSpaceId)
        ? remoteSpacesState.activeSpaceId
        : (nextSpaces[0]?.id || ''),
  };

  const preparedPackage: BackupPackage = {
    ...remoteBackup,
    localStorageEntries: {
      ...remoteBackup.localStorageEntries,
      [STORAGE_KEYS.SPACES]: JSON.stringify(preparedSpacesState),
    },
  };

  return {
    package: preparedPackage,
    renamedSpaces,
    skippedSpaceConflicts,
  };
};

export const prepareMergePackageWithConflictCopies = (
  localBackup: BackupPackage,
  remoteBackup: BackupPackage,
  now: number = Date.now()
): MergeConflictPreparationResult => {
  const result = prepareMergePackageWithConflictPolicy(
    localBackup,
    remoteBackup,
    DEFAULT_CLOUD_SYNC_MERGE_CONFLICT_POLICY,
    now
  );

  if (result.skippedSpaceConflicts.length > 0) {
    return {
      ...result,
      skippedSpaceConflicts: [],
    };
  }
  return result;
};
