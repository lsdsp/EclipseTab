import { describe, expect, it } from 'vitest';
import { DockItem } from '../types';
import { areDockItemListsEqual, shouldSyncDockItemsToSpace } from './dockSync';

const makeApp = (id: string, name: string): DockItem => ({
  id,
  name,
  type: 'app',
  url: `https://${id}.example.com`,
  icon: `${id}-icon`,
});

describe('dockSync', () => {
  it('treats deeply equal dock item lists as equal', () => {
    const left: DockItem[] = [
      makeApp('a', 'A'),
      {
        id: 'folder-1',
        name: 'Folder',
        type: 'folder',
        items: [makeApp('b', 'B'), makeApp('c', 'C')],
      },
    ];
    const right: DockItem[] = [
      makeApp('a', 'A'),
      {
        id: 'folder-1',
        name: 'Folder',
        type: 'folder',
        items: [makeApp('b', 'B'), makeApp('c', 'C')],
      },
    ];

    expect(areDockItemListsEqual(left, right)).toBe(true);
  });

  it('detects differences inside nested folder items', () => {
    const left: DockItem[] = [
      {
        id: 'folder-1',
        name: 'Folder',
        type: 'folder',
        items: [makeApp('b', 'B')],
      },
    ];
    const right: DockItem[] = [
      {
        id: 'folder-1',
        name: 'Folder',
        type: 'folder',
        items: [makeApp('b', 'B updated')],
      },
    ];

    expect(areDockItemListsEqual(left, right)).toBe(false);
  });

  it('skips sync when dock state belongs to a different space', () => {
    const items = [makeApp('a', 'A')];
    const shouldSync = shouldSyncDockItemsToSpace('space-old', 'space-new', items, []);
    expect(shouldSync).toBe(false);
  });

  it('syncs when active space matches and app list has changed', () => {
    const localItems = [makeApp('a', 'A')];
    const spaceItems = [makeApp('x', 'X')];
    const shouldSync = shouldSyncDockItemsToSpace(
      'space-main',
      'space-main',
      localItems,
      spaceItems
    );

    expect(shouldSync).toBe(true);
  });
});
