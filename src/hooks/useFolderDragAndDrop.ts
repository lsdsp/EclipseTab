import { useState, useEffect, useRef, useCallback } from 'react';
import { DockItem } from '../types';
import { useDragBase, createFolderDragState, resetFolderDragState, FolderDragState } from './useDragBase';
import { createMouseDownHandler } from '../utils/dragUtils';

interface UseFolderDragAndDropOptions {
    items: DockItem[];
    isEditMode: boolean;
    onReorder: (items: DockItem[]) => void;
    onDragOut?: (item: DockItem, mousePosition: { x: number; y: number }) => void;
    containerRef: React.RefObject<HTMLElement>;
    externalDragItem?: DockItem | null;
    onDragStart?: (item: DockItem) => void;
    onDragEnd?: () => void;
}

export const useFolderDragAndDrop = ({
    items,
    isEditMode,
    onReorder,
    onDragOut,
    containerRef,
    externalDragItem,
    onDragStart,
    onDragEnd,
}: UseFolderDragAndDropOptions) => {
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
    } = useDragBase<FolderDragState>({
        items,
        isEditMode,
        onDragStart,
        onDragEnd,
        externalDragItem,
        createInitialState: createFolderDragState,
        resetState: resetFolderDragState,
    });

    const [isDraggingOut, setIsDraggingOut] = useState(false);
    const isDraggingOutRef = useRef(false);

    useEffect(() => { isDraggingOutRef.current = isDraggingOut; }, [isDraggingOut]);

    const isOutsideContainer = useCallback((mouseX: number, mouseY: number): boolean => {
        const elementUnder = document.elementFromPoint(mouseX, mouseY);
        if (elementUnder && elementUnder.closest('[data-dock-container="true"]')) {
            return true;
        }

        if (!containerRef.current) return false;
        const rect = containerRef.current.getBoundingClientRect();
        const buffer = 10;
        return (
            mouseX < rect.left - buffer ||
            mouseX > rect.right + buffer ||
            mouseY < rect.top - buffer ||
            mouseY > rect.bottom + buffer
        );
    }, [containerRef]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const state = dragRef.current;
        const activeItem = state.isDragging ? state.item : externalDragItem;

        if (!state.isDragging && !externalDragItem && state.item) {
            const dist = Math.hypot(e.clientX - state.startPosition.x, e.clientY - state.startPosition.y);
            if (dist > 8) {
                startDragging(state.item);
            } else {
                return;
            }
        }

        if (!activeItem) return;

        if (state.isDragging) {
            const x = e.clientX - state.offset.x;
            const y = e.clientY - state.offset.y;
            setDragState(prev => ({ ...prev, currentPosition: { x, y } }));
        }

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        if (state.isDragging && isOutsideContainer(mouseX, mouseY)) {
            setIsDraggingOut(true);
            setPlaceholderIndex(null);
            return;
        }

        setIsDraggingOut(false);

        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const isInsideContainer = (
            mouseX >= containerRect.left &&
            mouseX <= containerRect.right &&
            mouseY >= containerRect.top &&
            mouseY <= containerRect.bottom
        );

        if (!isInsideContainer) {
            setPlaceholderIndex(null);
            return;
        }

        const itemsToCheck = state.isDragging
            ? itemsRef.current.filter((_, idx) => idx !== state.originalIndex)
            : itemsRef.current;

        let closestIndex = itemsToCheck.length;
        let minDistance = Infinity;
        let checkIndex = 0;

        itemRefs.current.forEach((ref, index) => {
            if (!ref || (state.isDragging && index === state.originalIndex)) return;
            const rect = ref.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const dist = Math.hypot(mouseX - centerX, mouseY - centerY);
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = checkIndex;
            }
            checkIndex++;
        });

        let finalPlaceholderIndex = closestIndex;

        if (state.isDragging) {
            closestIndex = itemsRef.current.length;
            minDistance = Infinity;

            itemRefs.current.forEach((ref, index) => {
                if (!ref || index === state.originalIndex) return;
                const rect = ref.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const dist = Math.hypot(mouseX - centerX, mouseY - centerY);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = index;
                }
            });

            finalPlaceholderIndex = closestIndex;
            if (state.originalIndex !== -1 && closestIndex > state.originalIndex) {
                finalPlaceholderIndex = closestIndex + 1;
            }
        } else {
            closestIndex = itemsRef.current.length;
            minDistance = Infinity;

            itemRefs.current.forEach((ref, index) => {
                if (!ref) return;
                const rect = ref.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const dist = Math.hypot(mouseX - centerX, mouseY - centerY);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = index;
                }
            });
            finalPlaceholderIndex = closestIndex;
        }

        setPlaceholderIndex(finalPlaceholderIndex);
    }, [isOutsideContainer, containerRef, externalDragItem, startDragging, itemRefs, itemsRef, setDragState, setPlaceholderIndex]);

    useEffect(() => {
        if (externalDragItem) {
            window.addEventListener('mousemove', handleMouseMove);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
            };
        }
    }, [externalDragItem, handleMouseMove]);

    const handleMouseUp = useCallback(() => {
        const state = dragRef.current;

        if (!state.isDragging && state.item && !hasMovedRef.current) {
            if (thresholdListenerRef.current) {
                window.removeEventListener('mousemove', thresholdListenerRef.current);
                thresholdListenerRef.current = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            hasMovedRef.current = false;
            setDragState(resetFolderDragState());
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
        const currentItems = itemsRef.current;

        let targetPos: { x: number, y: number } | null = null;
        let action: FolderDragState['targetAction'] = null;
        let actionData: any = null;

        const wasDraggingOut = isDraggingOutRef.current;

        if (wasDraggingOut && onDragOut) {
            const dockElement = document.querySelector('[data-dock-container="true"]');
            if (dockElement) {
                const dockRect = dockElement.getBoundingClientRect();
                const mouseX = state.currentPosition.x + state.offset.x;
                const mouseY = state.currentPosition.y + state.offset.y;
                targetPos = {
                    x: mouseX - 32,
                    y: dockRect.top,
                };
                action = 'dragOut';
                actionData = { item: state.item, mousePosition: { x: mouseX, y: mouseY } };

                setDragState(prev => ({
                    ...prev,
                    isDragging: false,
                    isAnimatingReturn: true,
                    targetPosition: targetPos!,
                    targetAction: action,
                    targetActionData: actionData,
                }));
                setIsDraggingOut(false);
                hasMovedRef.current = false;
            } else {
                setDragState(resetFolderDragState());
                setPlaceholderIndex(null);
                setIsDraggingOut(false);
                hasMovedRef.current = false;
                if (onDragEnd) onDragEnd();
            }
        } else if (currentPlaceholder !== null && currentPlaceholder !== undefined) {
            const columns = 4;
            const itemSize = 64;
            const gap = 8;
            const col = currentPlaceholder % columns;
            const row = Math.floor(currentPlaceholder / columns);

            if (containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const targetX = containerRect.left + 8 + col * (itemSize + gap);
                const targetY = containerRect.top + 8 + row * (itemSize + gap);

                targetPos = {
                    x: targetX,
                    y: targetY
                };
                action = 'reorder';

                const newItems = [...currentItems];
                const [movedItem] = newItems.splice(state.originalIndex, 1);
                let insertIndex = currentPlaceholder;
                if (state.originalIndex < currentPlaceholder) {
                    insertIndex -= 1;
                }
                newItems.splice(insertIndex, 0, movedItem);
                actionData = { newItems };

                setDragState(prev => ({
                    ...prev,
                    isDragging: false,
                    isAnimatingReturn: true,
                    targetPosition: targetPos!,
                    targetAction: action,
                    targetActionData: actionData,
                }));
                setIsDraggingOut(false);
                hasMovedRef.current = false;
            } else {
                setDragState(resetFolderDragState());
                setPlaceholderIndex(null);
                setIsDraggingOut(false);
                hasMovedRef.current = false;
                if (onDragEnd) onDragEnd();
            }

        } else {
            setDragState(resetFolderDragState());
            setPlaceholderIndex(null);
            setIsDraggingOut(false);
            hasMovedRef.current = false;
            if (onDragEnd) onDragEnd();
        }
    }, [onDragOut, onReorder, handleMouseMove, onDragEnd, setDragState, setPlaceholderIndex, containerRef, dragRef, isDraggingOutRef, placeholderRef, itemsRef, hasMovedRef, thresholdListenerRef]);

    const handleMouseDown = (e: React.MouseEvent, item: DockItem, index: number) => {
        createMouseDownHandler<FolderDragState>({
            isEditMode,
            item,
            index,
            event: e,
            setDragState,
            handleMouseMove,
            handleMouseUp,
            createDragState: (item, index, rect, startX, startY, offset) => {
                const initial = createFolderDragState();
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
            case 'dragOut':
                if ((state.targetActionData as any)?.mousePosition && onDragOut) {
                    onDragOut((state.targetActionData as any).item, (state.targetActionData as any).mousePosition);
                }
                break;
        }

        setDragState(resetFolderDragState());
        setPlaceholderIndex(null);

        if (onDragEnd) onDragEnd();
    }, [onReorder, onDragOut, onDragEnd, setDragState, setPlaceholderIndex, dragRef]);

    const getItemTransform = useCallback((index: number, columns: number = 4): { x: number; y: number } => {
        const targetSlot = placeholderRef.current;
        if (targetSlot === null) return { x: 0, y: 0 };

        const state = dragRef.current;
        const itemSize = 72;

        const shiftRight = (idx: number): { x: number; y: number } => {
            const currentCol = idx % columns;
            if (currentCol === columns - 1) {
                return { x: -itemSize * (columns - 1), y: itemSize };
            } else {
                return { x: itemSize, y: 0 };
            }
        };

        // Calculate visual index (where item naturally falls due to drag gap)
        let visualIndex = index;
        if (state.isDragging && state.originalIndex !== -1) {
            if (index === state.originalIndex) return { x: 0, y: 0 };
            if (index > state.originalIndex) {
                visualIndex = index - 1;
            }
        }

        if (index >= targetSlot) {
            return shiftRight(visualIndex);
        } else if (externalDragItem && index >= targetSlot) {
            return shiftRight(index);
        }

        return { x: 0, y: 0 };
    }, [externalDragItem, placeholderRef, dragRef]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (thresholdListenerRef.current) {
                window.removeEventListener('mousemove', thresholdListenerRef.current);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, []);

    return {
        dragState,
        placeholderIndex,
        isDraggingOut,
        itemRefs,
        handleMouseDown,
        handleAnimationComplete,
        getItemTransform,
    };
};
