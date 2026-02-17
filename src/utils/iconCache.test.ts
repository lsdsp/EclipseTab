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
    expect(createIconCacheKey('example.com', 0)).toBe('example.com:0');
    expect(createIconCacheKey('example.com', 100)).toBe('example.com:100');
    expect(createIconCacheKey('example.com', -1)).toBe('example.com:0');
  });

  it('isolates cached icons by minSize for the same domain', () => {
    clearIconCache();

    setCachedIcon('example.com', 0, { url: 'small-icon', isFallback: false });
    setCachedIcon('example.com', 128, { url: 'large-icon', isFallback: false });

    expect(getCachedIcon('example.com', 0)).toEqual({
      url: 'small-icon',
      isFallback: false,
    });
    expect(getCachedIcon('example.com', 128)).toEqual({
      url: 'large-icon',
      isFallback: false,
    });
  });

  it('clears all cached entries', () => {
    clearIconCache();
    setCachedIcon('example.com', 32, { url: 'icon', isFallback: false });
    expect(getCacheSize()).toBe(1);

    clearIconCache();
    expect(getCacheSize()).toBe(0);
    expect(getCachedIcon('example.com', 32)).toBeUndefined();
  });
});
