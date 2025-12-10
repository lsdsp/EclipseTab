import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DockItem } from '../../types';
import { DockItem as DockItemComponent } from '../Dock/DockItem';
import { scaleFadeIn, scaleFadeOut } from '../../utils/animations';
import { useFolderDragAndDrop } from '../../hooks/useFolderDragAndDrop';
import styles from './FolderView.module.css';

interface FolderViewProps {
  folder: DockItem;
  isEditMode: boolean;
  onItemClick: (item: DockItem) => void;
  onItemEdit: (item: DockItem, rect?: DOMRect) => void;
  onItemDelete: (item: DockItem) => void;
  onClose: () => void;
  onItemsReorder: (items: DockItem[]) => void;
  onItemDragOut?: (item: DockItem, mousePosition: { x: number; y: number }) => void;
  anchorRect?: DOMRect | null;
  // Cross‑component drag feedback
  externalDragItem?: DockItem | null;
  onDragStart?: (item: DockItem) => void;
  onDragEnd?: () => void;
}

export const FolderView: React.FC<FolderViewProps> = ({
  folder,
  isEditMode,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onClose,
  onItemsReorder,
  onItemDragOut,
  anchorRect,
  externalDragItem,
  onDragStart,
  onDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    dragState,
    isDraggingOut,
    itemRefs,
    handleMouseDown,
    getItemTransform,
    dragElementRef,
  } = useFolderDragAndDrop({
    items: folder.items || [],
    isEditMode,
    onReorder: onItemsReorder,
    onDragOut: onItemDragOut,
    containerRef: gridRef,
    externalDragItem,
    onDragStart,
    onDragEnd,
  });

  // 判断是否正在交互（拖拽中或有外部拖入项）
  const isInteracting = dragState.isDragging || dragState.isAnimatingReturn || !!externalDragItem;

  // 使用原始列表 + transform 动画（而非投影式重排）
  // 保持 DOM 顺序不变，通过 CSS transform 实现视觉上的平滑移动
  const items = folder.items || [];

  // 计算实际渲染的项目数量（考虑外部拖入时的额外占位）
  const effectiveItemCount = externalDragItem && !isDraggingOut
    ? items.length + 1
    : items.length;

  // 归位动画现在由 useFolderDragAndDrop 通过直接 DOM 操作处理
  // 不再需要 React 状态驱动的两阶段动画

  // Animate entry
  useEffect(() => {
    if (containerRef.current) {
      scaleFadeIn(containerRef.current);
    }
  }, []);

  // Close when clicking outside... (logic unchanged)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dock-container="true"]') ||
        target.closest('[data-modal="true"]') ||
        document.body.classList.contains('is-dragging')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClose = () => {
    if (containerRef.current) {
      scaleFadeOut(containerRef.current, 300, onClose);
    } else {
      onClose();
    }
  };

  // If folder is empty and no external drag item, don't render
  if (items.length === 0 && !externalDragItem) {
    return null;
  }

  // Layout calculations based on effective item count (includes external drag placeholder)
  const columns = Math.min(4, Math.max(effectiveItemCount, 1));

  // Calculate width
  const popupWidth = (columns * 64) + ((Math.max(columns - 1, 0)) * 8) + 16;
  const halfWidth = popupWidth / 2;

  return createPortal(
    <>
      <div
        className={styles.popupWrapper}
        data-folder-view="true"
        style={{
          left: `${Math.min(
            Math.max(Math.round((anchorRect?.left ?? 0) + (anchorRect?.width ?? 0) / 2),
              halfWidth
            ), window.innerWidth - halfWidth)}px`,
          top: `${Math.round((anchorRect?.top ?? 0) - 24)}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={containerRef}
          className={`${styles.container} ${styles.popover}`}
          style={{
            width: `${popupWidth}px`,
            height: 'auto',
            overflow: 'visible'
          }}
        >
          <div
            ref={gridRef}
            className={styles.grid}
            style={{
              gridTemplateColumns: `repeat(${columns}, 64px)`,
              gridAutoRows: 'min-content',
              gridAutoFlow: 'row dense',
              justifyContent: 'start',
              alignContent: 'start',
            }}
          >
            {items.map((item, index) => {
              // 检查是否是正在拖拽的源项（包括归位动画期间）
              const isDraggingSource = (dragState.isDragging || dragState.isAnimatingReturn) && dragState.item?.id === item.id;

              // 获取 2D 变换偏移量（x 和 y）
              const transform = getItemTransform(index);

              // 拖拽源项的样式：
              // - 当拖到文件夹外(isDraggingOut)时，收缩为0让其他项填补空隙
              // - 当在文件夹内时，保持尺寸让 transform 创造视觉空隙
              const sourceItemStyle = isDraggingSource ? (
                isDraggingOut ? {
                  // 拖出文件夹：收缩为0，让[A][C]紧凑排列
                  width: 0,
                  height: 0,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: 'hidden',
                  opacity: 0,
                  visibility: 'hidden' as const,
                  transition: isInteracting
                    ? 'width 200ms cubic-bezier(0.2, 0, 0, 1), height 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms'
                    : 'none',
                } : {
                  // 在文件夹内：保持尺寸，让其他项通过 transform 创造空隙
                  width: 64,
                  height: 64,
                  opacity: 0,
                  visibility: 'hidden' as const,
                  transform: `translate(${transform.x}px, ${transform.y}px)`,
                  transition: isInteracting
                    ? 'transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms'
                    : 'none',
                }
              ) : {
                // 普通项
                width: 64,
                height: 64,
                transform: `translate(${transform.x}px, ${transform.y}px)`,
                transition: isInteracting
                  ? 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'
                  : 'none',
              };

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={styles.gridItem}
                  style={sourceItemStyle}
                >
                  <DockItemComponent
                    item={item}
                    isEditMode={isEditMode}
                    onClick={() => onItemClick(item)}
                    onEdit={(rect) => onItemEdit(item, rect)}
                    onDelete={() => onItemDelete(item)}
                    isDragging={isDraggingSource}
                    staggerIndex={index}
                    onMouseDown={(e) => handleMouseDown(e, item, index)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Drag preview overlay */}
      {(dragState.isDragging || dragState.isAnimatingReturn) && dragState.item && createPortal(
        <div
          ref={el => {
            if (dragElementRef) {
              dragElementRef.current = el;
            }
          }}
          style={{
            position: 'fixed',
            // 位置由 currentPosition 初始化，归位动画通过 hook 直接操作 DOM
            left: dragState.currentPosition.x,
            top: dragState.currentPosition.y,
            width: 64,
            height: 64,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: isDraggingOut ? 'scale(1.0)' : 'scale(1.0)',
            filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3))',
            // 拖拽时禁用过渡，归位动画由 hook 直接设置
            transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        // onTransitionEnd 不再需要 - hook 直接监听 DOM
        >
          <DockItemComponent
            item={dragState.item}
            isEditMode={isEditMode}
            onClick={() => { }}
            onEdit={() => { }}
            onDelete={() => { }}
            isDragging={true}
          />
        </div>,
        document.body
      )}
    </>
    , document.body);
};
