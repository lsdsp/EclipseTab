import { describe, expect, it } from 'vitest';
import { DOCK_RECYCLE_LIMIT } from '../constants/recycle';
import { clampRecycleRecords, RECYCLE_RETENTION_MS } from './recycle';

describe('recycle helpers', () => {
  it('removes expired records and keeps newest entries', () => {
    const now = Date.now();
    const records = [
      { id: 'old', deletedAt: now - RECYCLE_RETENTION_MS - 1000 },
      { id: 'newer', deletedAt: now - 2000 },
      { id: 'newest', deletedAt: now - 1000 },
    ];

    const result = clampRecycleRecords(records, now);
    expect(result.map(item => item.id)).toEqual(['newest', 'newer']);
  });

  it('limits records to max recycle size', () => {
    const now = Date.now();
    const records = Array.from({ length: DOCK_RECYCLE_LIMIT + 5 }, (_, index) => ({
      id: `${index}`,
      deletedAt: now - index,
    }));

    const result = clampRecycleRecords(records, now, DOCK_RECYCLE_LIMIT);
    expect(result).toHaveLength(DOCK_RECYCLE_LIMIT);
    expect(result[0]?.id).toBe('0');
  });
});
