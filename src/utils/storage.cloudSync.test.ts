import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from './storage';

interface LocalStorageMock {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const createLocalStorageMock = (): LocalStorageMock => {
  const store = new Map<string, string>();

  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

describe('storage cloud sync config', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
    storage.resetMemoryCache();
  });

  it('persists webdav endpoint and username', () => {
    storage.saveWebDavEndpoint('https://dav.example.com/backup/eclipsetab.enc.json');
    storage.saveWebDavUsername('alice');

    expect(storage.getWebDavEndpoint()).toBe('https://dav.example.com/backup/eclipsetab.enc.json');
    expect(storage.getWebDavUsername()).toBe('alice');
  });

  it('persists latest backup and restore timestamps', () => {
    storage.saveCloudSyncLastBackupAt(1710000000000);
    storage.saveCloudSyncLastRestoreAt(1710000001234);

    expect(storage.getCloudSyncLastBackupAt()).toBe(1710000000000);
    expect(storage.getCloudSyncLastRestoreAt()).toBe(1710000001234);
  });
});

