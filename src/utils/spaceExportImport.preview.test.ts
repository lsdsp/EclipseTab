import { describe, expect, it } from 'vitest';
import type { MultiSpaceExportData, SpaceExportData } from './spaceExportImport';
import {
  buildSpaceImportPreview,
  formatSpaceImportPreviewMessage,
  parseSpaceImportSelectionInput,
  pickMultiSpaceImportData,
} from './spaceExportImport';
import type { Space } from '../types';

const createSingleExport = (name: string): SpaceExportData => ({
  version: '1.0',
  schemaVersion: 1,
  type: 'eclipse-space-export',
  data: {
    name,
    iconType: 'text',
    apps: [
      { title: 'A', type: 'app', url: 'https://a.example' },
      {
        title: 'Folder',
        type: 'folder',
        children: [{ title: 'B', type: 'app', url: 'https://b.example' }],
      },
    ],
  },
});

const createMultiExport = (): MultiSpaceExportData => ({
  version: '1.0',
  schemaVersion: 1,
  type: 'eclipse-multi-space-export',
  data: {
    spaces: [
      createSingleExport('Main').data,
      createSingleExport('Work').data,
      createSingleExport('Focus').data,
    ],
  },
});

const existingSpaces: Space[] = [
  {
    id: 'space-1',
    name: 'Main',
    iconType: 'text',
    apps: [],
    createdAt: 1,
  },
];

describe('spaceExportImport preview helpers', () => {
  it('builds preview with rename conflict statistics', () => {
    const preview = buildSpaceImportPreview(
      { type: 'single', data: createSingleExport('Main') },
      existingSpaces
    );

    expect(preview.incomingSpaces).toBe(1);
    expect(preview.selectedSpaces).toBe(1);
    expect(preview.nameConflicts).toBe(1);
    expect(preview.items[0]?.finalName).toBe('Main (1)');
    expect(preview.totalAppItems).toBe(3);
  });

  it('parses mixed selection tokens', () => {
    expect(parseSpaceImportSelectionInput('1,3-4 6', 6)).toEqual([0, 2, 3, 5]);
  });

  it('throws for out-of-range selection', () => {
    expect(() => parseSpaceImportSelectionInput('1,9', 3)).toThrow('Selection out of range');
  });

  it('picks selected spaces from multi import data', () => {
    const multi = createMultiExport();
    const selected = pickMultiSpaceImportData(multi, [0, 2]);

    expect(selected.data.spaces).toHaveLength(2);
    expect(selected.data.spaces[0]?.name).toBe('Main');
    expect(selected.data.spaces[1]?.name).toBe('Focus');
    expect(selected.schemaVersion).toBe(1);
  });

  it('throws when selected indexes produce an empty subset', () => {
    const multi = createMultiExport();
    expect(() => pickMultiSpaceImportData(multi, [99])).toThrow('No spaces selected');
  });

  it('formats preview message with numbered list and rename hints', () => {
    const preview = buildSpaceImportPreview(
      { type: 'multi', data: createMultiExport() },
      existingSpaces
    );

    const message = formatSpaceImportPreviewMessage(preview, 'zh');
    expect(message).toContain('将导入空间：3 项');
    expect(message).toContain('重名冲突：1');
    expect(message).toContain('[1] Main -> Main (1)');
    expect(message).toContain('[2] Work');
  });

  it('formats preview message with truncation info', () => {
    const preview = buildSpaceImportPreview(
      { type: 'multi', data: createMultiExport() },
      existingSpaces
    );

    const message = formatSpaceImportPreviewMessage(preview, 'en', { maxItems: 1 });
    expect(message).toContain('[1]');
    expect(message).toContain('... 2 more');
  });
});
