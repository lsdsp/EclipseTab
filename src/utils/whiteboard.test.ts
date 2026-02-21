import { describe, expect, it } from 'vitest';
import {
  assignGroupToSelection,
  clearGroupFromSelection,
  computeGroupMovePositions,
  computeWidgetDockSnap,
  computeSelectionActionState,
  computeSnappedPosition,
  lockSelection,
  normalizeSelectionRect,
  rectOverlaps,
  resolveMoveStickerIds,
  toggleLockSelection,
  unlockSelection,
} from './whiteboard';

describe('whiteboard snap helpers', () => {
  it('aligns moving sticker edge within threshold', () => {
    const result = computeSnappedPosition({
      x: 196,
      y: 50,
      width: 100,
      height: 100,
      gridEnabled: false,
      gridSize: 12,
      targets: [
        { id: 'target', left: 200, top: 60, width: 100, height: 100 },
      ],
    });

    expect(result.x).toBe(200);
    expect(result.guides.some((guide) => guide.orientation === 'vertical' && guide.source === 'align')).toBe(true);
  });

  it('falls back to grid snapping when no alignment target matched', () => {
    const result = computeSnappedPosition({
      x: 53,
      y: 77,
      width: 40,
      height: 40,
      gridEnabled: true,
      gridSize: 10,
      targets: [],
    });

    expect(result.x).toBe(50);
    expect(result.y).toBe(80);
    expect(result.guides.filter((guide) => guide.source === 'grid')).toHaveLength(2);
  });

  it('snaps widget to neighbor edge when close enough', () => {
    const result = computeWidgetDockSnap({
      x: 304,
      y: 100,
      width: 120,
      height: 80,
      targets: [
        { id: 'widget-b', left: 180, top: 96, width: 120, height: 80 },
      ],
      threshold: 10,
    });

    expect(result.x).toBe(300);
    expect(result.y).toBe(100);
    expect(result.targetId).toBe('widget-b');
    expect(result.guides[0]?.orientation).toBe('vertical');
  });

  it('returns no widget dock match when overlap requirement is not met', () => {
    const result = computeWidgetDockSnap({
      x: 304,
      y: 260,
      width: 120,
      height: 80,
      targets: [
        { id: 'widget-b', left: 180, top: 96, width: 120, height: 80 },
      ],
      threshold: 10,
    });

    expect(result.targetId).toBeNull();
    expect(result.x).toBe(304);
    expect(result.y).toBe(260);
    expect(result.guides).toEqual([]);
  });
});

describe('whiteboard group and lock helpers', () => {
  it('assigns and clears group map entries for selected stickers', () => {
    const grouped = assignGroupToSelection({}, ['a', 'b'], 'g1');
    expect(grouped).toEqual({ a: 'g1', b: 'g1' });

    const cleared = clearGroupFromSelection(grouped, ['a']);
    expect(cleared).toEqual({ b: 'g1' });
  });

  it('toggles lock state for selected stickers', () => {
    const locked = toggleLockSelection([], ['a', 'b']);
    expect(locked.sort()).toEqual(['a', 'b']);

    const unlocked = toggleLockSelection(locked, ['a', 'b']);
    expect(unlocked).toHaveLength(0);
  });

  it('locks and unlocks selection explicitly', () => {
    const locked = lockSelection(['x'], ['a', 'b']);
    expect(locked.sort()).toEqual(['a', 'b', 'x']);

    const unlocked = unlockSelection(locked, ['a', 'x']);
    expect(unlocked).toEqual(['b']);
  });

  it('resolves move ids by selection first, then by group, and excludes locked stickers', () => {
    const bySelection = resolveMoveStickerIds({
      activeStickerId: 'a',
      selectedStickerIds: ['a', 'b'],
      groupMap: { a: 'g1', b: 'g1', c: 'g1' },
      lockedStickerIds: ['b'],
    });
    expect(bySelection).toEqual(['a']);

    const byGroup = resolveMoveStickerIds({
      activeStickerId: 'c',
      selectedStickerIds: ['c'],
      groupMap: { a: 'g1', b: 'g1', c: 'g1' },
      lockedStickerIds: ['b'],
    });
    expect(byGroup.sort()).toEqual(['a', 'c']);
  });

  it('computes group move positions from drag session baseline', () => {
    const positions = computeGroupMovePositions({
      activeStickerId: 'a',
      moveTargetIds: ['a', 'b'],
      basePositions: {
        a: { x: 100, y: 100 },
        b: { x: 180, y: 120 },
      },
    }, 140, 160);

    expect(positions).toEqual([
      { id: 'a', x: 140, y: 160 },
      { id: 'b', x: 220, y: 180 },
    ]);
  });

  it('skips targets without baseline and returns empty when active baseline is missing', () => {
    const partial = computeGroupMovePositions({
      activeStickerId: 'a',
      moveTargetIds: ['a', 'b'],
      basePositions: {
        a: { x: 10, y: 20 },
      },
    }, 20, 40);
    expect(partial).toEqual([{ id: 'a', x: 20, y: 40 }]);

    const missingActive = computeGroupMovePositions({
      activeStickerId: 'x',
      moveTargetIds: ['x', 'y'],
      basePositions: {
        y: { x: 1, y: 2 },
      },
    }, 30, 40);
    expect(missingActive).toEqual([]);
  });

  it('computes selection action state for group/lock operations', () => {
    const state = computeSelectionActionState({
      selectedStickerIds: ['a', 'b'],
      groupMap: { a: 'g1' },
      lockedStickerIds: ['a'],
    });

    expect(state).toEqual({
      hasSelection: true,
      canGroup: true,
      canUngroup: true,
      canLock: true,
      canUnlock: true,
    });
  });
});

describe('whiteboard selection rect helpers', () => {
  it('normalizes selection rect regardless of drag direction', () => {
    const rect = normalizeSelectionRect(100, 200, 40, 20);
    expect(rect).toEqual({ left: 40, top: 20, right: 100, bottom: 200 });
  });

  it('detects overlap correctly', () => {
    const overlapped = rectOverlaps(
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 90, top: 90, right: 160, bottom: 160 }
    );
    const separated = rectOverlaps(
      { left: 0, top: 0, right: 50, bottom: 50 },
      { left: 60, top: 60, right: 100, bottom: 100 }
    );

    expect(overlapped).toBe(true);
    expect(separated).toBe(false);
  });
});
