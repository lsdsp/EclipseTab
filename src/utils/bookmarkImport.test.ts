import { describe, expect, it } from 'vitest';
import { DockItem } from '../types';
import { buildBookmarkImportPreview, createDockItemsFromBookmarks } from './bookmarkImport';

describe('bookmarkImport', () => {
  const existingDockItems: DockItem[] = [
    {
      id: 'a',
      name: 'Existing',
      url: 'https://example.com',
      type: 'app',
    },
  ];

  const tree = [
    {
      title: 'root',
      children: [
        { title: 'Same URL', url: 'example.com' },
        { title: 'Docs', url: 'https://docs.example.com' },
        { title: 'Sub docs', url: 'https://docs.example.com/help' },
        { title: 'Other', url: 'https://another.com/path' },
      ],
    },
  ];

  it('filters existing URLs and merges by domain when enabled', () => {
    const preview = buildBookmarkImportPreview(tree, existingDockItems, {
      limit: 10,
      mergeByDomain: true,
    });

    expect(preview.total).toBe(4);
    expect(preview.skippedExistingUrl).toBe(1);
    expect(preview.skippedDomainMerged).toBe(1);
    expect(preview.selected.map(item => item.url)).toEqual([
      'https://docs.example.com',
      'https://another.com/path',
    ]);
  });

  it('creates dock items from selected bookmarks', () => {
    const preview = buildBookmarkImportPreview(tree, existingDockItems, {
      limit: 2,
      mergeByDomain: false,
    });
    const items = createDockItemsFromBookmarks(preview.selected);

    expect(items).toHaveLength(2);
    expect(items[0]?.type).toBe('app');
    expect(items[0]?.url).toBe(preview.selected[0]?.url);
  });
});
