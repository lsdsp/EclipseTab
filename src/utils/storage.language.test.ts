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

describe('storage language migration', () => {
  beforeEach(() => {
    const mocked = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mocked,
      configurable: true,
      writable: true,
    });
    storage.resetMemoryCache();
  });

  it('defaults to english when no config and no legacy language', () => {
    expect(storage.getLanguage()).toBe('en');
  });

  it('migrates legacy app_language when config is missing', () => {
    localStorage.setItem('app_language', 'zh');

    expect(storage.getLanguage()).toBe('zh');

    const configRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    expect(configRaw).toBeTruthy();
    const config = JSON.parse(configRaw || '{}');
    expect(config.language).toBe('zh');
    expect(localStorage.getItem('app_language')).toBeNull();
  });

  it('applies legacy app_language into existing config when language is absent', () => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({
      theme: 'dark',
      followSystem: false,
      dockPosition: 'center',
      iconSize: 'small',
      openInNewTab: true,
    }));
    localStorage.setItem('app_language', 'zh');

    expect(storage.getLanguage()).toBe('zh');

    const configRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const config = JSON.parse(configRaw || '{}');
    expect(config.language).toBe('zh');
    expect(localStorage.getItem('app_language')).toBeNull();
  });

  it('saveLanguage persists to config and clears legacy key', () => {
    localStorage.setItem('app_language', 'zh');

    storage.saveLanguage('en');
    storage.resetMemoryCache();

    expect(storage.getLanguage()).toBe('en');
    expect(localStorage.getItem('app_language')).toBeNull();
  });
});

