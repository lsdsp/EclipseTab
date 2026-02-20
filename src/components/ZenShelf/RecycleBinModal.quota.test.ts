import { describe, expect, it } from 'vitest';
import { DOCK_RECYCLE_LIMIT, SPACE_RECYCLE_LIMIT, STICKER_RECYCLE_LIMIT } from '../../constants/recycle';
import {
  buildRecycleBinQuotaText,
  buildRecycleBinUsageText,
  DEFAULT_RECYCLE_VIEW,
  getRecycleViewLabel,
} from './RecycleBinModal';

describe('buildRecycleBinQuotaText', () => {
  it('builds zh quota text with limits', () => {
    const text = buildRecycleBinQuotaText('zh', {
      stickers: 3,
      dock: 5,
      spaces: 2,
    });

    expect(text).toBe(
      `配额：贴纸 3/${STICKER_RECYCLE_LIMIT} · Dock 5/${DOCK_RECYCLE_LIMIT} · 空间 2/${SPACE_RECYCLE_LIMIT}`
    );
  });

  it('builds en quota text with limits', () => {
    const text = buildRecycleBinQuotaText('en', {
      stickers: 7,
      dock: 1,
      spaces: 0,
    });

    expect(text).toBe(
      `Quota: Stickers 7/${STICKER_RECYCLE_LIMIT} · Dock 1/${DOCK_RECYCLE_LIMIT} · Space 0/${SPACE_RECYCLE_LIMIT}`
    );
  });
});

describe('buildRecycleBinUsageText', () => {
  it('builds zh recycle usage text', () => {
    const text = buildRecycleBinUsageText('zh', 2048);
    expect(text).toBe('回收站占用：2.0 KB');
  });

  it('builds en recycle usage text', () => {
    const text = buildRecycleBinUsageText('en', 500);
    expect(text).toBe('Recycle usage: 500 B');
  });
});

describe('getRecycleViewLabel', () => {
  it('uses stickers as default recycle view', () => {
    expect(DEFAULT_RECYCLE_VIEW).toBe('stickers');
  });

  it('returns zh labels with 空间 for space view', () => {
    expect(getRecycleViewLabel('zh', 'stickers')).toBe('贴纸');
    expect(getRecycleViewLabel('zh', 'dock')).toBe('Dock');
    expect(getRecycleViewLabel('zh', 'space')).toBe('空间');
  });
});
