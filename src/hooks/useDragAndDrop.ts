import { useState, useEffect, useRef, useCallback } from 'react';
import { DockItem } from '../types';
import { useDragBase, createDockDragState, resetDockDragState, DockDragState } from './useDragBase';
import { createMouseDownHandler } from '../utils/dragUtils';

interface UseDragAndDropOptions {
    items: DockItem[];
    isEditMode: boolean;
    onReorder: (items: DockItem[]) => void;
    onDropToFolder?: (dragItem: DockItem, targetFolder: DockItem) => void;
    onMergeFolder?: (dragItem: DockItem, targetItem: DockItem) => void;
    onDragToOpenFolder?: (dragItem: DockItem) => void;
    onHoverOpenFolder?: (dragItem: DockItem, targetFolder: DockItem) => void;
    onDragStart?: (item: DockItem) => void;
    onDragEnd?: () => void;
    externalDragItem?: DockItem | null;
}

export const useDragAndDrop = ({
    items,
    isEditMode,
    onReorder,
    onDropToFolder,
    onMergeFolder,
    onDragToOpenFolder,
    onHoverOpenFolder,
    onDragStart,
    onDragEnd,
    externalDragItem,
}: UseDragAndDropOptions) => {
    // 使用基础 Hook
    const {
        dragState,
        setDragState,
        placeholderIndex,
        setPlaceholderIndex,
        itemRefs,
        dragRef,
        itemsRef,
        placeholderRef,
        hasMovedRef,
        thresholdListenerRef,
        startDragging,
    } = useDragBase<DockDragState>({
        items,
        isEditMode,
        onDragStart,
        onDragEnd,
        externalDragItem,
        createInitialState: createDockDragState,
        resetState: resetDockDragState,
    });

    // Dock 特有的状态
    const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
    const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
    const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
    const [isPreMerge, setIsPreMerge] = useState(false);
    const [isOverFolderView, setIsOverFolderView] = useState(false);

    // Refs
    const dockRef = useRef<HTMLElement | null>(null);
    const hoveredFolderRef = useRef<string | null>(null);
    const hoveredAppRef = useRef<string | null>(null);
    const mergeTargetRef = useRef<string | null>(null);
    const isPreMergeRef = useRef(false);
    const hoverStartTime = useRef<number>(0);
    const potentialMergeTarget = useRef<string | null>(null);

    // 同步 Refs
    useEffect(() => { hoveredFolderRef.current = hoveredFolderId; }, [hoveredFolderId]);
    useEffect(() => { hoveredAppRef.current = hoveredAppId; }, [hoveredAppId]);
    useEffect(() => { mergeTargetRef.current = mergeTargetId; }, [mergeTargetId]);
    useEffect(() => { isPreMergeRef.current = isPreMerge; }, [isPreMerge]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const state = dragRef.current;
        const activeItem = state.isDragging ? state.item : externalDragItem;

        // Check if we should start dragging (only for internal items)
        if (!state.isDragging && !externalDragItem && state.item) {
            const dist = Math.hypot(e.clientX - state.startPosition.x, e.clientY - state.startPosition.y);
            if (dist > 8) { // Increased threshold from 5 to 8px
                startDragging(state.item);
            } else {
                return; // Not dragging yet
            }
        }

        if (!activeItem) return;

        // Only update position for internal drags
        if (state.isDragging) {
            const x = e.clientX - state.offset.x;
            const y = e.clientY - state.offset.y;
            setDragState(prev => ({ ...prev, currentPosition: { x, y } }));
        }

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Check if mouse is over an open folder view
        const folderViewElement = document.querySelector('[data-folder-view="true"]');
        if (folderViewElement && activeItem?.type !== 'folder') {  // Don't allow folders into folders
            const folderRect = folderViewElement.getBoundingClientRect();
            if (
                mouseX >= folderRect.left &&
                mouseX <= folderRect.right &&
                mouseY >= folderRect.top &&
                mouseY <= folderRect.bottom
            ) {
                // Over folder view - reset dock-related states
                setIsOverFolderView(true);
                setPlaceholderIndex(null);
                setHoveredFolderId(null);
                setHoveredAppId(null);
                setMergeTargetId(null);
                setIsPreMerge(false);
                potentialMergeTarget.current = null;
                return;
            }
        }
        setIsOverFolderView(false);

        let isInsideDock = false;

        if (dockRef.current) {
            const dockRect = dockRef.current.getBoundingClientRect();
            const buffer = 150;
            if (
                mouseX >= dockRect.left - buffer &&
                mouseX <= dockRect.right + buffer &&
                mouseY >= dockRect.top - buffer &&
                mouseY <= dockRect.bottom + buffer
            ) {
                isInsideDock = true;
            }
        }

        if (!isInsideDock) {
            setPlaceholderIndex(null);
            setHoveredFolderId(null);
            setHoveredAppId(null);
            setMergeTargetId(null);
            setIsPreMerge(false);
            potentialMergeTarget.current = null;
            return;
        }

        let foundMergeTargetId: string | null = null;
        let foundMergeType: 'folder' | 'app' | null = null;

        itemRefs.current.forEach((ref, index) => {
            if (!ref) return;
            const rect = ref.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            // Use mouse position for external drags, or calculated center for internal
            const draggedCenterX = state.isDragging ? (e.clientX - state.offset.x) + 32 : mouseX;
            const draggedCenterY = state.isDragging ? (e.clientY - state.offset.y) + 32 : mouseY;
            const dist = Math.hypot(draggedCenterX - centerX, draggedCenterY - centerY);

            if (dist < 30) {
                const targetItem = itemsRef.current[index];
                if (targetItem.id !== activeItem?.id) {
                    foundMergeTargetId = targetItem.id;
                    foundMergeType = targetItem.type;
                }
            }
        });

        if (foundMergeTargetId) {
            if (potentialMergeTarget.current !== foundMergeTargetId) {
                potentialMergeTarget.current = foundMergeTargetId;
                hoverStartTime.current = Date.now();
                setIsPreMerge(false);
                setMergeTargetId(null);
                setHoveredFolderId(null);
                setHoveredAppId(null);
            } else {
                const dwellTime = Date.now() - hoverStartTime.current;

                // Case B: Hover to Open (Precise Operation)
                // If hovering over a folder for > 500ms, trigger open
                if (foundMergeType === 'folder' && dwellTime > 500 && !isPreMergeRef.current) {
                    if (onHoverOpenFolder && state.item) {
                        const targetFolder = itemsRef.current.find(i => i.id === foundMergeTargetId);
                        if (targetFolder) {
                            onHoverOpenFolder(state.item, targetFolder);
                            // Reset to avoid repeated calls or weird states
                            potentialMergeTarget.current = null;
                            return;
                        }
                    }
                }

                // Case A: Direct Drop (Blind Operation) - handled by isPreMerge visual feedback
                // We still want the "blob" effect or highlighting for merging/dropping
                if (dwellTime > 300 && !isPreMergeRef.current) {
                    setIsPreMerge(true);
                    setMergeTargetId(foundMergeTargetId);
                    if (foundMergeType === 'folder') {
                        setHoveredFolderId(foundMergeTargetId);
                        setHoveredAppId(null);
                    } else {
                        setHoveredFolderId(null);
                        setHoveredAppId(foundMergeTargetId);
                    }
                }
            }
        } else {
            potentialMergeTarget.current = null;
            setIsPreMerge(false);

            const dockRect = dockRef.current?.getBoundingClientRect();
            if (dockRect) {
                let targetIndex = -1;

                for (let i = 0; i < itemsRef.current.length; i++) {
                    const ref = itemRefs.current[i];
                    if (ref) {
                        const rect = ref.getBoundingClientRect();
                        const centerX = rect.left + rect.width / 2;

                        // If mouse is to the left of this item's center, we insert here
                        if (mouseX < centerX) {
                            targetIndex = i;
                            break;
                        }
                    }
                }

                if (targetIndex === -1) {
                    targetIndex = itemsRef.current.length;
                }

                setPlaceholderIndex(targetIndex);
            }
        }
    }, [onDragStart, externalDragItem, startDragging, itemRefs, itemsRef, onHoverOpenFolder]);

    // Handle external drag tracking
    useEffect(() => {
        if (externalDragItem) {
            window.addEventListener('mousemove', handleMouseMove);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
            };
        } else {
            setPlaceholderIndex(null);
            setHoveredFolderId(null);
            setHoveredAppId(null);
            setMergeTargetId(null);
            setIsPreMerge(false);
            potentialMergeTarget.current = null;
        }
    }, [externalDragItem, handleMouseMove, setPlaceholderIndex]);

    const handleMouseUp = useCallback(() => {
        const state = dragRef.current;

        // If we never started dragging and just clicked, cleanup and allow click event to fire
        if (!state.isDragging && state.item && !hasMovedRef.current) {
            if (thresholdListenerRef.current) {
                window.removeEventListener('mousemove', thresholdListenerRef.current);
                thresholdListenerRef.current = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            hasMovedRef.current = false;
            // Reset state to allow click
            setDragState(resetDockDragState());
            return;
        }

        if (!state.item) return;

        if (thresholdListenerRef.current) {
            window.removeEventListener('mousemove', thresholdListenerRef.current);
            thresholdListenerRef.current = null;
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        const currentPlaceholder = placeholderRef.current;
        const currentHoveredFolder = hoveredFolderRef.current;
        const currentHoveredApp = hoveredAppRef.current;
        const currentItems = itemsRef.current;
        const isPreMergeState = isPreMergeRef.current;

        // 计算目标位置并设置动画状态
        let targetPos: { x: number, y: number } | null = null;
        let action: DockDragState['targetAction'] = null;
        let actionData: any = null;

        // Check if dropping onto open folder view
        if (isOverFolderView && onDragToOpenFolder && state.item.type !== 'folder') {
            const folderViewElement = document.querySelector('[data-folder-view="true"]');
            if (folderViewElement) {
                const rect = folderViewElement.getBoundingClientRect();
                targetPos = {
                    x: rect.left + rect.width / 2 - 32,
                    y: rect.top + rect.height / 2 - 32,
                };
                action = 'dragToOpenFolder';
                actionData = { item: state.item };
            }
        } else if (isPreMergeState) {
            if (currentHoveredFolder && onDropToFolder) {
                const targetFolder = currentItems.find(i => i.id === currentHoveredFolder);
                if (targetFolder) {
                    const folderIndex = currentItems.findIndex(i => i.id === currentHoveredFolder);
                    const folderElement = itemRefs.current[folderIndex];
                    if (folderElement) {
                        const rect = folderElement.getBoundingClientRect();
                        targetPos = {
                            x: rect.left,
                            y: rect.top,
                        };
                        action = 'dropToFolder';
                        actionData = { item: state.item, targetFolder };
                    }
                }
            } else if (currentHoveredApp && onMergeFolder) {
                const targetApp = currentItems.find(i => i.id === currentHoveredApp);
                if (targetApp) {
                    const appIndex = currentItems.findIndex(i => i.id === currentHoveredApp);
                    const appElement = itemRefs.current[appIndex];
                    if (appElement) {
                        const rect = appElement.getBoundingClientRect();
                        targetPos = {
                            x: rect.left,
                            y: rect.top,
                        };
                        action = 'mergeFolder';
                        actionData = { item: state.item, targetItem: targetApp };
                    }
                }
            }
        } else if (currentPlaceholder !== null && currentPlaceholder !== undefined) {
            const oldIndex = state.originalIndex;

            if (oldIndex !== -1) {
                let insertIndex = currentPlaceholder;
                if (insertIndex > oldIndex) {
                    insertIndex -= 1;
                }

                const newItems = [...currentItems];
                const [moved] = newItems.splice(oldIndex, 1);
                newItems.splice(insertIndex, 0, moved);

                let targetElementIndex = -1;
                if (insertIndex >= oldIndex) {
                    targetElementIndex = insertIndex + 1;
                } else {
                    targetElementIndex = insertIndex;
                }
                const targetElement = itemRefs.current[targetElementIndex];

                if (targetElement) {
                    const rect = targetElement.getBoundingClientRect();
                    let targetX = rect.left;

                    if (currentPlaceholder !== null && targetElementIndex >= currentPlaceholder) {
                        targetX -= 72; // 64px width + 8px gap
                    }

                    targetPos = {
                        x: targetX,
                        y: rect.top,
                    };
                    action = 'reorder';
                    actionData = { newItems };
                } else {
                    let lastVisibleIndex = currentItems.length - 1;
                    if (lastVisibleIndex === state.originalIndex) {
                        lastVisibleIndex--;
                    }

                    if (lastVisibleIndex >= 0) {
                        const lastVisibleRef = itemRefs.current[lastVisibleIndex];
                        if (lastVisibleRef) {
                            const rect = lastVisibleRef.getBoundingClientRect();
                            let targetX = rect.right + 8;

                            if (currentPlaceholder !== null && lastVisibleIndex >= currentPlaceholder) {
                                targetX -= 72;
                            }

                            targetPos = {
                                x: targetX,
                                y: rect.top,
                            };
                            action = 'reorder';
                            actionData = { newItems };
                        }
                    } else {
                        const dockContainer = document.querySelector('[data-dock-container="true"]');
                        if (dockContainer) {
                            const rect = dockContainer.getBoundingClientRect();
                            targetPos = {
                                x: rect.left + 8,
                                y: rect.top + 8,
                            };
                            action = 'reorder';
                            actionData = { newItems };
                        }
                    }
                }
            }
        }

        if (targetPos && action) {
            setDragState(prev => ({
                ...prev,
                isDragging: false,
                isAnimatingReturn: true,
                targetPosition: targetPos!,
                targetAction: action,
                targetActionData: actionData,
            }));
            setHoveredFolderId(null);
            setHoveredAppId(null);
            setMergeTargetId(null);
            setIsPreMerge(false);
            potentialMergeTarget.current = null;
            hasMovedRef.current = false;
        } else {
            setDragState(resetDockDragState());
            setPlaceholderIndex(null);
            setHoveredFolderId(null);
            setHoveredAppId(null);
            setMergeTargetId(null);
            setIsPreMerge(false);
            potentialMergeTarget.current = null;
            hasMovedRef.current = false;

            if (onDragEnd) onDragEnd();
        }
    }, [onDropToFolder, onMergeFolder, onDragToOpenFolder, onDragEnd, handleMouseMove, setDragState, setPlaceholderIndex, placeholderRef, itemsRef, itemRefs, dragRef, hasMovedRef, thresholdListenerRef, hoveredFolderRef, hoveredAppRef, isPreMergeRef]);

    const handleMouseDown = (e: React.MouseEvent, item: DockItem, index: number) => {
        createMouseDownHandler<DockDragState>({
            isEditMode,
            item,
            index,
            event: e,
            setDragState,
            handleMouseMove,
            handleMouseUp,
            createDragState: (item, index, rect, startX, startY, offset) => {
                const initial = createDockDragState();
                return {
                    ...initial,
                    item,
                    originalIndex: index,
                    currentPosition: { x: rect.left, y: rect.top },
                    startPosition: { x: startX, y: startY },
                    offset,
                };
            }
        }, hasMovedRef, thresholdListenerRef);
    };

    // 处理归位动画完成
    const handleAnimationComplete = useCallback(() => {
        const state = dragRef.current;

        if (!state.isAnimatingReturn || !state.targetAction || !state.item) {
            return;
        }

        switch (state.targetAction) {
            case 'reorder':
                if ((state.targetActionData as any)?.newItems) {
                    onReorder((state.targetActionData as any).newItems);
                }
                break;
            case 'dropToFolder':
                if ((state.targetActionData as any)?.targetFolder && onDropToFolder) {
                    onDropToFolder((state.targetActionData as any).item, (state.targetActionData as any).targetFolder);
                }
                break;
            case 'mergeFolder':
                if ((state.targetActionData as any)?.targetItem && onMergeFolder) {
                    onMergeFolder((state.targetActionData as any).item, (state.targetActionData as any).targetItem);
                }
                break;
            case 'dragToOpenFolder':
                if (onDragToOpenFolder) {
                    onDragToOpenFolder((state.targetActionData as any).item);
                }
                break;
        }

        setDragState(resetDockDragState());
        setPlaceholderIndex(null);

        if (onDragEnd) onDragEnd();
    }, [onReorder, onDropToFolder, onMergeFolder, onDragToOpenFolder, onDragEnd, setDragState, setPlaceholderIndex, dragRef]);

    const getItemTransform = useCallback((index: number): number => {
        const targetSlot = placeholderRef.current;
        if (targetSlot === null) return 0;

        const state = dragRef.current;
        const itemGap = 72;

        if (state.isDragging && state.originalIndex !== -1) {
            const draggedIndex = state.originalIndex;

            if (index === draggedIndex) {
                return 0;
            }

            if (draggedIndex < targetSlot) {
                if (index > draggedIndex && index < targetSlot) {
                    return -itemGap;
                }
            } else if (draggedIndex > targetSlot) {
                if (index >= targetSlot && index < draggedIndex) {
                    return itemGap;
                }
            }
        } else if (externalDragItem) {
            if (index >= targetSlot) {
                return itemGap;
            }
        }

        return 0;
    }, [externalDragItem, placeholderRef, dragRef]);

    // Cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (thresholdListenerRef.current) {
                window.removeEventListener('mousemove', thresholdListenerRef.current);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return {
        dragState,
        placeholderIndex,
        hoveredFolderId,
        hoveredAppId,
        mergeTargetId,
        isPreMerge,
        itemRefs,
        dockRef,
        handleMouseDown,
        handleAnimationComplete,
        getItemTransform,
    };
};
