export interface GuideTargetRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AlignmentGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  source: 'align' | 'grid';
}

export interface SnapComputationInput {
  x: number;
  y: number;
  width: number;
  height: number;
  targets: GuideTargetRect[];
  gridEnabled: boolean;
  gridSize: number;
  threshold?: number;
}

export interface SnapComputationResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

export interface WidgetDockSnapInput {
  x: number;
  y: number;
  width: number;
  height: number;
  targets: GuideTargetRect[];
  threshold?: number;
  minOverlapRatio?: number;
}

export interface WidgetDockSnapResult {
  x: number;
  y: number;
  targetId: string | null;
  guides: AlignmentGuide[];
}

export interface MoveTargetResolveInput {
  activeStickerId: string;
  selectedStickerIds: string[];
  groupMap: Record<string, string | undefined>;
  lockedStickerIds: string[];
}

export interface GroupMoveSession {
  activeStickerId: string;
  moveTargetIds: string[];
  basePositions: Record<string, { x: number; y: number }>;
}

export interface GroupMovePosition {
  id: string;
  x: number;
  y: number;
}

export interface SelectionActionState {
  hasSelection: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  canLock: boolean;
  canUnlock: boolean;
}

const getAnchors = (start: number, size: number) => ({
  start,
  center: start + size / 2,
  end: start + size,
});

const alignAxis = (
  movingStart: number,
  movingSize: number,
  targets: Array<{ start: number; center: number; end: number }>,
  threshold: number
): { nextStart: number; guide: number | null } => {
  const movingAnchors = getAnchors(movingStart, movingSize);
  const movingValues = [movingAnchors.start, movingAnchors.center, movingAnchors.end];

  let bestDiff = Number.POSITIVE_INFINITY;
  let alignedStart = movingStart;
  let guide: number | null = null;

  targets.forEach((targetAnchors) => {
    const targetValues = [targetAnchors.start, targetAnchors.center, targetAnchors.end];
    movingValues.forEach((movingAnchor, index) => {
      const diff = targetValues[index] - movingAnchor;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold && absDiff < bestDiff) {
        bestDiff = absDiff;
        alignedStart = movingStart + diff;
        guide = targetValues[index];
      }
    });
  });

  return { nextStart: alignedStart, guide };
};

const overlapLength = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
};

export const computeSnappedPosition = (input: SnapComputationInput): SnapComputationResult => {
  const threshold = input.threshold ?? 6;
  const verticalTargets = input.targets.map((target) => getAnchors(target.left, target.width));
  const horizontalTargets = input.targets.map((target) => getAnchors(target.top, target.height));

  const verticalAligned = alignAxis(input.x, input.width, verticalTargets, threshold);
  const horizontalAligned = alignAxis(input.y, input.height, horizontalTargets, threshold);

  let nextX = verticalAligned.nextStart;
  let nextY = horizontalAligned.nextStart;
  const guides: AlignmentGuide[] = [];

  if (verticalAligned.guide !== null) {
    guides.push({ orientation: 'vertical', position: verticalAligned.guide, source: 'align' });
  }
  if (horizontalAligned.guide !== null) {
    guides.push({ orientation: 'horizontal', position: horizontalAligned.guide, source: 'align' });
  }

  if (input.gridEnabled && input.gridSize > 0) {
    if (verticalAligned.guide === null) {
      nextX = Math.round(nextX / input.gridSize) * input.gridSize;
      guides.push({ orientation: 'vertical', position: nextX, source: 'grid' });
    }
    if (horizontalAligned.guide === null) {
      nextY = Math.round(nextY / input.gridSize) * input.gridSize;
      guides.push({ orientation: 'horizontal', position: nextY, source: 'grid' });
    }
  }

  return {
    x: nextX,
    y: nextY,
    guides,
  };
};

export const computeWidgetDockSnap = (input: WidgetDockSnapInput): WidgetDockSnapResult => {
  const threshold = input.threshold ?? 14;
  const minOverlapRatio = input.minOverlapRatio ?? 0.3;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestX = input.x;
  let bestY = input.y;
  let bestTargetId: string | null = null;
  let bestGuide: AlignmentGuide | null = null;

  input.targets.forEach((target) => {
    const movingTop = input.y;
    const movingBottom = input.y + input.height;
    const movingLeft = input.x;
    const movingRight = input.x + input.width;

    const targetTop = target.top;
    const targetBottom = target.top + target.height;
    const targetLeft = target.left;
    const targetRight = target.left + target.width;

    const minVerticalOverlap = Math.min(input.height, target.height) * minOverlapRatio;
    const verticalOverlap = overlapLength(movingTop, movingBottom, targetTop, targetBottom);
    if (verticalOverlap >= minVerticalOverlap) {
      const dockToLeft = targetLeft - input.width;
      const leftDistance = Math.abs(movingLeft - dockToLeft);
      if (leftDistance <= threshold && leftDistance < bestDistance) {
        bestDistance = leftDistance;
        bestX = dockToLeft;
        bestY = input.y;
        bestTargetId = target.id;
        bestGuide = { orientation: 'vertical', position: targetLeft, source: 'align' };
      }

      const dockToRight = targetRight;
      const rightDistance = Math.abs(movingLeft - dockToRight);
      if (rightDistance <= threshold && rightDistance < bestDistance) {
        bestDistance = rightDistance;
        bestX = dockToRight;
        bestY = input.y;
        bestTargetId = target.id;
        bestGuide = { orientation: 'vertical', position: targetRight, source: 'align' };
      }
    }

    const minHorizontalOverlap = Math.min(input.width, target.width) * minOverlapRatio;
    const horizontalOverlap = overlapLength(movingLeft, movingRight, targetLeft, targetRight);
    if (horizontalOverlap >= minHorizontalOverlap) {
      const dockToTop = targetTop - input.height;
      const topDistance = Math.abs(movingTop - dockToTop);
      if (topDistance <= threshold && topDistance < bestDistance) {
        bestDistance = topDistance;
        bestX = input.x;
        bestY = dockToTop;
        bestTargetId = target.id;
        bestGuide = { orientation: 'horizontal', position: targetTop, source: 'align' };
      }

      const dockToBottom = targetBottom;
      const bottomDistance = Math.abs(movingTop - dockToBottom);
      if (bottomDistance <= threshold && bottomDistance < bestDistance) {
        bestDistance = bottomDistance;
        bestX = input.x;
        bestY = dockToBottom;
        bestTargetId = target.id;
        bestGuide = { orientation: 'horizontal', position: targetBottom, source: 'align' };
      }
    }
  });

  if (!bestTargetId || !bestGuide) {
    return {
      x: input.x,
      y: input.y,
      targetId: null,
      guides: [],
    };
  }

  return {
    x: bestX,
    y: bestY,
    targetId: bestTargetId,
    guides: [bestGuide],
  };
};

export const createRuntimeGroupId = (): string => {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const assignGroupToSelection = (
  groupMap: Record<string, string | undefined>,
  selectedStickerIds: string[],
  groupId: string
): Record<string, string | undefined> => {
  if (selectedStickerIds.length === 0) return groupMap;
  const next: Record<string, string | undefined> = { ...groupMap };
  selectedStickerIds.forEach((id) => {
    next[id] = groupId;
  });
  return next;
};

export const clearGroupFromSelection = (
  groupMap: Record<string, string | undefined>,
  selectedStickerIds: string[]
): Record<string, string | undefined> => {
  if (selectedStickerIds.length === 0) return groupMap;
  const next: Record<string, string | undefined> = { ...groupMap };
  selectedStickerIds.forEach((id) => {
    delete next[id];
  });
  return next;
};

export const toggleLockSelection = (
  lockedStickerIds: string[],
  selectedStickerIds: string[]
): string[] => {
  if (selectedStickerIds.length === 0) return lockedStickerIds;

  const lockedSet = new Set(lockedStickerIds);
  const allLocked = selectedStickerIds.every((id) => lockedSet.has(id));
  if (allLocked) {
    selectedStickerIds.forEach((id) => lockedSet.delete(id));
  } else {
    selectedStickerIds.forEach((id) => lockedSet.add(id));
  }

  return Array.from(lockedSet);
};

export const lockSelection = (
  lockedStickerIds: string[],
  selectedStickerIds: string[]
): string[] => {
  if (selectedStickerIds.length === 0) return lockedStickerIds;
  const lockedSet = new Set(lockedStickerIds);
  selectedStickerIds.forEach((id) => lockedSet.add(id));
  return Array.from(lockedSet);
};

export const unlockSelection = (
  lockedStickerIds: string[],
  selectedStickerIds: string[]
): string[] => {
  if (selectedStickerIds.length === 0) return lockedStickerIds;
  const lockedSet = new Set(lockedStickerIds);
  selectedStickerIds.forEach((id) => lockedSet.delete(id));
  return Array.from(lockedSet);
};

export const computeSelectionActionState = (input: {
  selectedStickerIds: string[];
  groupMap: Record<string, string | undefined>;
  lockedStickerIds: string[];
}): SelectionActionState => {
  const { selectedStickerIds, groupMap, lockedStickerIds } = input;
  const hasSelection = selectedStickerIds.length > 0;
  const canGroup = selectedStickerIds.length >= 2;
  const canUngroup = selectedStickerIds.some((id) => Boolean(groupMap[id]));
  const lockedSet = new Set(lockedStickerIds);
  const anyLocked = selectedStickerIds.some((id) => lockedSet.has(id));
  const allLocked = hasSelection && selectedStickerIds.every((id) => lockedSet.has(id));

  return {
    hasSelection,
    canGroup,
    canUngroup,
    canLock: hasSelection && !allLocked,
    canUnlock: hasSelection && anyLocked,
  };
};

export const resolveMoveStickerIds = (input: MoveTargetResolveInput): string[] => {
  const lockedSet = new Set(input.lockedStickerIds);

  if (input.selectedStickerIds.length > 1 && input.selectedStickerIds.includes(input.activeStickerId)) {
    return input.selectedStickerIds.filter((id) => !lockedSet.has(id));
  }

  const activeGroupId = input.groupMap[input.activeStickerId];
  if (activeGroupId) {
    return Object.entries(input.groupMap)
      .filter(([, groupId]) => groupId === activeGroupId)
      .map(([id]) => id)
      .filter((id) => !lockedSet.has(id));
  }

  return lockedSet.has(input.activeStickerId) ? [] : [input.activeStickerId];
};

export const computeGroupMovePositions = (
  session: GroupMoveSession,
  activeX: number,
  activeY: number
): GroupMovePosition[] => {
  const activeBase = session.basePositions[session.activeStickerId];
  if (!activeBase) return [];

  const dx = activeX - activeBase.x;
  const dy = activeY - activeBase.y;

  return session.moveTargetIds
    .map((id) => {
      const base = session.basePositions[id];
      if (!base) return null;
      return {
        id,
        x: base.x + dx,
        y: base.y + dy,
      };
    })
    .filter((item): item is GroupMovePosition => item !== null);
};

export const normalizeSelectionRect = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): { left: number; top: number; right: number; bottom: number } => {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    right: Math.max(startX, currentX),
    bottom: Math.max(startY, currentY),
  };
};

export const rectOverlaps = (
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number }
): boolean => {
  return !(
    first.right < second.left ||
    first.left > second.right ||
    first.bottom < second.top ||
    first.top > second.bottom
  );
};
