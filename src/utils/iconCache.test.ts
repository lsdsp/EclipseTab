import { describe, expect, it } from 'vitest';
import {
  clearIconCache,
  createIconCacheKey,
  getCachedIcon,
  getCacheSize,
  setCachedIcon,
} from './iconCache';

describe('iconCache', () => {
  it('builds deterministic cache keys by domain and minSize', () => {
    expect(createIconCacheKey('example.com', 0, false)).toBe('example.com:0:local');
    expect(createIconCacheKey('example.com', 100, true)).toBe('example.com:100:ext');
    expect(createIconCacheKey('example.com', -1, false)).toBe('example.com:0:local');
  });

  it('isolates cached icons by minSize for the same domain', () => {
    clearIconCache();

    setCachedIcon('example.com', 0, { url: 'small-icon', isFallback: false }, false);
    setCachedIcon('example.com', 128, { url: 'large-icon', isFallback: false }, false);

    expect(getCachedIcon('example.com', 0, false)).toEqual({
      url: 'small-icon',
      isFallback: false,
    });
    expect(getCachedIcon('example.com', 128, false)).toEqual({
      url: 'large-icon',
      isFallback: false,
    });
  });

  it('separates cache entries by third-party strategy', () => {
    clearIconCache();

    setCachedIcon('example.com', 64, { url: 'local-icon', isFallback: false }, false);
    setCachedIcon('example.com', 64, { url: 'ext-icon', isFallback: false }, true);

    expect(getCachedIcon('example.com', 64, false)?.url).toBe('local-icon');
    expect(getCachedIcon('example.com', 64, true)?.url).toBe('ext-icon');
  });

  it('clears all cached entries', () => {
    clearIconCache();
    setCachedIcon('example.com', 32, { url: 'icon', isFallback: false }, false);
    expect(getCacheSize()).toBe(1);

    clearIconCache();
    expect(getCacheSize()).toBe(0);
    expect(getCachedIcon('example.com', 32, false)).toBeUndefined();
  });
});
