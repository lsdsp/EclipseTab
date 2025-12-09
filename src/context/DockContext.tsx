import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DockItem, SearchEngine } from '../types';
import { storage } from '../utils/storage';
import { DEFAULT_SEARCH_ENGINE } from '../constants/searchEngines';
import { generateFolderIcon, fetchIcon } from '../utils/iconFetcher';

/**
 * Dock 状态上下文类型
 */
interface DockContextType {
    // 状态
    dockItems: DockItem[];
    isEditMode: boolean;
    selectedSearchEngine: SearchEngine;
    openFolderId: string | null;
    folderAnchor: DOMRect | null;
    draggingItem: DockItem | null;

    // 操作
    setDockItems: React.Dispatch<React.SetStateAction<DockItem[]>>;
    setIsEditMode: (value: boolean) => void;
    setSelectedSearchEngine: (engine: SearchEngine) => void;
    setOpenFolderId: (id: string | null) => void;
    setFolderAnchor: (rect: DOMRect | null) => void;
    setDraggingItem: (item: DockItem | null) => void;

    // 项目操作
    handleItemClick: (item: DockItem, rect?: DOMRect) => void;
    handleItemEdit: (item: DockItem, rect?: DOMRect) => void;
    handleItemDelete: (item: DockItem) => void;
    handleItemSave: (data: Partial<DockItem>, editingItem: DockItem | null) => void;
    handleItemsReorder: (items: DockItem[]) => void;

    // 文件夹操作
    handleFolderItemsReorder: (folderId: string, items: DockItem[]) => void;
    handleFolderItemDelete: (folderId: string, item: DockItem) => void;
    handleDragFromFolder: (item: DockItem, mousePosition: { x: number; y: number }) => void;
    handleDragToFolder: (item: DockItem) => void;
    handleDropOnFolder: (dragItem: DockItem, targetFolder: DockItem) => void;
    handleHoverOpenFolder: (item: DockItem, folder: DockItem) => void;

    // 获取当前打开的文件夹
    openFolder: DockItem | undefined;
}

const DockContext = createContext<DockContextType | undefined>(undefined);

/**
 * Dock 状态管理 Provider
 */
export const DockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dockItems, setDockItems] = useState<DockItem[]>([]);
    const [isEditMode, setIsEditModeState] = useState(false);
    const [selectedSearchEngine, setSelectedSearchEngineState] = useState<SearchEngine>(DEFAULT_SEARCH_ENGINE);
    const [openFolderId, setOpenFolderIdState] = useState<string | null>(null);
    const [folderAnchor, setFolderAnchor] = useState<DOMRect | null>(null);
    const [draggingItem, setDraggingItem] = useState<DockItem | null>(null);

    // 加载数据
    useEffect(() => {
        const savedItems = storage.getDockItems();
        if (savedItems.length > 0) {
            setDockItems(savedItems);
        } else {
            // 默认常用网站
            const defaults: DockItem[] = [
                { id: 'bilibili', name: 'Bilibili', url: 'https://www.bilibili.com/', type: 'app' },
                { id: 'xiaohongshu', name: '小红书', url: 'https://www.xiaohongshu.com/', type: 'app' },
                { id: 'notion', name: 'Notion', url: 'https://www.notion.so/', type: 'app' },
                { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', type: 'app' },
                {
                    id: 'folder-design',
                    name: 'Design',
                    type: 'folder',
                    items: [
                        { id: 'behance', name: 'Behance', url: 'https://www.behance.net/', type: 'app' },
                        { id: 'pinterest', name: 'Pinterest', url: 'https://pinterest.com/', type: 'app' },
                        { id: 'iconfont', name: 'Iconfont', url: 'https://www.iconfont.cn/', type: 'app' },
                        { id: 'dribbble', name: 'Dribble', url: 'https://dribbble.com', type: 'app' },
                        { id: 'x', name: 'X', url: 'https://x.com/', type: 'app' },
                    ]
                },
                {
                    id: 'folder-ai',
                    name: 'AI',
                    type: 'folder',
                    items: [
                        { id: 'ai-studio', name: 'AI studio', url: 'https://aistudio.google.com/prompts/new_chat', type: 'app' },
                        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', type: 'app' },
                        { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn/', type: 'app' },
                    ]
                },
                {
                    id: 'folder-tools',
                    name: 'Tools',
                    type: 'folder',
                    items: [
                        { id: 'keep', name: 'Keep', url: 'https://keep.google.com/', type: 'app' },
                        { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com/', type: 'app' },
                        { id: 'github', name: 'Github', url: 'https://github.com/', type: 'app' },
                    ]
                },
            ];

            // Generate icons for folders
            defaults.forEach(item => {
                if (item.type === 'folder' && item.items) {
                    item.icon = generateFolderIcon(item.items);
                }
            });
            setDockItems(defaults);

            // Asynchronously fetch icons for default items
            const fetchAllIcons = async () => {
                const itemsWithIcons = await Promise.all(defaults.map(async (item) => {
                    if (item.type === 'folder' && item.items) {
                        const updatedSubItems = await Promise.all(item.items.map(async (subItem) => {
                            if (subItem.url) {
                                try {
                                    const icon = await fetchIcon(subItem.url);
                                    return { ...subItem, icon };
                                } catch (e) {
                                    console.error(`Failed to fetch icon for ${subItem.name}`, e);
                                    return subItem;
                                }
                            }
                            return subItem;
                        }));
                        return {
                            ...item,
                            items: updatedSubItems,
                            icon: generateFolderIcon(updatedSubItems)
                        };
                    } else if (item.url) {
                        try {
                            const icon = await fetchIcon(item.url);
                            return { ...item, icon };
                        } catch (e) {
                            console.error(`Failed to fetch icon for ${item.name}`, e);
                            return item;
                        }
                    }
                    return item;
                }));
                setDockItems(itemsWithIcons);
            };

            fetchAllIcons();
        }

        const savedEngine = storage.getSearchEngine();
        if (savedEngine) {
            setSelectedSearchEngineState(savedEngine);
        }
    }, []);

    // 保存数据
    useEffect(() => {
        if (dockItems.length > 0) {
            storage.saveDockItems(dockItems);
        }
    }, [dockItems]);

    useEffect(() => {
        storage.saveSearchEngine(selectedSearchEngine);
    }, [selectedSearchEngine]);

    // Helper function to check and dissolve folder if needed
    const checkAndDissolveFolderIfNeeded = useCallback((folderId: string, updatedItems: DockItem[]): DockItem[] => {
        const folder = updatedItems.find(i => i.id === folderId);
        if (!folder || folder.type !== 'folder' || !folder.items) return updatedItems;

        const folderIndex = updatedItems.findIndex(i => i.id === folderId);
        if (folderIndex === -1) return updatedItems;

        // If folder has 0 items, remove it completely
        if (folder.items.length === 0) {
            return updatedItems.filter(i => i.id !== folderId);
        }

        // If folder has exactly 1 item, dissolve and replace with that item
        if (folder.items.length === 1) {
            const remainingItem = folder.items[0];
            const newItems = [...updatedItems];
            newItems[folderIndex] = remainingItem;
            return newItems;
        }

        return updatedItems;
    }, []);

    // 设置编辑模式
    const setIsEditMode = useCallback((value: boolean) => {
        setIsEditModeState(value);
    }, []);

    // 设置搜索引擎
    const setSelectedSearchEngine = useCallback((engine: SearchEngine) => {
        setSelectedSearchEngineState(engine);
    }, []);

    // 设置打开的文件夹
    const setOpenFolderId = useCallback((id: string | null) => {
        setOpenFolderIdState(id);
        if (!id) {
            setFolderAnchor(null);
        }
    }, []);

    // 点击项目
    const handleItemClick = useCallback((item: DockItem, rect?: DOMRect) => {
        if (item.type === 'folder') {
            setOpenFolderIdState(item.id);
            setFolderAnchor(rect ?? null);
        } else if (item.url) {
            window.open(item.url, '_blank');
        }
    }, []);

    // 编辑项目 (返回需要编辑的项目和位置，由 App 处理 modal)
    const handleItemEdit = useCallback((_item: DockItem, _rect?: DOMRect) => {
        // 这个函数在 App 中处理，因为需要打开 modal
        // 这里只是占位，实际逻辑保留在 App 中
    }, []);

    // 删除项目
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
    }, [openFolderId]);

    // 保存项目
    const handleItemSave = useCallback((data: Partial<DockItem>, editingItem: DockItem | null) => {
        if (editingItem) {
            // 编辑现有项目
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
            // 添加新项目
            const newItem: DockItem = {
                id: `item-${Date.now()}`,
                name: data.name || '',
                url: data.url,
                icon: data.icon,
                type: 'app',
            };
            setDockItems(prev => [...prev, newItem]);
        }
    }, []);

    // 重新排序项目
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
    }, []);

    // 文件夹内项目重新排序
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
    }, []);

    // 删除文件夹内项目
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

                // Auto-dissolve folder if only 1 or 0 items remain
                newDockItems = checkAndDissolveFolderIfNeeded(folderId, newDockItems);

                // Close folder view if it was dissolved
                const dissolvedFolder = newDockItems.find(i => i.id === folderId);
                if (!dissolvedFolder || dissolvedFolder.type !== 'folder') {
                    setOpenFolderIdState(null);
                }

                return newDockItems;
            }
            return prev;
        });
    }, [checkAndDissolveFolderIfNeeded]);

    // 从文件夹拖拽到 Dock
    const handleDragFromFolder = useCallback((item: DockItem, mousePosition: { x: number; y: number }) => {
        if (!openFolderId) return;

        setDockItems(prev => {
            const folder = prev.find(i => i.id === openFolderId);
            if (!folder || folder.type !== 'folder' || !folder.items) return prev;

            // Remove item from folder
            const newFolderItems = folder.items.filter(i => i.id !== item.id);

            // Update dock items, removing item from folder
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

            // Check and dissolve folder if needed
            const updatedDockItems = checkAndDissolveFolderIfNeeded(openFolderId, newDockItems);

            // If the folder was dissolved, close the folder view
            const folderAfter = updatedDockItems.find(i => i.id === openFolderId);
            if (!folderAfter || folderAfter.type !== 'folder') {
                setOpenFolderIdState(null);
            }

            // Calculate insertion position based on mouse X coordinate
            const dockElement = document.querySelector('[data-dock-container="true"]');
            if (!dockElement) {
                // Fallback: append to end
                const finalItems = [...updatedDockItems];
                const existingIdx = finalItems.findIndex(i => i.id === item.id);
                if (existingIdx !== -1) finalItems.splice(existingIdx, 1);
                finalItems.push(item);
                return finalItems;
            }

            const dockItemElements = Array.from(dockElement.querySelectorAll('[data-dock-item-wrapper="true"]'));
            let insertIndex = updatedDockItems.length;

            for (let i = 0; i < dockItemElements.length; i++) {
                const rect = dockItemElements[i].getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;

                if (mousePosition.x < centerX) {
                    insertIndex = i;
                    break;
                }
            }

            let finalItems = updatedDockItems.filter(i => i.id !== item.id);
            insertIndex = Math.max(0, Math.min(insertIndex, finalItems.length));
            finalItems.splice(insertIndex, 0, item);

            return finalItems;
        });
    }, [openFolderId, checkAndDissolveFolderIfNeeded]);

    // 从 Dock 拖拽到打开的文件夹
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
    }, [openFolderId]);

    // 拖放到文件夹上
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
                    const mergedItems = [...(item.items || []), ...itemsToAdd];
                    return {
                        ...item,
                        items: mergedItems,
                        icon: generateFolderIcon(mergedItems),
                    };
                }
                return item;
            }).filter(item => item.id !== dragItem.id);
        });
    }, []);

    // 悬停打开文件夹
    const handleHoverOpenFolder = useCallback((_item: DockItem, folder: DockItem) => {
        if (folder.type === 'folder') {
            setOpenFolderIdState(folder.id);
        }
    }, []);

    // 获取当前打开的文件夹
    const openFolder = dockItems.find((item) => item.id === openFolderId);

    const value: DockContextType = {
        dockItems,
        isEditMode,
        selectedSearchEngine,
        openFolderId,
        folderAnchor,
        draggingItem,
        setDockItems,
        setIsEditMode,
        setSelectedSearchEngine,
        setOpenFolderId,
        setFolderAnchor,
        setDraggingItem,
        handleItemClick,
        handleItemEdit,
        handleItemDelete,
        handleItemSave,
        handleItemsReorder,
        handleFolderItemsReorder,
        handleFolderItemDelete,
        handleDragFromFolder,
        handleDragToFolder,
        handleDropOnFolder,
        handleHoverOpenFolder,
        openFolder,
    };

    return (
        <DockContext.Provider value={value}>
            {children}
        </DockContext.Provider>
    );
};

/**
 * 使用 Dock 上下文的 Hook
 */
export const useDock = () => {
    const context = useContext(DockContext);
    if (context === undefined) {
        throw new Error('useDock must be used within a DockProvider');
    }
    return context;
};
