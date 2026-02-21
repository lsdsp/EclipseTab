import React, { useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { scaleFadeIn, scaleFadeOut } from '../../utils/animations';
import { useLanguage } from '../../context/LanguageContext';
import styles from './ZenShelf.module.css';
import plusIcon from '../../assets/icons/plus.svg';
import writeIcon from '../../assets/icons/write.svg';
import trashIcon from '../../assets/icons/trash.svg';
import uploadIcon from '../../assets/icons/upload.svg';
import editIcon from '../../assets/icons/edit.svg';
import exportIcon from '../../assets/icons/export.svg';
import settingsIcon from '../../assets/icons/setting2.svg';
import pinIcon from '../../assets/icons/pin.svg';
import asteriskIcon from '../../assets/icons/asterisk.svg';
import slashIcon from '../../assets/icons/slash.svg';
import monitorIcon from '../../assets/icons/monitor.svg';

// ============================================================================
// ContextMenu Component - Right-click context menu
// ============================================================================

interface ContextMenuProps {
    x: number;
    y: number;
    type: 'background' | 'sticker';
    stickerId?: string;
    stickerKind?: 'image' | 'text' | 'widget';
    onClose: () => void;
    onAddSticker: () => void;
    onAddClockWidget?: () => void;
    onAddPomodoroWidget?: () => void;
    onAddTodoWidget?: () => void;
    onAddCalendarWidget?: () => void;
    hasSelection?: boolean;
    canGroupSelection?: boolean;
    canUngroupSelection?: boolean;
    canLockSelection?: boolean;
    canUnlockSelection?: boolean;
    isGridSnapEnabled?: boolean;
    widgetAutoGroupEnabled?: boolean;
    onGroupSelection?: () => void;
    onUngroupSelection?: () => void;
    onLockSelection?: () => void;
    onUnlockSelection?: () => void;
    onToggleGridSnap?: () => void;
    onToggleWidgetAutoGroup?: () => void;
    onUploadImage: () => void;
    onToggleEditMode: () => void;
    isEditMode: boolean;
    onEditSticker?: () => void;
    onDeleteSticker?: () => void;
    onCopyImage?: () => void;
    onCopyText?: () => void;
    onExportImage?: () => void;
    onExportImageSticker?: () => void;
    onOpenSettings?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    x,
    y,
    type,
    stickerKind = 'text',
    onClose,
    onAddSticker,
    onAddClockWidget,
    onAddPomodoroWidget,
    onAddTodoWidget,
    onAddCalendarWidget,
    hasSelection = false,
    canGroupSelection = false,
    canUngroupSelection = false,
    canLockSelection = false,
    canUnlockSelection = false,
    isGridSnapEnabled = true,
    widgetAutoGroupEnabled = false,
    onGroupSelection,
    onUngroupSelection,
    onLockSelection,
    onUnlockSelection,
    onToggleGridSnap,
    onToggleWidgetAutoGroup,
    onUploadImage,
    onToggleEditMode,
    isEditMode,
    onEditSticker,
    onDeleteSticker,
    onCopyImage,
    onCopyText,
    onExportImage,
    onExportImageSticker,
    onOpenSettings,
}) => {
    const { t } = useLanguage();
    const menuRef = useRef<HTMLDivElement>(null);
    const isClosingRef = useRef(false);

    // Close with animation
    const handleClose = useCallback(() => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;

        if (menuRef.current) {
            scaleFadeOut(menuRef.current, 200, () => {
                onClose();
            });
        } else {
            onClose();
        }
    }, [onClose]);

    // Animation on mount and when position changes
    useEffect(() => {
        isClosingRef.current = false;
        if (menuRef.current) {
            scaleFadeIn(menuRef.current);
        }
    }, [x, y]);

    // Click outside to close (ignore right-clicks to prevent race condition with new context menu)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Ignore right-clicks - they will trigger a new context menu via contextmenu event
            if (e.button === 2) return;

            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClose]);

    // Prevent default context menu
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    // Adjust position to stay within viewport
    const menuWidth = 220;
    const hasWhiteboardActions = isEditMode && (hasSelection || Boolean(onToggleGridSnap));
    const menuHeight = type === 'background'
        ? (hasWhiteboardActions ? 560 : 360)
        : stickerKind === 'widget'
            ? (hasWhiteboardActions ? 320 : 140)
            : (hasWhiteboardActions ? 430 : 220); // Approximate menu heights
    const padding = 10;

    // Calculate adjusted position, ensuring menu stays within viewport on all edges
    let adjustedX = x;
    let adjustedY = y;

    // Right edge
    if (x + menuWidth + padding > window.innerWidth) {
        adjustedX = window.innerWidth - menuWidth - padding;
    }
    // Left edge
    if (adjustedX < padding) {
        adjustedX = padding;
    }
    // Bottom edge  
    if (y + menuHeight + padding > window.innerHeight) {
        adjustedY = window.innerHeight - menuHeight - padding;
    }
    // Top edge
    if (adjustedY < padding) {
        adjustedY = padding;
    }

    const renderWhiteboardActions = () => {
        if (!isEditMode) return null;
        if (!hasSelection && !onToggleGridSnap) return null;

        return (
            <>
                <div className={styles.menuDivider} />
                {onToggleGridSnap && (
                    <button className={styles.menuItem} onClick={() => { onToggleGridSnap(); onClose(); }}>
                        <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${monitorIcon})`, maskImage: `url(${monitorIcon})` }} />
                        <span>{isGridSnapEnabled ? t.contextMenu.disableGridSnap : t.contextMenu.enableGridSnap}</span>
                    </button>
                )}
                {hasSelection && (
                    <>
                        <button
                            className={styles.menuItem}
                            disabled={!canGroupSelection}
                            onClick={() => { onGroupSelection?.(); onClose(); }}
                        >
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${asteriskIcon})`, maskImage: `url(${asteriskIcon})` }} />
                            <span>{t.contextMenu.groupSelection}</span>
                        </button>
                        <button
                            className={styles.menuItem}
                            disabled={!canUngroupSelection}
                            onClick={() => { onUngroupSelection?.(); onClose(); }}
                        >
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${slashIcon})`, maskImage: `url(${slashIcon})` }} />
                            <span>{t.contextMenu.ungroupSelection}</span>
                        </button>
                        <button
                            className={styles.menuItem}
                            disabled={!canLockSelection}
                            onClick={() => { onLockSelection?.(); onClose(); }}
                        >
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${pinIcon})`, maskImage: `url(${pinIcon})` }} />
                            <span>{t.contextMenu.lockSelection}</span>
                        </button>
                        <button
                            className={styles.menuItem}
                            disabled={!canUnlockSelection}
                            onClick={() => { onUnlockSelection?.(); onClose(); }}
                        >
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${pinIcon})`, maskImage: `url(${pinIcon})` }} />
                            <span>{t.contextMenu.unlockSelection}</span>
                        </button>
                    </>
                )}
            </>
        );
    };

    return createPortal(
        <div
            ref={menuRef}
            className={styles.contextMenu}
            data-ui-zone="zen-context-menu"
            style={{ left: adjustedX, top: adjustedY }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={styles.menuLabel}>EclipseTab</div>
            <div className={styles.menuDivider} />
            <div className={styles.menuOptions}>
                {type === 'background' ? (
                    <>
                        <button className={styles.menuItem} onClick={() => { onAddSticker(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${plusIcon})`, maskImage: `url(${plusIcon})` }} />
                            <span>{t.contextMenu.addSticker}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onAddClockWidget?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${monitorIcon})`, maskImage: `url(${monitorIcon})` }} />
                            <span>{t.contextMenu.addClockWidget}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onAddPomodoroWidget?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${monitorIcon})`, maskImage: `url(${monitorIcon})` }} />
                            <span>{t.contextMenu.addPomodoroWidget}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onAddTodoWidget?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${monitorIcon})`, maskImage: `url(${monitorIcon})` }} />
                            <span>{t.contextMenu.addTodoWidget}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onAddCalendarWidget?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${monitorIcon})`, maskImage: `url(${monitorIcon})` }} />
                            <span>{t.contextMenu.addCalendarWidget}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onUploadImage(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${uploadIcon})`, maskImage: `url(${uploadIcon})` }} />
                            <span>{t.contextMenu.uploadImage}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onToggleEditMode(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${editIcon})`, maskImage: `url(${editIcon})` }} />
                            <span>{isEditMode ? t.contextMenu.exitEditMode : t.contextMenu.editMode}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onToggleWidgetAutoGroup?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${pinIcon})`, maskImage: `url(${pinIcon})` }} />
                            <span>{widgetAutoGroupEnabled ? t.contextMenu.widgetAutoGroupOn : t.contextMenu.widgetAutoGroupOff}</span>
                        </button>
                        <button className={styles.menuItem} onClick={() => { onOpenSettings?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${settingsIcon})`, maskImage: `url(${settingsIcon})` }} />
                            <span>{t.contextMenu.settings}</span>
                        </button>
                        {renderWhiteboardActions()}
                    </>
                ) : (
                    <>
                        {stickerKind === 'image' ? (
                            <>
                                <button className={styles.menuItem} onClick={() => { onCopyImage?.(); onClose(); }}>
                                    <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${exportIcon})`, maskImage: `url(${exportIcon})` }} />
                                    <span>{t.contextMenu.copyImage}</span>
                                </button>
                                <button className={styles.menuItem} onClick={() => { onExportImageSticker?.(); onClose(); }}>
                                    <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${uploadIcon})`, maskImage: `url(${uploadIcon})` }} />
                                    <span>{t.contextMenu.exportImage}</span>
                                </button>
                            </>
                        ) : stickerKind === 'text' ? (
                            <>
                                <button className={styles.menuItem} onClick={() => { onCopyText?.(); onClose(); }}>
                                    <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${exportIcon})`, maskImage: `url(${exportIcon})` }} />
                                    <span>{t.contextMenu.copyText}</span>
                                </button>
                                <button className={styles.menuItem} onClick={() => { onEditSticker?.(); onClose(); }}>
                                    <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${writeIcon})`, maskImage: `url(${writeIcon})` }} />
                                    <span>{t.contextMenu.editSticker}</span>
                                </button>
                                <button className={styles.menuItem} onClick={() => { onExportImage?.(); onClose(); }}>
                                    <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${uploadIcon})`, maskImage: `url(${uploadIcon})` }} />
                                    <span>{t.contextMenu.exportAsImage}</span>
                                </button>
                            </>
                        ) : null}
                        {renderWhiteboardActions()}
                        <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => { onDeleteSticker?.(); onClose(); }}>
                            <span className={styles.menuIcon} style={{ WebkitMaskImage: `url(${trashIcon})`, maskImage: `url(${trashIcon})` }} />
                            <span>{t.contextMenu.deleteSticker}</span>
                        </button>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
