import { DockItem } from '../types';

const areDockItemsEqual = (left: DockItem, right: DockItem): boolean => {
    if (left === right) return true;
    if (
        left.id !== right.id ||
        left.name !== right.name ||
        left.url !== right.url ||
        left.icon !== right.icon ||
        left.type !== right.type
    ) {
        return false;
    }

    const leftItems = left.type === 'folder' ? left.items : undefined;
    const rightItems = right.type === 'folder' ? right.items : undefined;

    if (leftItems === rightItems) return true;
    if (!leftItems || !rightItems) return false;
    if (leftItems.length !== rightItems.length) return false;

    for (let index = 0; index < leftItems.length; index += 1) {
        if (!areDockItemsEqual(leftItems[index], rightItems[index])) {
            return false;
        }
    }

    return true;
};

export const areDockItemListsEqual = (left: DockItem[], right: DockItem[]): boolean => {
    if (left === right) return true;
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
        if (!areDockItemsEqual(left[index], right[index])) {
            return false;
        }
    }

    return true;
};

export const shouldSyncDockItemsToSpace = (
    dockItemsSpaceId: string,
    activeSpaceId: string,
    dockItems: DockItem[],
    currentSpaceApps: DockItem[]
): boolean => {
    if (dockItemsSpaceId !== activeSpaceId) {
        return false;
    }

    return !areDockItemListsEqual(dockItems, currentSpaceApps);
};
