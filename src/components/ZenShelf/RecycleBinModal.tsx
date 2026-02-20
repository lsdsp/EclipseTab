import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useZenShelf } from '../../context/ZenShelfContext';
import { useDockData } from '../../context/DockContext';
import { useSpaces } from '../../context/SpacesContext';
import { DOCK_RECYCLE_LIMIT, SPACE_RECYCLE_LIMIT, STICKER_RECYCLE_LIMIT } from '../../constants/recycle';
import { estimateRecycleBytes, formatBytes } from '../../utils/storageDashboard';
import styles from './ZenShelf.module.css';
import { useLanguage } from '../../context/LanguageContext';
import TrashIcon from '../../assets/icons/trash.svg';
import CancelIcon from '../../assets/icons/cancel.svg';
import TrashCanEmpty from '../../assets/icons/TrashCan-empty.svg';

interface RecycleBinModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type RecycleViewType = 'stickers' | 'dock' | 'space';
export const DEFAULT_RECYCLE_VIEW: RecycleViewType = 'stickers';

export const buildRecycleBinQuotaText = (
    language: 'zh' | 'en',
    counts: { stickers: number; dock: number; spaces: number }
): string => {
    if (language === 'zh') {
        return `配额：贴纸 ${counts.stickers}/${STICKER_RECYCLE_LIMIT} · Dock ${counts.dock}/${DOCK_RECYCLE_LIMIT} · 空间 ${counts.spaces}/${SPACE_RECYCLE_LIMIT}`;
    }
    return `Quota: Stickers ${counts.stickers}/${STICKER_RECYCLE_LIMIT} · Dock ${counts.dock}/${DOCK_RECYCLE_LIMIT} · Space ${counts.spaces}/${SPACE_RECYCLE_LIMIT}`;
};

export const buildRecycleBinUsageText = (language: 'zh' | 'en', recycleBytes: number): string => {
    if (language === 'zh') {
        return `回收站占用：${formatBytes(recycleBytes)}`;
    }
    return `Recycle usage: ${formatBytes(recycleBytes)}`;
};

const buildDeletedSummaryText = (
    language: 'zh' | 'en',
    counts: { stickers: number; dock: number; spaces: number }
): string => {
    if (language === 'zh') {
        return `当前删除项：贴纸 ${counts.stickers} · Dock ${counts.dock} · 空间 ${counts.spaces}`;
    }
    return `Deleted now: Stickers ${counts.stickers} · Dock ${counts.dock} · Space ${counts.spaces}`;
};

export const getRecycleViewLabel = (language: 'zh' | 'en', view: RecycleViewType): string => {
    if (language === 'zh') {
        if (view === 'stickers') return '贴纸';
        if (view === 'dock') return 'Dock';
        return '空间';
    }

    if (view === 'stickers') return 'Stickers';
    if (view === 'dock') return 'Dock';
    return 'Space';
};

const formatDeletedAt = (deletedAt: number, language: 'zh' | 'en'): string => {
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    return new Date(deletedAt).toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// 橡皮筋效果计算 - 超过最大值后阻力逐渐增加
const rubberBand = (offset: number, maxOffset: number = 200): number => {
    const absOffset = Math.abs(offset);
    if (absOffset <= maxOffset) {
        return offset;
    }
    // 超过 maxOffset 后，使用对数衰减
    const sign = offset > 0 ? 1 : -1;
    const overflow = absOffset - maxOffset;
    const dampedOverflow = maxOffset + overflow * 0.3; // 30% 阻力
    return sign * dampedOverflow;
};

// Sub-component for individual swipeable items
const RecycleBinItem: React.FC<{
    sticker: any;
    onRestore: (sticker: any) => void;
    onDelete: (item: any) => void;
    t: any;
    index: number;
}> = ({ sticker, onRestore, onDelete, t, index }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isSpringBack, setIsSpringBack] = useState(false);
    const [animationState, setAnimationState] = useState<'idle' | 'restoring' | 'deleting'>('idle');
    const [isCollapsing, setIsCollapsing] = useState(false);
    const startX = useRef<number | null>(null);
    const startY = useRef<number | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);
    const offsetXRef = useRef(0);
    const itemRef = useRef<HTMLDivElement>(null);
    const THRESHOLD = 100;
    const MAX_OFFSET = 200;
    const DIRECTION_THRESHOLD = 10;

    // 是否达到阈值
    const isThresholdReached = Math.abs(offsetX) >= THRESHOLD;

    const handleStart = useCallback((clientX: number, clientY: number) => {
        setIsDragging(true);
        setIsSpringBack(false);
        startX.current = clientX;
        startY.current = clientY;
        isHorizontalSwipe.current = null;
    }, []);

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging || startX.current === null || startY.current === null) return;

        const deltaX = clientX - startX.current;
        const deltaY = clientY - startY.current;

        if (isHorizontalSwipe.current === null) {
            if (Math.abs(deltaX) > DIRECTION_THRESHOLD || Math.abs(deltaY) > DIRECTION_THRESHOLD) {
                isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
            }
        }

        if (isHorizontalSwipe.current === true) {
            const dampedDelta = rubberBand(deltaX, MAX_OFFSET);
            setOffsetX(dampedDelta);
            offsetXRef.current = dampedDelta;
        }
    }, [isDragging]);

    const handleEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        startX.current = null;
        startY.current = null;

        const currentOffset = offsetXRef.current;
        const wasHorizontal = isHorizontalSwipe.current === true;
        isHorizontalSwipe.current = null;

        if (!wasHorizontal) {
            setOffsetX(0);
            offsetXRef.current = 0;
            return;
        }

        if (currentOffset > THRESHOLD) {
            setAnimationState('deleting');
            // 设置目标位置，让 transition 从当前位置动画到目标
            setOffsetX(400); // 向右飞出

            // Step 1: Fly out (Wait 400ms)
            setTimeout(() => {
                // Step 2: Collapse height (Wait 300ms)
                setIsCollapsing(true);
                setTimeout(() => {
                    // Step 3: Unmount (Total 700ms)
                    onDelete(sticker);
                }, 300);
            }, 400);
        } else if (currentOffset < -THRESHOLD) {
            setAnimationState('restoring');
            // 设置目标位置，让 transition 从当前位置动画到目标
            setOffsetX(-400); // 向左飞出

            // Step 1: Fly out (Wait 400ms)
            setTimeout(() => {
                // Step 2: Collapse height (Wait 300ms)
                setIsCollapsing(true);
                setTimeout(() => {
                    // Step 3: Unmount (Total 700ms)
                    onRestore(sticker);
                }, 300);
            }, 400);
        } else {
            setIsSpringBack(true);
            setOffsetX(0);
            offsetXRef.current = 0;
            setTimeout(() => setIsSpringBack(false), 400);
        }
    }, [isDragging, onDelete, onRestore, sticker]);

    useEffect(() => {
        if (!isDragging) return;

        const handleDocumentMouseMove = (e: MouseEvent) => {
            handleMove(e.clientX, e.clientY);
            if (isHorizontalSwipe.current === true) {
                e.preventDefault();
            }
        };

        const handleDocumentMouseUp = () => {
            handleEnd();
        };

        document.addEventListener('mousemove', handleDocumentMouseMove, { passive: false });
        document.addEventListener('mouseup', handleDocumentMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
        };
    }, [isDragging, handleMove, handleEnd]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    }, [handleStart]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }, [handleStart]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, [handleMove]);

    const onTouchEnd = useCallback(() => handleEnd(), [handleEnd]);

    // 防止图片被拖动
    const preventDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    // 计算 item 的 className
    const itemClassName = [
        styles.recycleBinItem,
        isSpringBack ? styles.springBack : '',
        animationState === 'restoring' ? styles.restoring : '',
        animationState === 'deleting' ? styles.permanentlyDeleting : '',
    ].filter(Boolean).join(' ');

    // 计算背景的 className - Remove threshold check for immediate feedback
    const bgClassName = [
        styles.swipeBackground,
        offsetX > 0 ? styles.delete : offsetX < 0 ? styles.restore : '',
        isThresholdReached ? styles.threshold : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={styles.recycleBinItemWrapper}
            style={{
                animationDelay: `${index * 0.05}s`,
                maxHeight: isCollapsing ? 0 : '400px', // Assuming max height of sticker, or plenty of space
                marginBottom: isCollapsing ? 0 : '24px',
                opacity: isCollapsing ? 0 : undefined, // Fade out wrapper for good measure
                overflow: isCollapsing ? 'hidden' : undefined, // Clip content during collapse
                // Only apply transition during collapse to avoid fighting with entrance animation
                transition: isCollapsing ? 'all 0.3s cubic-bezier(0.34, 1.25, 0.64, 1)' : undefined
            }}
        >
            {/* Background Layer */}
            <div
                className={bgClassName}
                style={{ opacity: Math.min(Math.abs(offsetX) / 100, 1) }}
            >
                {/* Left side content (Visible when dragging Right -> Delete) */}
                <div className={styles.swipeActionContent} style={{ opacity: offsetX > 0 ? Math.min(offsetX / 50, 1) : 0 }}>
                    <img src={TrashIcon} alt="delete" className={styles.swipeActionIcon} />
                    <span>{t.contextMenu?.delete || "Delete"}</span>
                </div>

                {/* Right side content (Visible when dragging Left -> Restore) */}
                <div className={styles.swipeActionContent} style={{ opacity: offsetX < 0 ? Math.min(Math.abs(offsetX) / 50, 1) : 0, marginLeft: 'auto' }}>
                    <span>{t.contextMenu?.restore || "Restore"}</span>
                    <img src={CancelIcon} alt="restore" className={styles.swipeActionIcon} />
                </div>
            </div>

            {/* Foreground Item */}
            <div
                ref={itemRef}
                className={itemClassName}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : undefined,
                }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onDoubleClick={(e) => { e.stopPropagation(); onRestore(sticker); }}
            >
                {sticker.type === 'text' ? (
                    <div className={styles.stickerText}>
                        <div
                            className={styles.textSticker}
                            style={{
                                color: sticker.style?.color || '#000000',
                                fontSize: `${sticker.style?.fontSize || 40}px`,
                                textAlign: sticker.style?.textAlign || 'center',
                                lineHeight: 0.95,
                            }}
                        >
                            {sticker.content}
                        </div>
                    </div>
                ) : (
                    <img
                        src={sticker.content}
                        alt="sticker"
                        className={styles.recycleItemPreview}
                        draggable={false}
                        onDragStart={preventDrag}
                    />
                )}
            </div>
        </div>
    );
};



export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose }) => {
    const { deletedStickers, restoreSticker, permanentlyDeleteSticker, clearRecycleBin } = useZenShelf();
    const {
        deletedDockItems,
        restoreDeletedDockItem,
        clearDeletedDockItems,
    } = useDockData();
    const {
        deletedSpaces,
        restoreDeletedSpace,
        clearDeletedSpaces,
    } = useSpaces();
    const { t, language } = useLanguage();
    const [isClosing, setIsClosing] = useState(false);
    const [activeView, setActiveView] = useState<RecycleViewType>(DEFAULT_RECYCLE_VIEW);

    const recycleCounts = {
        stickers: deletedStickers.length,
        dock: deletedDockItems.length,
        spaces: deletedSpaces.length,
    };
    const recycleQuotaText = buildRecycleBinQuotaText(language, {
        stickers: recycleCounts.stickers,
        dock: recycleCounts.dock,
        spaces: recycleCounts.spaces,
    });
    const recycleSummaryText = buildDeletedSummaryText(language, recycleCounts);
    const recycleUsageText = buildRecycleBinUsageText(
        language,
        estimateRecycleBytes(deletedDockItems, deletedSpaces, deletedStickers)
    );
    const allRecycleBinsEmpty = recycleCounts.stickers === 0 && recycleCounts.dock === 0 && recycleCounts.spaces === 0;
    const activeViewCount = activeView === 'stickers'
        ? recycleCounts.stickers
        : (activeView === 'dock' ? recycleCounts.dock : recycleCounts.spaces);

    const sortedDeletedDockItems = [...deletedDockItems].sort((left, right) => right.deletedAt - left.deletedAt);
    const sortedDeletedSpaces = [...deletedSpaces].sort((left, right) => right.deletedAt - left.deletedAt);

    // 处理关闭 - 先播放退场动画
    const handleClose = useCallback(() => {
        setIsClosing(true);
        // 等待动画完成后真正关闭
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 250); // 匹配 recycleBinPopOut 动画时长
    }, [onClose]);

    // 右滑删除不需要确认，直接删除
    const handlePermanentDelete = useCallback((sticker: any) => {
        permanentlyDeleteSticker(sticker.id);
    }, [permanentlyDeleteSticker]);

    const handleClearAllRecycleBins = useCallback(() => {
        const confirmed = window.confirm(
            language === 'zh'
                ? '确认清空 Dock/空间/贴纸回收站？清空后不可恢复。'
                : 'Clear dock/space/sticker recycle bins? This cannot be undone.'
        );
        if (!confirmed) return;
        clearDeletedDockItems();
        clearDeletedSpaces();
        clearRecycleBin();
    }, [clearDeletedDockItems, clearDeletedSpaces, clearRecycleBin, language]);

    // 重置关闭状态
    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            setActiveView(DEFAULT_RECYCLE_VIEW);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const modalClassName = [
        styles.recycleBinModal,
        isOpen ? styles.open : '',
        isClosing ? styles.closing : '',
    ].filter(Boolean).join(' ');

    return ReactDOM.createPortal(
        <div
            className={modalClassName}
            data-ui-zone="zen-recycle-bin-modal"
            onClick={handleClose}
        >
            <div
                className={styles.recycleBinContent}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.recycleBinHeader}>
                    <div className={styles.headerTextWrapper}>
                        <h2 className={styles.recycleBinTitle}>{t.space.recycleBin || "Recycle Bin"}</h2>
                        <span className={styles.recycleBinSubtitle}>{t.space.restoreHint || "Swipe left to restore, swipe right to delete"} · {recycleQuotaText}</span>
                        <span className={styles.recycleBinMetaText}>{recycleSummaryText} · {recycleUsageText}</span>
                    </div>
                    <button className={styles.recycleBinCloseWrapper} onClick={handleClose}>
                        <div className={styles.recycleBinCloseInner}>
                            <svg className={styles.recycleBinCloseIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </button>
                </div>

                <div className={styles.recycleBinGrid}>
                    <div className={styles.recycleBinActionRow}>
                        <button
                            className={styles.recycleBinActionButtonDanger}
                            onClick={handleClearAllRecycleBins}
                            disabled={allRecycleBinsEmpty}
                        >
                            {language === 'zh' ? '清空回收站' : 'Empty Recycle Bin'}
                        </button>
                    </div>

                    <div className={styles.recycleBinViewToggle}>
                        {(['stickers', 'dock', 'space'] as RecycleViewType[]).map((view) => (
                            <button
                                key={view}
                                className={`${styles.recycleBinViewButton} ${activeView === view ? styles.recycleBinViewButtonActive : ''}`}
                                onClick={() => setActiveView(view)}
                            >
                                {getRecycleViewLabel(language, view)}
                            </button>
                        ))}
                    </div>

                    {allRecycleBinsEmpty ? (
                        <div className={styles.emptyState}>
                            <img src={TrashCanEmpty} alt="Empty Recycle Bin" className={styles.emptyStateIcon} />
                            <span className={styles.emptyStateText}>
                                {t.space?.emptyRecycleBin || "No deleted items"}
                            </span>
                            <span className={styles.emptyStateHint}>
                                {t.space?.emptyRecycleBinHint || "Deleted stickers will appear here"}
                            </span>
                        </div>
                    ) : activeViewCount === 0 ? (
                        <div className={styles.recycleBinListEmpty}>
                            {activeView === 'stickers'
                                ? (language === 'zh' ? '暂无已删除贴纸' : 'No deleted stickers')
                                : activeView === 'dock'
                                    ? (language === 'zh' ? '暂无 Dock 删除项' : 'No deleted Dock items')
                                    : (language === 'zh' ? '暂无空间删除项' : 'No deleted spaces')}
                        </div>
                    ) : (
                        <>
                            {activeView === 'stickers' ? (
                                <>
                                    <div className={styles.recycleBinSectionTitle}>
                                        {language === 'zh' ? '贴纸（左滑还原 / 右滑删除）' : 'Stickers (swipe left restore / right delete)'}
                                    </div>
                                    {deletedStickers.map((sticker, index) => (
                                        <RecycleBinItem
                                            key={sticker.id}
                                            sticker={sticker}
                                            onRestore={restoreSticker}
                                            onDelete={handlePermanentDelete}
                                            t={t}
                                            index={index}
                                        />
                                    ))}
                                </>
                            ) : activeView === 'dock' ? (
                                <div className={styles.recycleBinSingleList}>
                                    <div className={styles.recycleBinListCard}>
                                        <div className={styles.recycleBinListTitle}>
                                            {language === 'zh' ? `Dock（${sortedDeletedDockItems.length}）` : `Dock (${sortedDeletedDockItems.length})`}
                                        </div>
                                        {sortedDeletedDockItems.map((record) => (
                                            <div key={record.id} className={styles.recycleBinListItem}>
                                                <div className={styles.recycleBinListItemInfo}>
                                                    <span className={styles.recycleBinListItemName}>
                                                        {record.item.name || (language === 'zh' ? '未命名项' : 'Untitled')}
                                                    </span>
                                                    <span className={styles.recycleBinListItemMeta}>
                                                        {formatDeletedAt(record.deletedAt, language)}
                                                    </span>
                                                </div>
                                                <button
                                                    className={styles.recycleBinListItemRestore}
                                                    onClick={() => restoreDeletedDockItem(record.id)}
                                                >
                                                    {language === 'zh' ? '还原' : 'Restore'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.recycleBinSingleList}>
                                    <div className={styles.recycleBinListCard}>
                                        <div className={styles.recycleBinListTitle}>
                                            {language === 'zh' ? `空间（${sortedDeletedSpaces.length}）` : `Space (${sortedDeletedSpaces.length})`}
                                        </div>
                                        {sortedDeletedSpaces.map((record) => (
                                            <div key={record.id} className={styles.recycleBinListItem}>
                                                <div className={styles.recycleBinListItemInfo}>
                                                    <span className={styles.recycleBinListItemName}>
                                                        {record.space.name || (language === 'zh' ? '未命名空间' : 'Untitled Space')}
                                                    </span>
                                                    <span className={styles.recycleBinListItemMeta}>
                                                        {formatDeletedAt(record.deletedAt, language)}
                                                    </span>
                                                </div>
                                                <button
                                                    className={styles.recycleBinListItemRestore}
                                                    onClick={() => restoreDeletedSpace(record.id)}
                                                >
                                                    {language === 'zh' ? '还原' : 'Restore'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
