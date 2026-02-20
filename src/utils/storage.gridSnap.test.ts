import { beforeEach, describe, expect, it } from 'vitest';
import { storage, STORAGE_KEYS } from './storage';

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

describe('storage grid snap config', () => {
  beforeEach(() => {
    const mocked = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mocked,
      configurable: true,
      writable: true,
    });
    storage.resetMemoryCache();
  });

  it('defaults grid snap to enabled when config is missing', () => {
    expect(storage.getGridSnapEnabled()).toBe(true);
  });

  it('persists grid snap toggle in app config', () => {
    storage.saveGridSnapEnabled(false);

    storage.resetMemoryCache();
    expect(storage.getGridSnapEnabled()).toBe(false);

    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw || '{}');
    expect(parsed.gridSnapEnabled).toBe(false);
  });

  it('keeps backward compatibility when config lacks grid snap field', () => {
    localStorage.setItem(
      STORAGE_KEYS.CONFIG,
      JSON.stringify({
        theme: 'dark',
        followSystem: false,
        dockPosition: 'center',
        iconSize: 'small',
        openInNewTab: true,
      })
    );

    storage.resetMemoryCache();
    expect(storage.getGridSnapEnabled()).toBe(true);
  });
});

