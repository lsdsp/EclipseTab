import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Theme, useTheme, Texture } from '../../context/ThemeContext';
import { useSystemTheme } from '../../hooks/useSystemTheme';
import { useLanguage } from '../../context/LanguageContext';
import { useSpaces } from '../../context/SpacesContext';
import { useDockData } from '../../context/DockContext';
import { useUndo } from '../../context/UndoContext';
import { GRADIENT_PRESETS } from '../../constants/gradients';
import { scaleFadeIn, scaleFadeOut } from '../../utils/animations';
import styles from './SettingsModal.module.css';
import { TEXTURE_PATTERNS } from '../../constants/textures';
import defaultIcon from '../../assets/icons/star3.svg';
import lightIcon from '../../assets/icons/sun.svg';
import darkIcon from '../../assets/icons/moon.svg';
import autoIcon from '../../assets/icons/monitor.svg';
import slashIcon from '../../assets/icons/slash.svg';
import asteriskIcon from '../../assets/icons/asterisk.svg';
import circleIcon from '../../assets/icons/texture background/circle-preview.svg';
import crossIcon from '../../assets/icons/texture background/cross-preview.svg';
import { WallpaperGallery } from '../WallpaperGallery/WallpaperGallery';
import {
    checkSuggestionPermissionForOrigin,
    SUGGESTION_PERMISSION_REQUEST_ORIGINS,
    SUGGESTION_PROVIDER_ORIGINS,
} from '../../hooks/searchSuggestions';
import { storage } from '../../utils/storage';
import {
    applyBackupImport,
    BackupImportStrategy,
    BackupPackage,
    exportFullBackupToZip,
    exportSpaceSnapshotToZip,
    parseBackupFile,
    previewBackupImport,
} from '../../utils/fullBackup';
import {
    buildBookmarkImportPreview,
    createDockItemsFromBookmarks,
} from '../../utils/bookmarkImport';
import {
    cleanupOldWallpapers,
    collectStorageStats,
    formatBytes,
    recompressStickerAssets,
    StorageStats,
} from '../../utils/storageDashboard';
import { fetchIcon } from '../../utils/iconFetcher';


interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    anchorPosition: { x: number; y: number };
}

const DEFAULT_IMPORT_PREVIEW_STRATEGY: BackupImportStrategy = 'merge';

const defaultConfirm = (message: string): boolean => {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
        return false;
    }
    return window.confirm(message);
};

export const promptImportStrategy = (
    language: 'zh' | 'en',
    confirmFn: (message: string) => boolean = defaultConfirm
): BackupImportStrategy | null => {
    const mergeSelected = confirmFn(
        language === 'zh'
            ? '导入策略：确定 = 合并导入；取消 = 继续选择覆盖导入。'
            : 'Import strategy: OK = merge import; Cancel = continue to overwrite option.'
    );
    if (mergeSelected) {
        return 'merge';
    }

    const overwriteSelected = confirmFn(
        language === 'zh'
            ? '是否使用覆盖导入？（取消则放弃本次导入）'
            : 'Use overwrite import? (Cancel to abort this import)'
    );
    if (overwriteSelected) {
        return 'overwrite';
    }

    return null;
};

// 简单的权限切换组件
const PermissionToggle: React.FC = () => {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [permissionApiAvailable, setPermissionApiAvailable] = useState(true);
    const { t } = useLanguage();

    const refreshPermissionState = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.permissions?.contains) {
            setPermissionApiAvailable(false);
            setEnabled(false);
            return;
        }

        setPermissionApiAvailable(true);
        const [googleAvailable, baiduAvailable] = await Promise.all(
            SUGGESTION_PROVIDER_ORIGINS.map((origin) =>
                checkSuggestionPermissionForOrigin(origin)
            )
        );
        setEnabled(googleAvailable || baiduAvailable);
    }, []);

    useEffect(() => {
        void refreshPermissionState();
    }, [refreshPermissionState]);

    const handleToggle = () => {
        if (loading || enabled === null || !permissionApiAvailable) return;
        setLoading(true);

        if (typeof chrome === 'undefined' || !chrome.permissions) {
            setLoading(false);
            return;
        }

        if (enabled) {
            // 移除权限
            chrome.permissions.remove({ origins: [...SUGGESTION_PERMISSION_REQUEST_ORIGINS] }, (removed) => {
                if (removed) {
                    void refreshPermissionState();
                }
                setLoading(false);
            });
        } else {
            // 请求权限
            chrome.permissions.request({ origins: [...SUGGESTION_PERMISSION_REQUEST_ORIGINS] }, (granted) => {
                if (granted) {
                    void refreshPermissionState();
                }
                setLoading(false);
            });
        }
    };

    return (
        <div className={styles.layoutToggleGroup}>
            {enabled !== null && (
                <div
                    className={styles.layoutHighlight}
                    style={{
                        transform: `translateX(${enabled ? 0 : 100}%)`,
                    }}
                />
            )}
            <button
                className={styles.layoutToggleOption}
                onClick={enabled === true || !permissionApiAvailable ? undefined : handleToggle}
                title={t.settings.on}
                disabled={!permissionApiAvailable || loading}
            >
                {t.settings.on}
            </button>
            <button
                className={styles.layoutToggleOption}
                onClick={enabled === false || !permissionApiAvailable ? undefined : handleToggle}
                title={t.settings.off}
                disabled={!permissionApiAvailable || loading}
            >
                {t.settings.off}
            </button>
        </div>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, anchorPosition }) => {
    const {
        theme,
        setTheme,
        followSystem,
        setFollowSystem,
        wallpaper,
        setWallpaper,
        gradientId,
        setGradientId,
        texture,
        setTexture,
        dockPosition,
        setDockPosition,
        iconSize,
        setIconSize,
        openInNewTab,
        setOpenInNewTab,
    } = useTheme();

    const { language, setLanguage, t } = useLanguage();
    const { currentSpace } = useSpaces();
    const {
        dockItems,
        setDockItems,
        appendDockItems,
    } = useDockData();
    const { showUndo } = useUndo();

    const [allowThirdPartyIconService, setAllowThirdPartyIconService] = useState<boolean>(() =>
        storage.getAllowThirdPartyIconService()
    );

    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [storageLoading, setStorageLoading] = useState(false);
    const [importPackage, setImportPackage] = useState<BackupPackage | null>(null);
    const [importPreviewText, setImportPreviewText] = useState<string>('');
    const [importBusy, setImportBusy] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [bookmarkLimit, setBookmarkLimit] = useState(20);
    const [bookmarkMergeByDomain, setBookmarkMergeByDomain] = useState(true);
    const [bookmarkPreview, setBookmarkPreview] = useState<ReturnType<typeof buildBookmarkImportPreview> | null>(null);
    const [bookmarkBusy, setBookmarkBusy] = useState(false);

    const systemTheme = useSystemTheme();
    const [isVisible, setIsVisible] = useState(isOpen);
    const modalRef = useRef<HTMLDivElement>(null);
    const isClosingRef = useRef(false);

    // 确定我们是处于“默认”模式还是“浅色/深色”模式的逻辑
    const isDefaultTheme = theme === 'default' && !followSystem;

    // 注意：纹理仅在非默认主题中显示（在 ThemeContext 中处理）
    // 我们不再在切换到默认主题时重置纹理，这样它就可以被记住

    // 动画效果 - 打开
    useEffect(() => {
        if (isOpen) {
            isClosingRef.current = false;
            setIsVisible(true);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && isVisible && modalRef.current) {
            scaleFadeIn(modalRef.current);
        }
    }, [isOpen, isVisible]);

    const refreshStorageStats = useCallback(async () => {
        setStorageLoading(true);
        try {
            const stats = await collectStorageStats();
            setStorageStats(stats);
        } finally {
            setStorageLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            void refreshStorageStats();
        }
    }, [isOpen, refreshStorageStats]);

    // 动画效果 - 关闭（由父组件设置 isOpen=false 触发）
    useEffect(() => {
        if (!isOpen && isVisible && !isClosingRef.current) {
            isClosingRef.current = true;
            if (modalRef.current) {
                scaleFadeOut(modalRef.current, 300, () => setIsVisible(false));
            } else {
                setIsVisible(false);
            }
        }
    }, [isOpen, isVisible]);

    const handleThemeSelect = (selectedTheme: Theme) => {
        setTheme(selectedTheme);
        // 选择默认主题时，将 gradientId 重置为主题默认值
        if (selectedTheme === 'default') {
            setGradientId('theme-default');
        }
        if (followSystem) {
            setFollowSystem(false);
        }
    };

    const handleToggleFollowSystem = () => {
        setFollowSystem(!followSystem);
    };

    const handleGradientSelect = (id: string) => {
        // 如果有壁纸，只需清除它并直接设置渐变
        // 不需要特殊处理，因为视觉上的变化是从壁纸到颜色的
        if (wallpaper) {
            setWallpaper(null);
            setGradientId(id);
            return;
        }

        // 如果点击相同的渐变（且没有壁纸），我们需要通过首先使用一个临时的不同值来强制 React 更新
        if (gradientId === id) {
            const tempId = id === 'theme-default' ? 'gradient-1' : 'theme-default';
            setGradientId(tempId);
            // 通过使用 requestAnimationFrame 强制进行同步更新
            requestAnimationFrame(() => {
                setGradientId(id);
            });
        } else {
            setGradientId(id);
        }
    };

    const handleTextureSelect = (selectedTexture: Texture) => {
        setTexture(selectedTexture);
    };

    const handleThirdPartyIconServiceToggle = (next: boolean) => {
        if (next && !storage.getThirdPartyIconServicePrompted()) {
            storage.saveThirdPartyIconServicePrompted(true);
            const accepted = window.confirm(t.settings.thirdPartyIconServiceHint);
            if (!accepted) {
                return;
            }
        }

        setAllowThirdPartyIconService(next);
        storage.saveAllowThirdPartyIconService(next);
    };

    const describePreview = useCallback((preview: Awaited<ReturnType<typeof previewBackupImport>>) => {
        const lines = [
            language === 'zh' ? `空间：新增 ${preview.spaces.add} / 覆盖 ${preview.spaces.overwrite} / 冲突 ${preview.spaces.conflict}` : `Spaces: +${preview.spaces.add} / overwrite ${preview.spaces.overwrite} / conflicts ${preview.spaces.conflict}`,
            language === 'zh' ? `Dock URL：新增 ${preview.dockUrls.add} / 覆盖 ${preview.dockUrls.overwrite} / 冲突 ${preview.dockUrls.conflict}` : `Dock URLs: +${preview.dockUrls.add} / overwrite ${preview.dockUrls.overwrite} / conflicts ${preview.dockUrls.conflict}`,
            language === 'zh' ? `贴纸：新增 ${preview.stickers.add} / 覆盖 ${preview.stickers.overwrite} / 冲突 ${preview.stickers.conflict}` : `Stickers: +${preview.stickers.add} / overwrite ${preview.stickers.overwrite} / conflicts ${preview.stickers.conflict}`,
            language === 'zh' ? `壁纸资源：新增 ${preview.wallpapers.add} / 覆盖 ${preview.wallpapers.overwrite} / 冲突 ${preview.wallpapers.conflict}` : `Wallpapers: +${preview.wallpapers.add} / overwrite ${preview.wallpapers.overwrite} / conflicts ${preview.wallpapers.conflict}`,
            language === 'zh' ? `贴纸资源：新增 ${preview.stickerAssets.add} / 覆盖 ${preview.stickerAssets.overwrite} / 冲突 ${preview.stickerAssets.conflict}` : `Sticker assets: +${preview.stickerAssets.add} / overwrite ${preview.stickerAssets.overwrite} / conflicts ${preview.stickerAssets.conflict}`,
        ];
        return lines.join('\n');
    }, [language]);

    const handleExportFullBackup = async () => {
        try {
            await exportFullBackupToZip();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Export failed');
        }
    };

    const handleExportCurrentSpace = async () => {
        try {
            await exportSpaceSnapshotToZip(currentSpace);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Export failed');
        }
    };

    const handleSelectImportFile = () => {
        importInputRef.current?.click();
    };

    const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const parsed = await parseBackupFile(file);
            setImportPackage(parsed);
            const preview = await previewBackupImport(parsed, DEFAULT_IMPORT_PREVIEW_STRATEGY);
            setImportPreviewText(describePreview(preview));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Import file parse failed';
            window.alert(message);
            setImportPackage(null);
            setImportPreviewText('');
        } finally {
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };

    const handleApplyImport = async () => {
        if (!importPackage || importBusy) return;

        const selectedStrategy = promptImportStrategy(language);
        if (!selectedStrategy) return;

        const confirmed = window.confirm(
            language === 'zh'
                ? `即将执行 ${selectedStrategy === 'merge' ? '合并导入' : '覆盖导入'}，是否继续？`
                : `Import with strategy "${selectedStrategy}" now?`
        );
        if (!confirmed) return;

        setImportBusy(true);
        try {
            const preview = await previewBackupImport(importPackage, selectedStrategy);
            setImportPreviewText(describePreview(preview));
            const result = await applyBackupImport(importPackage, selectedStrategy);
            window.alert(
                language === 'zh'
                    ? `导入完成（${result.strategy}）`
                    : `Import completed (${result.strategy})`
            );
            window.location.reload();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Import failed';
            window.alert(message);
        } finally {
            setImportBusy(false);
        }
    };

    const requestBookmarkPermission = async (): Promise<boolean> => {
        if (typeof chrome === 'undefined' || !chrome.permissions?.request || !chrome.permissions?.contains) {
            return false;
        }

        const alreadyGranted = await new Promise<boolean>((resolve) => {
            chrome.permissions.contains({ permissions: ['bookmarks'] }, (result) => {
                if (chrome.runtime?.lastError) {
                    resolve(false);
                    return;
                }
                resolve(Boolean(result));
            });
        });
        if (alreadyGranted) return true;

        return new Promise<boolean>((resolve) => {
            chrome.permissions.request({ permissions: ['bookmarks'] }, (granted) => {
                if (chrome.runtime?.lastError) {
                    resolve(false);
                    return;
                }
                resolve(Boolean(granted));
            });
        });
    };

    const loadBookmarkPreview = async () => {
        setBookmarkBusy(true);
        try {
            const granted = await requestBookmarkPermission();
            if (!granted) {
                window.alert(language === 'zh' ? '未授予书签权限，无法导入。' : 'Bookmark permission was not granted.');
                return;
            }
            const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => {
                chrome.bookmarks.getTree((nodes) => resolve(nodes));
            });
            const preview = buildBookmarkImportPreview(tree, dockItems, {
                limit: bookmarkLimit,
                mergeByDomain: bookmarkMergeByDomain,
            });
            setBookmarkPreview(preview);
        } finally {
            setBookmarkBusy(false);
        }
    };

    const importBookmarks = async () => {
        if (!bookmarkPreview || bookmarkPreview.selected.length === 0) return;
        const newItems = createDockItemsFromBookmarks(bookmarkPreview.selected);
        const withIcons = await Promise.all(
            newItems.map(async (item) => {
                if (!item.url) return item;
                try {
                    const icon = await fetchIcon(item.url);
                    return { ...item, icon: icon.url };
                } catch {
                    return item;
                }
            })
        );

        appendDockItems(withIcons);
        const importedIds = new Set(withIcons.map((item) => item.id));
        showUndo(
            language === 'zh' ? `已导入 ${withIcons.length} 个书签` : `Imported ${withIcons.length} bookmarks`,
            () => {
                setDockItems(prev => prev.filter(item => !importedIds.has(item.id)));
            }
        );
    };

    const handleCleanupWallpapers = async () => {
        const result = await cleanupOldWallpapers(6);
        window.alert(
            language === 'zh'
                ? `已清理 ${result.removedCount} 张旧壁纸，约释放 ${formatBytes(result.estimatedFreedBytes)}`
                : `Removed ${result.removedCount} wallpapers, freed ~${formatBytes(result.estimatedFreedBytes)}`
        );
        void refreshStorageStats();
    };

    const handleRecompressStickers = async () => {
        const result = await recompressStickerAssets();
        window.alert(
            language === 'zh'
                ? `已重压缩 ${result.removedCount} 个贴纸资源，约释放 ${formatBytes(result.estimatedFreedBytes)}`
                : `Recompressed ${result.removedCount} sticker assets, freed ~${formatBytes(result.estimatedFreedBytes)}`
        );
        void refreshStorageStats();
    };

    const modalStyle: React.CSSProperties = {
        left: `${anchorPosition.x}px`,
        top: `${anchorPosition.y}px`,
    };

    // 高亮索引：0 = 自动, 1 = 浅色, 2 = 深色
    let activeIndex = -1;
    if (followSystem) {
        activeIndex = 0;
    } else if (theme === 'light') {
        activeIndex = 1;
    } else if (theme === 'dark') {
        activeIndex = 2;
    }

    const highlightStyle: React.CSSProperties = {
        transform: activeIndex >= 0 ? `translateX(${activeIndex * 56}px)` : 'scale(0)',
        opacity: activeIndex >= 0 ? 1 : 0,
    };

    // 处理带有动画的关闭
    const handleClose = () => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;

        if (modalRef.current) {
            scaleFadeOut(modalRef.current, 300, () => {
                setIsVisible(false);
                onClose();
            });
        } else {
            setIsVisible(false);
            onClose();
        }
    };

    if (!isVisible) return null;

    return (
        <>
            <div className={styles.backdrop} data-ui-zone="settings-modal" onClick={handleClose} />
            <div ref={modalRef} className={styles.modal} data-ui-zone="settings-modal" style={modalStyle}>
                <div className={styles.innerContainer}>
                    {/* 主题部分 */}
                    <div className={styles.iconContainer}>
                        {/* 主题组 (自动 / 浅色 / 深色) */}
                        <div className={styles.themeGroupContainer}>
                            <div className={styles.highlightBackground} style={highlightStyle} />
                            <button
                                className={styles.themeGroupOption}
                                onClick={handleToggleFollowSystem}
                                title={t.settings.followSystem}
                            >
                                <img src={autoIcon} alt="Follow System" width={24} height={24} />
                            </button>
                            <button
                                className={styles.themeGroupOption}
                                onClick={() => handleThemeSelect('light')}
                                title={t.settings.lightTheme}
                            >
                                <img src={lightIcon} alt="Light Theme" width={24} height={24} />
                            </button>
                            <button
                                className={styles.themeGroupOption}
                                onClick={() => handleThemeSelect('dark')}
                                title={t.settings.darkTheme}
                            >
                                <img src={darkIcon} alt="Dark Theme" width={24} height={24} />
                            </button>
                        </div>
                        {/* 默认主题按钮 */}
                        <button
                            className={`${styles.defaultTheme} ${isDefaultTheme ? styles.defaultThemeActive : ''}`}
                            onClick={() => handleThemeSelect('default')}
                            title={t.settings.defaultTheme}
                        >
                            <img src={defaultIcon} alt="Default Theme" width={24} height={24} />
                        </button>
                    </div>

                    {/* 纹理部分 - 带有动画的包装器 */}
                    <div
                        className={`${styles.textureSectionWrapper} ${!isDefaultTheme && !wallpaper ? styles.textureSectionWrapperOpen : ''}`}
                    >
                        <div className={styles.textureSection}>
                            {/* None */}
                            <button
                                className={`${styles.textureOption} ${texture === 'none' ? styles.textureOptionActive : ''}`}
                                onClick={() => handleTextureSelect('none')}
                                title={t.settings.noTexture}
                            >
                                <div className={styles.texturePreviewNone}>
                                    <img src={slashIcon} alt="No Texture" width={24} height={24} />
                                </div>
                            </button>
                            {/* Dynamic Texture Options */}
                            {(['point', 'cross'] as const).map(textureId => {
                                const pattern = TEXTURE_PATTERNS[textureId];
                                const Icon = textureId === 'point' ? circleIcon : crossIcon;
                                return (
                                    <button
                                        key={textureId}
                                        className={`${styles.textureOption} ${texture === textureId ? styles.textureOptionActive : ''}`}
                                        onClick={() => handleTextureSelect(textureId)}
                                        title={pattern.name}
                                    >
                                        <div className={styles.texturePreviewNone}>
                                            <img
                                                src={Icon}
                                                alt={pattern.name}
                                                width={24}
                                                height={24}
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 颜色选项部分 - 已移动到壁纸上方 */}
                    <div className={styles.colorOptionsContainer}>
                        {GRADIENT_PRESETS.map(preset => {
                            // 对于 theme-default 预设，根据活动主题使用动态颜色
                            let displayColor = '';
                            const isThemeDefault = preset.id === 'theme-default';

                            if (isThemeDefault) {
                                displayColor = 'var(--color-bg-secondary)';
                            } else if (isDefaultTheme) {
                                displayColor = preset.gradient;
                            } else {
                                // 对于非默认主题，根据是否为深色模式选择 solid 或 solidDark
                                const isDarkTheme = theme === 'dark' || (followSystem && systemTheme === 'dark');
                                displayColor = isDarkTheme && 'solidDark' in preset ? preset.solidDark : preset.solid;
                            }

                            // 当使用壁纸时，不显示颜色选项的选中状态
                            const isActive = !wallpaper && gradientId === preset.id;

                            return (
                                <button
                                    key={preset.id}
                                    className={`${styles.colorOption} ${isActive ? styles.colorOptionActive : ''}`}
                                    onClick={() => handleGradientSelect(preset.id)}
                                    title={preset.name}
                                    style={{
                                        background: displayColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {isThemeDefault && (
                                        <img
                                            src={asteriskIcon}
                                            alt="Default"
                                            width={24}
                                            height={24}
                                            style={{
                                                filter: (theme === 'dark' || (followSystem && systemTheme === 'dark')) ? 'invert(1)' : 'none'
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* 壁纸部分 - 已移动到底部 */}
                    <div className={styles.wallpaperSection}>
                        <WallpaperGallery />
                    </div>

                    {/* 布局设置部分 */}
                    <div className={styles.layoutSection}>
                        {/* 语言设置 */}
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.language}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${language === 'zh' ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setLanguage('zh')}
                                    title="中文"
                                >
                                    中文
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setLanguage('en')}
                                    title="EN"
                                >
                                    EN
                                </button>
                            </div>
                        </div>

                        {/* Dock 位置 */}
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.position}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${dockPosition === 'bottom' ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setDockPosition('bottom')}
                                    title={t.settings.bottom}
                                >
                                    {t.settings.bottom}
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setDockPosition('center')}
                                    title={t.settings.center}
                                >
                                    {t.settings.center}
                                </button>
                            </div>
                        </div>
                        {/* 图标大小 */}
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.iconSize}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${iconSize === 'large' ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setIconSize('large')}
                                    title={t.settings.large}
                                >
                                    {t.settings.large}
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setIconSize('small')}
                                    title={t.settings.small}
                                >
                                    {t.settings.small}
                                </button>
                            </div>
                        </div>

                        {/* 搜索建议 (可选权限) */}
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.suggestions}</span>
                            <PermissionToggle />
                        </div>

                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.thirdPartyIconService}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${allowThirdPartyIconService ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => handleThirdPartyIconServiceToggle(true)}
                                    title={t.settings.on}
                                >
                                    {t.settings.on}
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => handleThirdPartyIconServiceToggle(false)}
                                    title={t.settings.off}
                                >
                                    {t.settings.off}
                                </button>
                            </div>
                        </div>

                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{t.settings.openInNewTab}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${openInNewTab ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setOpenInNewTab(true)}
                                    title={t.settings.on}
                                >
                                    {t.settings.on}
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setOpenInNewTab(false)}
                                    title={t.settings.off}
                                >
                                    {t.settings.off}
                                </button>
                            </div>
                        </div>

                        <div className={styles.sectionDivider} />

                        <div className={styles.subSectionTitle}>
                            {language === 'zh' ? '数据管理' : 'Data Management'}
                        </div>
                        <div className={styles.actionRow}>
                            <button className={styles.actionButton} onClick={handleExportFullBackup}>
                                {language === 'zh' ? '导出全量备份' : 'Export Full Backup'}
                            </button>
                            <button className={styles.actionButton} onClick={handleExportCurrentSpace}>
                                {language === 'zh' ? '导出当前空间包' : 'Export Current Space'}
                            </button>
                        </div>
                        <div className={styles.actionRow}>
                            <button className={styles.actionButton} onClick={handleSelectImportFile}>
                                {language === 'zh' ? '选择导入文件' : 'Select Import File'}
                            </button>
                            <input
                                ref={importInputRef}
                                type="file"
                                accept=".zip,.json"
                                style={{ display: 'none' }}
                                onChange={handleImportFileChange}
                            />
                        </div>
                        {importPreviewText && (
                            <pre className={styles.previewBox}>{importPreviewText}</pre>
                        )}
                        <div className={styles.actionRow}>
                            <button
                                className={styles.actionButton}
                                disabled={!importPackage || importBusy}
                                onClick={handleApplyImport}
                            >
                                {importBusy
                                    ? (language === 'zh' ? '导入中...' : 'Importing...')
                                    : (language === 'zh' ? '执行导入' : 'Run Import')}
                            </button>
                        </div>

                        <div className={styles.sectionDivider} />
                        <div className={styles.subSectionTitle}>
                            {language === 'zh' ? '书签导入' : 'Bookmarks Import'}
                        </div>
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>
                                {language === 'zh' ? `前 N 项（当前 ${bookmarkLimit}）` : `Top N (${bookmarkLimit})`}
                            </span>
                            <input
                                className={styles.numberInput}
                                type="number"
                                min={1}
                                max={200}
                                value={bookmarkLimit}
                                onChange={(e) => setBookmarkLimit(Math.max(1, Math.min(200, Number(e.target.value) || 20)))}
                            />
                        </div>
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>{language === 'zh' ? '同域名合并' : 'Merge Same Domain'}</span>
                            <div className={styles.layoutToggleGroup}>
                                <div
                                    className={styles.layoutHighlight}
                                    style={{
                                        transform: `translateX(${bookmarkMergeByDomain ? 0 : 100}%)`,
                                    }}
                                />
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setBookmarkMergeByDomain(true)}
                                >
                                    {t.settings.on}
                                </button>
                                <button
                                    className={styles.layoutToggleOption}
                                    onClick={() => setBookmarkMergeByDomain(false)}
                                >
                                    {t.settings.off}
                                </button>
                            </div>
                        </div>
                        <div className={styles.actionRow}>
                            <button className={styles.actionButton} onClick={loadBookmarkPreview} disabled={bookmarkBusy}>
                                {bookmarkBusy
                                    ? (language === 'zh' ? '读取中...' : 'Loading...')
                                    : (language === 'zh' ? '读取书签预览' : 'Load Preview')}
                            </button>
                            <button
                                className={styles.actionButton}
                                onClick={importBookmarks}
                                disabled={!bookmarkPreview || bookmarkPreview.selected.length === 0}
                            >
                                {language === 'zh' ? '导入到 Dock' : 'Import to Dock'}
                            </button>
                        </div>
                        {bookmarkPreview && (
                            <pre className={styles.previewBox}>
                                {language === 'zh'
                                    ? `共 ${bookmarkPreview.total} 条，待导入 ${bookmarkPreview.selected.length} 条\n重复 URL 跳过 ${bookmarkPreview.skippedExistingUrl} 条\n同域名合并跳过 ${bookmarkPreview.skippedDomainMerged} 条`
                                    : `Total ${bookmarkPreview.total}, selected ${bookmarkPreview.selected.length}\nSkipped existing URLs: ${bookmarkPreview.skippedExistingUrl}\nSkipped by domain merge: ${bookmarkPreview.skippedDomainMerged}`}
                            </pre>
                        )}

                        <div className={styles.sectionDivider} />
                        <div className={styles.subSectionTitle}>
                            {language === 'zh' ? '存储仪表盘' : 'Storage Dashboard'}
                        </div>
                        <div className={styles.layoutRow}>
                            <span className={styles.layoutLabel}>
                                {storageLoading
                                    ? (language === 'zh' ? '统计中...' : 'Loading...')
                                    : (language === 'zh'
                                        ? `已用 ${formatBytes(storageStats?.overview.usedBytes ?? null)} / 配额 ${formatBytes(storageStats?.overview.quotaBytes ?? null)}`
                                        : `Used ${formatBytes(storageStats?.overview.usedBytes ?? null)} / Quota ${formatBytes(storageStats?.overview.quotaBytes ?? null)}`)}
                            </span>
                        </div>
                        {storageStats && (
                            <pre className={styles.previewBox}>
                                {language === 'zh'
                                    ? `贴纸 ${storageStats.stickersCount}\n图片贴纸 ${formatBytes(storageStats.imageStickerBytes)}\n壁纸历史 ${formatBytes(storageStats.wallpaperBytes)}\n图标缓存估算 ${formatBytes(storageStats.iconBytes)}`
                                    : `Stickers ${storageStats.stickersCount}\nImage stickers ${formatBytes(storageStats.imageStickerBytes)}\nWallpapers ${formatBytes(storageStats.wallpaperBytes)}\nIcon cache estimate ${formatBytes(storageStats.iconBytes)}`}
                            </pre>
                        )}
                        <div className={styles.actionRow}>
                            <button className={styles.actionButton} onClick={() => void refreshStorageStats()}>
                                {language === 'zh' ? '刷新统计' : 'Refresh'}
                            </button>
                            <button className={styles.actionButton} onClick={() => void handleCleanupWallpapers()}>
                                {language === 'zh' ? '清理旧壁纸' : 'Clean Old Wallpapers'}
                            </button>
                        </div>
                        <div className={styles.actionRow}>
                            <button className={styles.actionButton} onClick={() => void handleRecompressStickers()}>
                                {language === 'zh' ? '重压缩贴纸图片' : 'Recompress Stickers'}
                            </button>
                        </div>

                    </div>


                    {/* 页脚 - GitHub 链接 */}
                    <div className={styles.footer}>
                        <a
                            href="https://github.com/lsdsp/EclipseTab"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.githubLink}
                            title="View on GitHub"
                        >
                            <span>GitHub</span>
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
};
