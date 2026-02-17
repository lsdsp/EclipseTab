import { describe, expect, it } from 'vitest';
import { WallpaperItem } from '../utils/db';
import { sortRecentWallpapers } from './useWallpaperStorage';

const makeWallpaper = (id: string, createdAt: number): WallpaperItem => ({
  id,
  data: new Blob(['x'], { type: 'image/png' }),
  createdAt,
});

describe('useWallpaperStorage helpers', () => {
  it('returns at most six wallpapers sorted by createdAt desc', () => {
    const input = Array.from({ length: 8 }).map((_, index) =>
      makeWallpaper(`wallpaper_${index}`, index)
    );

    const result = sortRecentWallpapers(input);

    expect(result).toHaveLength(6);
    expect(result[0].id).toBe('wallpaper_7');
    expect(result[5].id).toBe('wallpaper_2');
  });
});

