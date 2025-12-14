import React, { useState, useRef, useEffect } from 'react';
import { Space } from '../../types';
import { Modal } from './Modal';
import { scaleFadeIn } from '../../utils/animations';
import plusIcon from '../../assets/icons/plus.svg';
import writeIcon from '../../assets/icons/write.svg';
import trashIcon from '../../assets/icons/trash.svg';
import styles from './SpaceManageMenu.module.css';

interface SpaceManageMenuProps {
    /** 是否显示 */
    isOpen: boolean;

    /** 锚点位置 (Navigator 的 DOMRect) */
    anchorRect: DOMRect | null;

    /** 当前空间 */
    currentSpace: Space;

    /** 是否只剩一个空间 (禁用删除) */
    isLastSpace: boolean;

    /** 关闭菜单 */
    onClose: () => void;

    /** 新增空间 */
    onAdd: () => void;

    /** 重命名 */
    onRename: (newName: string) => void;

    /** 删除 */
    onDelete: () => void;
}

/**
 * SpaceManageMenu - 空间管理右键菜单
 * 使用共享 Modal 组件，与 AddEditModal/SearchEngineModal 保持一致的定位逻辑
 */
export function SpaceManageMenu({
    isOpen,
    anchorRect,
    currentSpace,
    isLastSpace,
    onClose,
    onAdd,
    onRename,
    onDelete,
}: SpaceManageMenuProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 打开时应用动画
    useEffect(() => {
        if (isOpen && menuRef.current) {
            scaleFadeIn(menuRef.current);
        }
    }, [isOpen]);

    // 重命名模式时自动聚焦
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    // 关闭时重置状态
    useEffect(() => {
        if (!isOpen) {
            setIsRenaming(false);
            setRenameValue('');
        }
    }, [isOpen]);

    const handleAddClick = () => {
        onAdd();
        onClose();
    };

    const handleRenameClick = () => {
        setRenameValue(currentSpace.name);
        setIsRenaming(true);
    };

    const handleRenameSubmit = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== currentSpace.name) {
            onRename(trimmed);
        }
        setIsRenaming(false);
        onClose();
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            setIsRenaming(false);
        }
    };

    const handleDeleteClick = () => {
        if (!isLastSpace && window.confirm(`Are you sure you want to delete the space "${currentSpace.name}"?\nAll applications in this space will be deleted.`)) {
            onDelete();
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={undefined} hideHeader anchorRect={anchorRect}>
            <div ref={menuRef} className={styles.menu}>
                {isRenaming ? (
                    <div className={styles.renameContainer}>
                        <div className={styles.renameLabel}>Rename Space</div>
                        <div className={styles.renameInputWrapper}>
                            <input
                                ref={inputRef}
                                type="text"
                                className={styles.renameInput}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={handleRenameKeyDown}
                                maxLength={10}
                                placeholder="Input space name"
                            />
                            <button
                                className={styles.confirmButton}
                                onClick={handleRenameSubmit}
                                disabled={!renameValue.trim() || renameValue.trim() === currentSpace.name}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.label}>Space</div>
                        <div className={styles.divider} />
                        <div className={styles.optionsContainer}>
                            <button className={styles.menuItem} onClick={handleAddClick}>
                                <span className={styles.icon} style={{ WebkitMaskImage: `url(${plusIcon})`, maskImage: `url(${plusIcon})` }} />
                                <span>Add space</span>
                            </button>
                            <button className={styles.menuItem} onClick={handleRenameClick}>
                                <span className={styles.icon} style={{ WebkitMaskImage: `url(${writeIcon})`, maskImage: `url(${writeIcon})` }} />
                                <span>Rename</span>
                            </button>
                            <button
                                className={`${styles.menuItem} ${styles.danger} ${isLastSpace ? styles.disabled : ''}`}
                                onClick={handleDeleteClick}
                                disabled={isLastSpace}
                                title={isLastSpace ? 'Reserve at least one space' : 'Delete current space'}
                            >
                                <span className={styles.icon} style={{ WebkitMaskImage: `url(${trashIcon})`, maskImage: `url(${trashIcon})` }} />
                                <span>Delete space</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
