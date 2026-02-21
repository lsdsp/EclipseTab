import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, storage } from './storage';

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

describe('storage space overrides', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
    storage.resetMemoryCache();
  });

  it('returns empty overrides by default', () => {
    expect(storage.getSpaceOverrides()).toEqual({});
    expect(storage.getSpaceOverride('space-1')).toBeNull();
  });

  it('persists and reads normalized overrides', () => {
    storage.updateSpaceOverride('space-1', {
      searchEngineId: ' google ',
      dockPosition: 'center',
      theme: 'dark',
    });

    const override = storage.getSpaceOverride('space-1');
    expect(override).toEqual({
      searchEngineId: 'google',
      dockPosition: 'center',
      theme: 'dark',
    });

    const raw = localStorage.getItem(STORAGE_KEYS.SPACE_OVERRIDES);
    expect(raw).toBeTruthy();
  });

  it('drops invalid fields and removes empty override records', () => {
    storage.updateSpaceOverride('space-1', {
      searchEngineId: 'engine-a',
      dockPosition: 'bottom',
      theme: 'light',
    });

    storage.updateSpaceOverride('space-1', {
      searchEngineId: '',
      dockPosition: undefined,
      theme: undefined,
    });

    expect(storage.getSpaceOverride('space-1')).toBeNull();
    expect(storage.getSpaceOverrides()).toEqual({});
  });

  it('removes overrides explicitly', () => {
    storage.updateSpaceOverride('space-1', { searchEngineId: 'engine-a' });
    storage.removeSpaceOverride('space-1');
    expect(storage.getSpaceOverride('space-1')).toBeNull();
  });
});

