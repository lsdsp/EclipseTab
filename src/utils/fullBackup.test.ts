/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSpaceSnapshotEntries } from './fullBackup';
import { STORAGE_KEYS } from './storage';
import { Space } from '../types';

describe('fullBackup snapshot entries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('builds per-space snapshot entries and filters recycle data', () => {
    const target: Space = {
      id: 'space_target',
      name: 'Work',
      iconType: 'text',
      apps: [{ id: 'dock_1', name: 'A', url: 'https://a.com', type: 'app' }],
      createdAt: Date.now(),
    };

    localStorage.setItem(STORAGE_KEYS.SPACES, JSON.stringify({
      spaces: [
        target,
        { ...target, id: 'space_other', name: 'Other' },
      ],
      activeSpaceId: 'space_other',
      version: 1,
    }));
    localStorage.setItem(STORAGE_KEYS.DELETED_DOCK_ITEMS, JSON.stringify([
      { id: 'd1', deletedAt: Date.now(), spaceId: 'space_target', originalIndex: 0, item: target.apps[0] },
      { id: 'd2', deletedAt: Date.now(), spaceId: 'space_other', originalIndex: 0, item: target.apps[0] },
    ]));
    localStorage.setItem(STORAGE_KEYS.DELETED_SPACES, JSON.stringify([
      { id: 's1', deletedAt: Date.now(), originalIndex: 0, space: target },
      { id: 's2', deletedAt: Date.now(), originalIndex: 0, space: { ...target, id: 'space_other', name: 'Other' } },
    ]));

    const entries = buildSpaceSnapshotEntries(target);
    const spacesState = JSON.parse(entries[STORAGE_KEYS.SPACES] || '{}');
    const deletedDock = JSON.parse(entries[STORAGE_KEYS.DELETED_DOCK_ITEMS] || '[]');
    const deletedSpaces = JSON.parse(entries[STORAGE_KEYS.DELETED_SPACES] || '[]');

    expect(spacesState.spaces).toHaveLength(1);
    expect(spacesState.spaces[0].id).toBe('space_target');
    expect(deletedDock).toHaveLength(1);
    expect(deletedDock[0].spaceId).toBe('space_target');
    expect(deletedSpaces).toHaveLength(1);
    expect(deletedSpaces[0].space.id).toBe('space_target');
  });
});
