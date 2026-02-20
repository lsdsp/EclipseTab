import { DockItem } from './dock';
import { Space } from './space';
import { DOCK_RECYCLE_LIMIT } from '../constants/recycle';

export interface DeletedDockItemRecord {
  id: string;
  deletedAt: number;
  spaceId: string;
  originalIndex: number;
  item: DockItem;
  parentFolderId?: string;
}

export interface DeletedSpaceRecord {
  id: string;
  deletedAt: number;
  originalIndex: number;
  space: Space;
}

export const MAX_RECYCLE_ITEMS = DOCK_RECYCLE_LIMIT;
export const RECYCLE_RETENTION_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

export const clampRecycleRecords = <T extends { deletedAt: number }>(
  records: T[],
  now: number = Date.now(),
  limit: number = MAX_RECYCLE_ITEMS
): T[] => {
  const cutoff = now - RECYCLE_RETENTION_MS;
  const normalizedLimit = Math.max(0, Math.floor(limit));
  return records
    .filter((record) => record.deletedAt >= cutoff)
    .sort((a, b) => b.deletedAt - a.deletedAt)
    .slice(0, normalizedLimit);
};
