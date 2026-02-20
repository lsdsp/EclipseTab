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

export interface MoveTargetResolveInput {
  activeStickerId: string;
  selectedStickerIds: string[];
  groupMap: Record<string, string | undefined>;
  lockedStickerIds: string[];
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
