import { describe, expect, it } from 'vitest';
import { DeletedDockItemRecord, DeletedSpaceRecord, Sticker } from '../types';
import { estimateRecycleBytes, formatBytes, summarizeRecycleCounts } from './storageDashboard';

describe('storageDashboard helpers', () => {
  it('formats bytes into human readable string', () => {
    expect(formatBytes(null)).toBe('--');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('summarizes recycle counts', () => {
    const deletedSticker = { id: 's', deletedAt: Date.now() } as unknown as Sticker;
    const deletedDock = { id: 'd', deletedAt: Date.now() } as unknown as DeletedDockItemRecord;
    const deletedSpace = { id: 'p', deletedAt: Date.now() } as unknown as DeletedSpaceRecord;

    const total = summarizeRecycleCounts(
      [deletedSticker],
      [deletedDock],
      [deletedSpace]
    );
    expect(total).toBe(3);
  });

  it('estimates recycle bytes from deleted payloads', () => {
    const deletedSticker = { id: 's', deletedAt: 1 } as unknown as Sticker;
    const deletedDock = { id: 'd', deletedAt: 2 } as unknown as DeletedDockItemRecord;
    const deletedSpace = { id: 'p', deletedAt: 3 } as unknown as DeletedSpaceRecord;

    const bytes = estimateRecycleBytes([deletedDock], [deletedSpace], [deletedSticker]);
    expect(bytes).toBeGreaterThan(0);
  });
});
