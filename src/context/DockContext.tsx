import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DockItem, SearchEngine } from '../types';
import { storage } from '../utils/storage';
import { DEFAULT_SEARCH_ENGINE, GOOGLE_ENGINE, SEARCH_ENGINES } from '../constants/searchEngines';
import { generateFolderIcon, fetchIcon } from '../utils/iconFetcher';
import { useSpaces } from './SpacesContext';
import { shouldSyncDockItemsToSpace } from './dockSync';

// ============================================================================
// 数据层 Context (低频变化)
// ============================================================================

interface DockDataContextType {
    dockItems: DockItem[];
    searchEngines: SearchEngine[];
    selectedSearchEngine: SearchEngine;
    setDockItems: React.Dispatch<React.SetStateAction<DockItem[]>>;
    setSelectedSearchEngine: (engine: SearchEngine) => void;
    addSearchEngine: (engine: Omit<SearchEngine, 'id'>) => SearchEngine;
    removeSearchEngine: (engineId: string) => void;
    handleItemSave: (data: Partial<DockItem>, editingItem: DockItem | null) => void;
    handleItemsReorder: (items: DockItem[]) => void;
    handleItemDelete: (item: DockItem) => void;
    handleFolderItemsReorder: (folderId: string, items: DockItem[]) => void;
    handleFolderItemDelete: (folderId: string, item: DockItem) => void;
    handleDragFromFolder: (item: DockItem, insertIndex?: number) => void;
    handleDragToFolder: (item: DockItem) => void;
    handleDropOnFolder: (dragItem: DockItem, targetFolder: DockItem) => void;
}

const DockDataContext = createContext<DockDataContextType | undefined>(undefined);

// ============================================================================
// UI 层 Context (中频变化)
// ============================================================================

interface DockUIContextType {
    isEditMode: boolean;
    openFolderId: string | null;
    folderAnchor: DOMRect | null;
    setIsEditMode: (value: boolean) => void;
    setOpenFolderId: (id: string | null) => void;
    setFolderAnchor: (rect: DOMRect | null) => void;
}

const DockUIContext = createContext<DockUIContextType | undefined>(undefined);

// ============================================================================
// Drag Context (频繁变化/拖拽相关)
// ============================================================================

interface DockDragContextType {
    draggingItem: DockItem | null;
    setDraggingItem: (item: DockItem | null) => void;
    /** 文件夹是否有活动的占位符 (用于跨组件拖拽检测) */
    folderPlaceholderActive: boolean;
    setFolderPlaceholderActive: (active: boolean) => void;
}

const DockDragContext = createContext<DockDragContextType | undefined>(undefined);

// ============================================================================
// 组合 Context (用于需要同时访问数据和 UI 的场景)
// ============================================================================

interface DockContextType extends DockDataContextType, DockUIContextType, DockDragContextType {
    handleItemClick: (item: DockItem, rect?: DOMRect) => void;
    handleItemEdit: (item: DockItem, rect?: DOMRect) => void;
    handleHoverOpenFolder: (item: DockItem, folder: DockItem) => void;
    openFolder: DockItem | undefined;
}

const isValidSearchEngine = (engine: unknown): engine is SearchEngine => {
    if (!engine || typeof engine !== 'object') return false;
    const candidate = engine as SearchEngine;
    return typeof candidate.id === 'string' &&
        typeof candidate.name === 'string' &&
        typeof candidate.url === 'string';
};

const cloneEngine = (engine: SearchEngine): SearchEngine => ({ ...engine });

const normalizeSearchEngines = (engines: SearchEngine[]): SearchEngine[] => {
    const normalized: SearchEngine[] = [cloneEngine(GOOGLE_ENGINE)];
    const seenIds = new Set<string>([GOOGLE_ENGINE.id]);

    engines.forEach((engine) => {
        if (!isValidSearchEngine(engine)) return;
        if (engine.id === GOOGLE_ENGINE.id) return;

        const id = engine.id.trim();
        const name = engine.name.trim();
        const url = engine.url.trim();

        if (!id || !name || !url || seenIds.has(id)) return;

        normalized.push({ id, name, url });
        seenIds.add(id);
    });

    return normalized;
};

const getInitialSearchEngines = (): SearchEngine[] => {
    const storedEngines = storage.getSearchEngines();
    if (storedEngines !== null) {
        return normalizeSearchEngines(storedEngines);
    }
    return normalizeSearchEngines(SEARCH_ENGINES);
};

const getInitialSelectedSearchEngine = (engines: SearchEngine[]): SearchEngine => {
    const savedEngine = storage.getSearchEngine();
    if (savedEngine && isValidSearchEngine(savedEngine)) {
        const matchedEngine = engines.find((engine) => engine.id === savedEngine.id);
        if (matchedEngine) {
            return cloneEngine(matchedEngine);
        }
        if (engines.length === 0) {
            return cloneEngine(savedEngine);
        }
    }

    if (engines.length > 0) {
        return cloneEngine(engines[0]);
    }

    return cloneEngine(DEFAULT_SEARCH_ENGINE);
};

// ============================================================================
// Provider 实现
// ============================================================================

export const DockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 从 SpacesContext 获取当前空间的 apps
    const { currentSpace, updateCurrentSpaceApps } = useSpaces();

    // 数据状态: dockItems 来自当前 Space
    // 额外记录 spaceId 用于避免空间切换瞬间把旧空间数据同步到新空间
    const [dockItemsState, setDockItemsState] = useState<{ spaceId: string; items: DockItem[] }>({
        spaceId: currentSpace.id,
        items: currentSpace.apps,
    });
    const dockItems = dockItemsState.items;
    const [searchEngines, setSearchEnginesState] = useState<SearchEngine[]>(() => getInitialSearchEngines());
    const [selectedSearchEngine, setSelectedSearchEngineState] = useState<SearchEngine>(() => {
        const engines = getInitialSearchEngines();
        return getInitialSelectedSearchEngine(engines);
    });

    // UI 状态 (中频变化)
    const [isEditMode, setIsEditModeState] = useState(false);
    const [openFolderId, setOpenFolderIdState] = useState<string | null>(null);
    const [folderAnchor, setFolderAnchor] = useState<DOMRect | null>(null);
    const [draggingItem, setDraggingItem] = useState<DockItem | null>(null);
    const [folderPlaceholderActive, setFolderPlaceholderActive] = useState(false);

    // 当 currentSpace 变化时同步 dockItems
    useEffect(() => {
        setDockItemsState({
            spaceId: currentSpace.id,
            items: currentSpace.apps,
        });
    }, [currentSpace.id, currentSpace.apps]);

    // 包装 setDockItems: 先更新本地状态，再通过 effect 同步到 SpacesContext
    const setDockItems: React.Dispatch<React.SetStateAction<DockItem[]>> = useCallback(
        (action) => {
            setDockItemsState((prev) => {
                const newItems = typeof action === 'function' ? action(prev.items) : action;
                return {
                    spaceId: prev.spaceId,
                    items: newItems,
                };
            });
        },
        []
    );

    // 将本地 dockItems 同步回当前空间，替代 setTimeout(0) workaround
    useEffect(() => {
        if (
            !shouldSyncDockItemsToSpace(
                dockItemsState.spaceId,
                currentSpace.id,
                dockItemsState.items,
                currentSpace.apps
            )
        ) {
            return;
        }

        updateCurrentSpaceApps(dockItemsState.items);
    }, [dockItemsState, currentSpace.id, currentSpace.apps, updateCurrentSpaceApps]);

    // 初始化: 只在首次安装时加载默认常用网站
    // 注意：这个 ref 确保默认数据只加载一次，新建空间不会自动填充
    const hasLoadedDefaultsRef = React.useRef(false);

    useEffect(() => {
        let isCancelled = false;

        // 只在首次运行且当前空间为空时初始化默认数据
        // 使用 hasLoadedDefaultsRef 确保只加载一次
        if (
            !hasLoadedDefaultsRef.current &&
            currentSpace.apps.length === 0 &&
            dockItems.length === 0 &&
            currentSpace.name === 'Main' // 只在 Main 空间为空时加载默认数据
        ) {
            hasLoadedDefaultsRef.current = true;

            // 默认常用网站 - Main 空间
            const defaults: DockItem[] = [
                { id: 'bilibili', name: 'Bilibili', url: 'https://www.bilibili.com/', type: 'app' },
                { id: 'notion', name: 'Notion', url: 'https://www.notion.so/', type: 'app' },
                { id: 'notion-calendar', name: 'NotionCalendar', url: 'https://calendar.notion.so/', type: 'app' },
                { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', type: 'app' },
                { id: 'jike', name: '即刻', url: 'https://web.okjike.com', type: 'app' },
                { id: 'behance', name: 'Behance', url: 'https://www.behance.net/', type: 'app' },
                { id: 'x', name: 'X', url: 'https://x.com/', type: 'app' },
                { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', type: 'app' },
                { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', type: 'app' },
            ];

            // 为文件夹生成图标
            defaults.forEach(item => {
                if (item.type === 'folder' && item.items) {
                    item.icon = generateFolderIcon(item.items);
                }
            });
            setDockItems(defaults);

            // 异步获取默认项目的图标
            const fetchAllIcons = async () => {
                type IconUpdateResult =
                    | { id: string; icon: string; isFolder?: undefined; subItems?: undefined }
                    | { id: string; isFolder: true; subItems: { id: string; icon: string }[]; icon?: undefined }
                    | null;

                // 并行获取图标，但不立即更新状态
                const iconResults: IconUpdateResult[] = await Promise.all(defaults.map(async (item) => {
                    if (item.type === 'folder' && item.items) {
                        const updatedSubItems = await Promise.all(item.items.map(async (subItem) => {
                            if (subItem.url) {
                                try {
                                    const { url: icon } = await fetchIcon(subItem.url);
                                    return { id: subItem.id, icon };
                                } catch {
                                    return null;
                                }
                            }
                            return null;
                        }));

                        // 过滤出获取到图标的项目
                        const validSubUpdates = updatedSubItems.filter((i): i is { id: string, icon: string } => i !== null);

                        if (validSubUpdates.length > 0) {
                            return {
                                id: item.id,
                                isFolder: true,
                                subItems: validSubUpdates
                            };
                        }
                    } else if (item.url) {
                        try {
                            const { url: icon } = await fetchIcon(item.url);
                            return { id: item.id, icon };
                        } catch (error) {
                            console.error(`Failed to fetch icon for ${item.name}`, error);
                        }
                    }
                    return null;
                }));

                // 过滤有效结果
                const updates = iconResults.filter((r): r is NonNullable<IconUpdateResult> => r !== null);

                if (isCancelled) return;

                // 安全更新: 仅更新图标，保留用户可能已做的操作（如排序、删除）
                setDockItems(prev => {
                    return prev.map(item => {
                        const update = updates.find(u => u && u.id === item.id);
                        if (!update) return item;

                        if (update.isFolder && item.type === 'folder' && item.items) {
                            // 更新文件夹内的图标
                            const newSubItems = item.items.map(subItem => {
                                const subUpdate = update.subItems?.find(su => su.id === subItem.id);
                                return subUpdate ? { ...subItem, icon: subUpdate.icon } : subItem;
                            });
                            return {
                                ...item,
                                items: newSubItems,
                                icon: generateFolderIcon(newSubItems) // 重新生成文件夹预览图
                            };
                        } else if (!update.isFolder && update.icon) {
                            // 更新 App 图标
                            return { ...item, icon: update.icon };
                        }
                        return item;
                    });
                });
            };

            void fetchAllIcons();
        }

        return () => {
            isCancelled = true;
        };

    }, [currentSpace.apps.length, currentSpace.name, dockItems.length, setDockItems]);

    // 当引擎列表变化时，确保当前选中项有效
    useEffect(() => {
        if (searchEngines.length === 0) {
            const fallback = cloneEngine(DEFAULT_SEARCH_ENGINE);
            if (selectedSearchEngine.id !== fallback.id || selectedSearchEngine.url !== fallback.url || selectedSearchEngine.name !== fallback.name) {
                setSelectedSearchEngineState(fallback);
            }
            return;
        }

        const matchedEngine = searchEngines.find((engine) => engine.id === selectedSearchEngine.id);
        if (!matchedEngine) {
            setSelectedSearchEngineState(searchEngines[0]);
            return;
        }

        if (matchedEngine.name !== selectedSearchEngine.name || matchedEngine.url !== selectedSearchEngine.url) {
            setSelectedSearchEngineState(matchedEngine);
        }
    }, [searchEngines, selectedSearchEngine]);

    // 保存搜索引擎状态 (dockItems 存储由 SpacesContext 管理)
    useEffect(() => {
        storage.saveSearchEngines(searchEngines);
    }, [searchEngines]);

    useEffect(() => {
        storage.saveSearchEngine(selectedSearchEngine);
    }, [selectedSearchEngine]);

    // 辅助函数: 检查并在需要时解散文件夹
    const checkAndDissolveFolderIfNeeded = useCallback((folderId: string, updatedItems: DockItem[]): DockItem[] => {
        const folder = updatedItems.find(i => i.id === folderId);
        if (!folder || folder.type !== 'folder' || !folder.items) return updatedItems;

        const folderIndex = updatedItems.findIndex(i => i.id === folderId);
        if (folderIndex === -1) return updatedItems;

        // 如果文件夹没有项目，完全移除它
        if (folder.items.length === 0) {
            return updatedItems.filter(i => i.id !== folderId);
        }

        // 如果文件夹恰好只有 1 个项目，解散并用该项目替换文件夹
        if (folder.items.length === 1) {
            const remainingItem = folder.items[0];
            const newItems = [...updatedItems];
            newItems[folderIndex] = remainingItem;
            return newItems;
        }

        return updatedItems;
    }, []);

    // ========================================================================
    // UI 操作 (中频)
    // ========================================================================

    const setIsEditMode = useCallback((value: boolean) => {
        setIsEditModeState(value);
    }, []);

    const setSelectedSearchEngine = useCallback((engine: SearchEngine) => {
        setSelectedSearchEngineState(engine);
    }, []);

    const addSearchEngine = useCallback((engine: Omit<SearchEngine, 'id'>): SearchEngine => {
        const name = engine.name.trim();
        const url = engine.url.trim();
        const newEngine: SearchEngine = {
            id: `engine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            url,
        };

        setSearchEnginesState((prev) => normalizeSearchEngines([...prev, newEngine]));
        setSelectedSearchEngineState(newEngine);
        return newEngine;
    }, []);

    const removeSearchEngine = useCallback((engineId: string) => {
        if (engineId === GOOGLE_ENGINE.id) {
            return;
        }
        setSearchEnginesState((prev) => {
            const nextEngines = normalizeSearchEngines(prev.filter((engine) => engine.id !== engineId));
            if (selectedSearchEngine.id === engineId) {
                const nextSelected = nextEngines[0] ?? cloneEngine(DEFAULT_SEARCH_ENGINE);
                setSelectedSearchEngineState(nextSelected);
            }
            return nextEngines;
        });
    }, [selectedSearchEngine.id]);

    const setOpenFolderId = useCallback((id: string | null) => {
        setOpenFolderIdState(id);
        if (!id) {
            setFolderAnchor(null);
        }
    }, []);

    // ========================================================================
    // 数据操作 (低频)
    // ========================================================================

    const handleItemDelete = useCallback((item: DockItem) => {
        if (window.confirm(`确定要删除 "${item.name}" 吗？${item.type === 'folder' ? '文件夹内的所有内容也将被删除。' : ''}`)) {
            setDockItems(prev => {
                const newItems = prev.filter((i) => i.id !== item.id);
                return newItems;
            });
            if (openFolderId === item.id) {
                setOpenFolderIdState(null);
            }
        }
    }, [openFolderId, setDockItems]);

    const handleItemSave = useCallback((data: Partial<DockItem>, editingItem: DockItem | null) => {
        if (editingItem) {
            const updateItemRecursively = (items: DockItem[]): DockItem[] => {
                return items.map((item) => {
                    if (item.id === editingItem.id) {
                        return { ...item, ...data };
                    }
                    if (item.type === 'folder' && item.items) {
                        return {
                            ...item,
                            items: updateItemRecursively(item.items),
                        };
                    }
                    return item;
                });
            };

            setDockItems(prev => updateItemRecursively(prev));
        } else {
            const newItem: DockItem = {
                id: `item-${Date.now()}`,
                name: data.name || '',
                url: data.url,
                icon: data.icon,
                type: 'app',
            };
            setDockItems(prev => [...prev, newItem]);
        }
    }, [setDockItems]);

    const handleItemsReorder = useCallback((items: DockItem[]) => {
        const updatedItems = items.map((item) => {
            if (item.type === 'folder' && item.items && item.items.length > 0) {
                return {
                    ...item,
                    icon: generateFolderIcon(item.items),
                };
            }
            return item;
        });
        setDockItems(updatedItems);
    }, [setDockItems]);

    const handleFolderItemsReorder = useCallback((folderId: string, items: DockItem[]) => {
        setDockItems(prev => prev.map((item) => {
            if (item.id === folderId && item.type === 'folder') {
                return {
                    ...item,
                    items,
                    icon: generateFolderIcon(items),
                };
            }
            return item;
        }));
    }, [setDockItems]);

    const handleFolderItemDelete = useCallback((folderId: string, item: DockItem) => {
        setDockItems(prev => {
            const folder = prev.find((i) => i.id === folderId);
            if (folder && folder.type === 'folder' && folder.items) {
                const newItems = folder.items.filter((i) => i.id !== item.id);

                let newDockItems = prev.map((i) => {
                    if (i.id === folderId) {
                        return {
                            ...i,
                            items: newItems,
                            icon: generateFolderIcon(newItems),
                        };
                    }
                    return i;
                });

                newDockItems = checkAndDissolveFolderIfNeeded(folderId, newDockItems);

                const dissolvedFolder = newDockItems.find(i => i.id === folderId);
                if (!dissolvedFolder || dissolvedFolder.type !== 'folder') {
                    setOpenFolderIdState(null);
                }

                return newDockItems;
            }
            return prev;
        });
    }, [checkAndDissolveFolderIfNeeded, setDockItems]);

    const handleDragFromFolder = useCallback((item: DockItem, insertIndex: number = -1) => {
        if (!openFolderId) return;

        setDockItems(prev => {
            const folder = prev.find(i => i.id === openFolderId);
            if (!folder || folder.type !== 'folder' || !folder.items) return prev;

            const newFolderItems = folder.items.filter(i => i.id !== item.id);

            let newDockItems = prev.map(i => {
                if (i.id === openFolderId) {
                    return {
                        ...i,
                        items: newFolderItems,
                        icon: newFolderItems.length > 0 ? generateFolderIcon(newFolderItems) : undefined,
                    };
                }
                return i;
            });

            const updatedDockItems = checkAndDissolveFolderIfNeeded(openFolderId, newDockItems);

            const folderAfter = updatedDockItems.find(i => i.id === openFolderId);
            if (!folderAfter || folderAfter.type !== 'folder') {
                setOpenFolderIdState(null);
            }

            let finalItems = updatedDockItems.filter(i => i.id !== item.id);
            const safeInsertIndex = insertIndex < 0
                ? finalItems.length
                : Math.max(0, Math.min(insertIndex, finalItems.length));
            finalItems.splice(safeInsertIndex, 0, item);

            return finalItems;
        });
    }, [openFolderId, checkAndDissolveFolderIfNeeded, setDockItems]);

    const handleDragToFolder = useCallback((item: DockItem) => {
        if (!openFolderId || item.type === 'folder') return;

        setDockItems(prev => {
            const folder = prev.find(i => i.id === openFolderId);
            if (!folder || folder.type !== 'folder') return prev;

            const newFolderItems = [...(folder.items || []), item];

            return prev.map(i => {
                if (i.id === openFolderId) {
                    return {
                        ...i,
                        items: newFolderItems,
                        icon: generateFolderIcon(newFolderItems),
                    };
                }
                return i;
            }).filter(i => i.id !== item.id);
        });
    }, [openFolderId, setDockItems]);

    const handleDropOnFolder = useCallback((dragItem: DockItem, targetFolder: DockItem) => {
        if (targetFolder.type !== 'folder') return;

        let itemsToAdd: DockItem[] = [];
        if (dragItem.type === 'folder' && dragItem.items) {
            itemsToAdd = dragItem.items;
        } else {
            itemsToAdd = [dragItem];
        }

        setDockItems(prev => {
            return prev.map(item => {
                if (item.id === targetFolder.id) {
                    // 防止重复: 过滤掉已经存在于文件夹中的项目
                    const existingIds = new Set((item.items || []).map(i => i.id));
                    const uniqueItemsToAdd = itemsToAdd.filter(add => !existingIds.has(add.id));

                    const mergedItems = [...(item.items || []), ...uniqueItemsToAdd];
                    return {
                        ...item,
                        items: mergedItems,
                        icon: generateFolderIcon(mergedItems),
                    };
                }
                return item;
            }).filter(item => item.id !== dragItem.id);
        });
    }, [setDockItems]);

    // ========================================================================
    // Context Values (使用 useMemo 避免不必要的 Re-render)
    // ========================================================================

    const dataValue: DockDataContextType = useMemo(() => ({
        dockItems,
        searchEngines,
        selectedSearchEngine,
        setDockItems,
        setSelectedSearchEngine,
        addSearchEngine,
        removeSearchEngine,
        handleItemSave,
        handleItemsReorder,
        handleItemDelete,
        handleFolderItemsReorder,
        handleFolderItemDelete,
        handleDragFromFolder,
        handleDragToFolder,
        handleDropOnFolder,
    }), [
        dockItems,
        searchEngines,
        selectedSearchEngine,
        setDockItems,
        setSelectedSearchEngine,
        addSearchEngine,
        removeSearchEngine,
        handleItemSave,
        handleItemsReorder,
        handleItemDelete,
        handleFolderItemsReorder,
        handleFolderItemDelete,
        handleDragFromFolder,
        handleDragToFolder,
        handleDropOnFolder,
    ]);

    const uiValue: DockUIContextType = useMemo(() => ({
        isEditMode,
        openFolderId,
        folderAnchor,
        setIsEditMode,
        setOpenFolderId,
        setFolderAnchor,
    }), [
        isEditMode,
        openFolderId,
        folderAnchor,
        setIsEditMode,
        setOpenFolderId,
    ]);

    const dragValue: DockDragContextType = useMemo(() => ({
        draggingItem,
        setDraggingItem,
        folderPlaceholderActive,
        setFolderPlaceholderActive,
    }), [draggingItem, folderPlaceholderActive]);

    return (
        <DockDataContext.Provider value={dataValue}>
            <DockUIContext.Provider value={uiValue}>
                <DockDragContext.Provider value={dragValue}>
                    {children}
                </DockDragContext.Provider>
            </DockUIContext.Provider>
        </DockDataContext.Provider>
    );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取 Dock 数据状态 (低频变化)
 * 用于需要访问 dockItems、searchEngine 等数据的组件
 */
export const useDockData = () => {
    const context = useContext(DockDataContext);
    if (context === undefined) {
        throw new Error('useDockData must be used within a DockProvider');
    }
    return context;
};

/**
 * 获取 Dock UI 状态 (中频变化)
 * 用于需要访问 isEditMode、openFolderId 等 UI 状态的组件
 */
export const useDockUI = () => {
    const context = useContext(DockUIContext);
    if (context === undefined) {
        throw new Error('useDockUI must be used within a DockProvider');
    }
    return context;
};

/**
 * 获取 Dock 拖拽状态
 */
export const useDockDrag = () => {
    const context = useContext(DockDragContext);
    if (context === undefined) {
        throw new Error('useDockDrag must be used within a DockProvider');
    }
    return context;
};

/**
 * 获取完整的 Dock 上下文 (兼容层)
 * 组合 DockDataContext 和 DockUIContext，提供完整功能
 * 
 * 性能建议：如果组件只需要部分状态，建议使用 useDockData 或 useDockUI
 */
export const useDock = (): DockContextType => {
    const dataContext = useContext(DockDataContext);
    const uiContext = useContext(DockUIContext);
    const dragContext = useContext(DockDragContext);

    if (dataContext === undefined || uiContext === undefined || dragContext === undefined) {
        throw new Error('useDock must be used within a DockProvider');
    }

    // 组合操作 - 需要同时访问数据和 UI
    const handleItemClick = useCallback((item: DockItem, rect?: DOMRect) => {
        if (item.type === 'folder') {
            uiContext.setOpenFolderId(item.id);
            uiContext.setFolderAnchor(rect ?? null);
        } else if (item.url) {
            window.open(item.url, '_blank');
        }
    }, [uiContext]);

    const handleItemEdit = useCallback((_item: DockItem, _rect?: DOMRect) => {
        // 这个函数在 App 中处理
    }, []);

    const handleHoverOpenFolder = useCallback((_item: DockItem, folder: DockItem) => {
        if (folder.type === 'folder') {
            uiContext.setOpenFolderId(folder.id);
        }
    }, [uiContext]);

    const openFolder = useMemo(() =>
        dataContext.dockItems.find((item) => item.id === uiContext.openFolderId),
        [dataContext.dockItems, uiContext.openFolderId]
    );

    return {
        ...dataContext,
        ...uiContext,
        ...dragContext,
        handleItemClick,
        handleItemEdit,
        handleHoverOpenFolder,
        openFolder,
    };
};
