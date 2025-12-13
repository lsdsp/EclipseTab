import { useEffect, useRef, useState, useCallback } from 'react';
import { DockItem as DockItemType } from '../../types';
import { DockItem } from './DockItem';
import { AddIcon } from './AddIcon';
import { DockNavigator } from './DockNavigator';
import { SpaceManageMenu } from '../Modal/SpaceManageMenu';
import { DragPreview } from '../DragPreview';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useDockDrag } from '../../context/DockContext';
import { useSpaces } from '../../context/SpacesContext';
import { generateFolderIcon } from '../../utils/iconFetcher';
import {
    EASE_SWIFT,
    SQUEEZE_ANIMATION_DURATION,
    FADE_DURATION,
} from '../../constants/layout';
import styles from './Dock.module.css';

interface DockProps {
    items: DockItemType[];
    isEditMode: boolean;
    onItemClick: (item: DockItemType, rect?: DOMRect) => void;
    onItemEdit: (item: DockItemType, rect?: DOMRect) => void;
    onItemDelete: (item: DockItemType) => void;
    onItemAdd: (rect?: DOMRect) => void;
    onItemsReorder: (items: DockItemType[]) => void;
    onDropToFolder?: (item: DockItemType, folder: DockItemType) => void;
    onDragToOpenFolder?: (item: DockItemType) => void;
    onHoverOpenFolder?: (item: DockItemType, folder: DockItemType) => void;
    onLongPressEdit?: () => void;
    onWidthChange?: (width: number) => void;
    // Cross‑component drag feedback
    externalDragItem?: DockItemType | null;
    onDragStart?: (item: DockItemType) => void;
    onDragEnd?: () => void;
}

export const Dock: React.FC<DockProps> = ({
    items,
    isEditMode,
    onItemClick,
    onItemEdit,
    onItemDelete,
    onItemAdd,
    onItemsReorder,
    onDropToFolder,
    onDragToOpenFolder,
    onHoverOpenFolder,
    onLongPressEdit,
    onWidthChange,
    externalDragItem,
    onDragStart,
    onDragEnd,
}) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const { folderPlaceholderActive } = useDockDrag();

    // Focus Spaces 集成
    const {
        spaces,
        currentSpace,
        currentIndex,
        isSwitching,
        setIsSwitching,
        switchToNextSpace,
        addSpace,
        renameSpace,
        deleteSpace,
    } = useSpaces();

    // 动画阶段状态机
    type AnimationPhase = 'idle' | 'exiting' | 'entering';
    const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');

    // 空间切换处理
    const handleSpaceSwitch = useCallback(() => {
        if (isSwitching || spaces.length <= 1) return;

        setIsSwitching(true);
        setAnimationPhase('exiting');

        // 退场动画结束后切换数据
        setTimeout(() => {
            switchToNextSpace();
            setAnimationPhase('entering');

            // 入场动画结束后恢复
            const enterDuration = 350 + items.length * 30;
            setTimeout(() => {
                setAnimationPhase('idle');
                setIsSwitching(false);
            }, enterDuration);
        }, 200); // 退场动画 200ms
    }, [isSwitching, spaces.length, items.length, switchToNextSpace, setIsSwitching]);

    // 空间管理菜单状态
    const [showSpaceMenu, setShowSpaceMenu] = useState(false);
    const [spaceMenuAnchor, setSpaceMenuAnchor] = useState<DOMRect | null>(null);

    const handleSpaceContextMenu = useCallback((e: React.MouseEvent) => {
        setSpaceMenuAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
        setShowSpaceMenu(true);
    }, []);

    // Sync ref for access in drag callbacks
    const folderPlaceholderActiveRef = useRef(folderPlaceholderActive);
    useEffect(() => {
        folderPlaceholderActiveRef.current = folderPlaceholderActive;
    }, [folderPlaceholderActive]);

    const {
        dragState,
        placeholderIndex,
        mergeTargetId,
        isPreMerge,
        itemRefs,
        dockRef,
        handleMouseDown,
        handleAnimationComplete,
        getItemTransform,
        dragElementRef,
    } = useDragAndDrop({
        items,
        isEditMode,
        onReorder: onItemsReorder,
        onDragToOpenFolder,
        onHoverOpenFolder: (item, folder) => {
            if (onHoverOpenFolder) onHoverOpenFolder(item, folder);
        },
        onDropToFolder,
        onMergeFolder: (item, target) => {
            if (target.type === 'folder') {
                const itemsToMerge = item.type === 'folder' && item.items ? item.items : [item];
                const newItems = items.map(i => {
                    if (i.id === target.id) {
                        const merged = [...(i.items || []), ...itemsToMerge];
                        return { ...i, items: merged, icon: generateFolderIcon(merged) };
                    }
                    return i;
                }).filter(i => i.id !== item.id);
                onItemsReorder(newItems);
            } else {
                const newFolder: DockItemType = {
                    id: `folder-${Date.now()}`,
                    name: 'Folder',
                    type: 'folder',
                    items: [target, item],
                };
                newFolder.icon = generateFolderIcon(newFolder.items!);
                const finalItems = items.map(i => (i.id === target.id ? newFolder : i)).filter(i => i.id !== item.id);
                onItemsReorder(finalItems);
            }
        },
        externalDragItem,
        onDragStart,
        onDragEnd,
        hasFolderPlaceholderActive: () => folderPlaceholderActiveRef.current,
    });

    const isInteracting = dragState.isDragging || dragState.isAnimatingReturn || !!externalDragItem;

    // Sync innerRef with dockRef from hook
    useEffect(() => {
        if (innerRef.current) {
            (dockRef as any).current = innerRef.current;
        }
    }, [dockRef]);

    // Observe width changes
    useEffect(() => {
        if (!onWidthChange || !innerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                let w = 0;
                if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
                    w = Math.round(entry.borderBoxSize[0].inlineSize);
                } else {
                    w = Math.round(entry.contentRect.width);
                    if (entry.target instanceof HTMLElement) {
                        w = Math.round(entry.target.getBoundingClientRect().width);
                    }
                }
                onWidthChange(w);
            }
        });
        ro.observe(innerRef.current);
        return () => ro.disconnect();
    }, [onWidthChange]);

    return (
        <header ref={innerRef} className={`${styles.dock} ${isEditMode ? styles.editMode : ''}`}>
            <div className={styles.dockContent} data-dock-container="true">
                <div className={`${styles.editTools} ${isEditMode ? styles.visible : ''}`}>
                    <AddIcon onClick={rect => onItemAdd(rect)} />
                    <div className={styles.divider}>
                        <svg width="1" height="48" viewBox="0 0 1 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="0.5" y1="0" x2="0.5" y2="48" strokeWidth="1" />
                        </svg>
                    </div>
                </div>

                {items.map((item, index) => {
                    const isMergeTarget = mergeTargetId === item.id;
                    const isDragging = dragState.item?.id === item.id;

                    // Transform-based animation: calculate horizontal offset for smooth sliding
                    const translateX = getItemTransform(index);

                    // 空间切换动画类
                    const animationClass = animationPhase === 'exiting'
                        ? styles.itemExiting
                        : animationPhase === 'entering'
                            ? styles.itemEntering
                            : '';

                    return (
                        <div
                            key={item.id}
                            ref={el => { itemRefs.current[index] = el; }}
                            className={`${styles.dockItemWrapper} ${isDragging ? styles.isBeingDragged : ''} ${animationClass}`}
                            data-dock-item-wrapper="true"
                            style={isDragging ? (
                                // When cursor is far from dock, collapse width so dock shrinks
                                // When cursor is over dock (placeholderIndex set), keep width for transform-based gap
                                placeholderIndex === null ? {
                                    '--stagger-index': index,
                                    width: 0,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    opacity: 0,
                                    visibility: 'hidden', // Force hide
                                    pointerEvents: 'none',
                                    transition: isInteracting
                                        ? `width ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}, min-width ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}, opacity ${FADE_DURATION}ms`
                                        : 'none',
                                } as React.CSSProperties : {
                                    '--stagger-index': index,
                                    width: 64,
                                    minWidth: 64,
                                    opacity: 0,
                                    visibility: 'hidden', // Force hide
                                    pointerEvents: 'none',
                                    transform: `translateX(${translateX}px)`,
                                    transition: isInteracting
                                        ? `width ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}, min-width ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}, transform ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}, opacity ${FADE_DURATION}ms`
                                        : 'none',
                                } as React.CSSProperties
                            ) : {
                                '--stagger-index': index,
                                transform: `translateX(${translateX}px)`,
                                transition: isInteracting
                                    ? `transform ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}`
                                    : 'none',
                            } as React.CSSProperties}
                        >
                            <DockItem
                                item={item}
                                isEditMode={isEditMode}
                                onClick={rect => onItemClick(item, rect)}
                                onEdit={rect => onItemEdit(item, rect)}
                                onDelete={() => onItemDelete(item)}
                                isDragging={isDragging}
                                staggerIndex={index}
                                isDropTarget={isMergeTarget}
                                isMergeTarget={isMergeTarget}
                                onLongPress={onLongPressEdit}
                                onMouseDown={e => handleMouseDown(e, item, index)}
                            />
                        </div>
                    );
                })}
                {/* 右侧分隔线 - 需要跟随项目移动 */}
                <div
                    className={styles.divider}
                    style={{
                        transform: `translateX(${getItemTransform(items.length)}px)`,
                        transition: isInteracting
                            ? `transform ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}`
                            : 'none',
                    }}
                >
                    <svg width="1" height="48" viewBox="0 0 1 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="0.5" y1="0" x2="0.5" y2="48" strokeWidth="1" />
                    </svg>
                </div>
                {/* DockNavigator - 空间切换器 */}
                <div
                    className={styles.dockNavigator}
                    style={{
                        transform: `translateX(${getItemTransform(items.length)}px)`,
                        transition: isInteracting
                            ? `transform ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}`
                            : 'none',
                    }}
                >
                    <DockNavigator
                        currentSpace={currentSpace}
                        totalSpaces={spaces.length}
                        currentIndex={currentIndex}
                        onSwitch={handleSpaceSwitch}
                        onContextMenu={handleSpaceContextMenu}
                        disabled={isSwitching}
                    />
                </div>
                {/* 动态占位元素 - 仅当需要扩展时渲染，避免 flex gap 造成多余间距 */}
                {getItemTransform(items.length) > 0 && (
                    <div
                        style={{
                            width: getItemTransform(items.length),
                            flexShrink: 0,
                            transition: isInteracting
                                ? `width ${SQUEEZE_ANIMATION_DURATION}ms ${EASE_SWIFT}`
                                : 'none',
                        }}
                    />
                )}
            </div>
            <DragPreview
                isActive={dragState.isDragging || dragState.isAnimatingReturn}
                item={dragState.item}
                position={dragState.currentPosition}
                isAnimatingReturn={dragState.isAnimatingReturn}
                isEditMode={isEditMode}
                dragElementRef={dragElementRef}
                isPreMerge={isPreMerge}
                onAnimationComplete={handleAnimationComplete}
            />
            {/* 空间管理菜单 */}
            <SpaceManageMenu
                isOpen={showSpaceMenu}
                anchorRect={spaceMenuAnchor}
                currentSpace={currentSpace}
                isLastSpace={spaces.length <= 1}
                onClose={() => setShowSpaceMenu(false)}
                onAdd={() => {
                    addSpace();
                    setShowSpaceMenu(false);
                }}
                onRename={(newName) => {
                    renameSpace(currentSpace.id, newName);
                    setShowSpaceMenu(false);
                }}
                onDelete={() => {
                    deleteSpace(currentSpace.id);
                    setShowSpaceMenu(false);
                }}
            />
        </header>
    );
};
