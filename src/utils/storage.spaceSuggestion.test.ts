import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, storage } from './storage';

interface LocalStorageMock {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
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
  };
};

describe('storage space suggestion config', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
    storage.resetMemoryCache();
  });

  it('provides defaults for cooldown and quiet hours', () => {
    expect(storage.getSpaceSuggestionCooldownMinutes()).toBe(10);
    expect(storage.getSpaceSuggestionQuietHoursEnabled()).toBe(true);
    expect(storage.getSpaceSuggestionQuietStartMinute()).toBe(23 * 60);
    expect(storage.getSpaceSuggestionQuietEndMinute()).toBe(7 * 60);
  });

  it('persists updated suggestion config', () => {
    storage.saveSpaceSuggestionCooldownMinutes(15);
    storage.saveSpaceSuggestionQuietHoursEnabled(false);
    storage.saveSpaceSuggestionQuietStartMinute(22 * 60);
    storage.saveSpaceSuggestionQuietEndMinute(8 * 60);

    storage.resetMemoryCache();
    expect(storage.getSpaceSuggestionCooldownMinutes()).toBe(15);
    expect(storage.getSpaceSuggestionQuietHoursEnabled()).toBe(false);
    expect(storage.getSpaceSuggestionQuietStartMinute()).toBe(22 * 60);
    expect(storage.getSpaceSuggestionQuietEndMinute()).toBe(8 * 60);

    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    expect(raw).toBeTruthy();
  });

  it('clamps invalid values into safe bounds', () => {
    storage.saveSpaceSuggestionCooldownMinutes(0);
    storage.saveSpaceSuggestionQuietStartMinute(2000);
    storage.saveSpaceSuggestionQuietEndMinute(-10);

    expect(storage.getSpaceSuggestionCooldownMinutes()).toBe(1);
    expect(storage.getSpaceSuggestionQuietStartMinute()).toBe(1439);
    expect(storage.getSpaceSuggestionQuietEndMinute()).toBe(0);
  });
});
