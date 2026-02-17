import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sticker, StickerInput, DEFAULT_TEXT_STYLE } from '../types';
import { storage } from '../utils/storage';
import {
    ensureStickerAsset,
    hydrateStickerForRuntime,
    removeStickerAssetIfPresent,
    toStorageSticker,
} from '../utils/stickerAssets';
import { normalizeStickerCoordinatesForStorage } from '../utils/stickerCoordinates';
import { logger } from '../utils/logger';

// 防抖保存延迟 (ms)
const SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// Context 类型定义
// ============================================================================

interface ZenShelfContextType {
    // 状态
    stickers: Sticker[];
    deletedStickers: Sticker[];
    selectedStickerId: string | null;

    // 操作
    addSticker: (input: StickerInput) => void;
    updateSticker: (id: string, updates: Partial<Sticker>) => void;
    deleteSticker: (id: string) => void;
    selectSticker: (id: string | null) => void;
    bringToTop: (id: string) => void;
    restoreSticker: (sticker: Sticker) => void;
    permanentlyDeleteSticker: (id: string) => void;
    clearRecycleBin: () => void;
}

const ZenShelfContext = createContext<ZenShelfContextType | undefined>(undefined);

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成 UUID
 */
const generateId = (): string => {
    return `sticker-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const getViewportSize = () => {
    if (typeof window === 'undefined') {
        return { width: 1920, height: 1080 };
    }

    return {
        width: Math.max(window.innerWidth, 1),
        height: Math.max(window.innerHeight, 1),
    };
};

const areStickerListsEqual = (left: Sticker[], right: Sticker[]): boolean => {
    if (left.length !== right.length) return false;
    return left.every((sticker, index) => {
        const other = right[index];
        if (!other) return false;

        return (
            sticker.id === other.id &&
            sticker.type === other.type &&
            sticker.content === other.content &&
            sticker.assetId === other.assetId &&
            sticker.x === other.x &&
            sticker.y === other.y &&
            sticker.xPct === other.xPct &&
            sticker.yPct === other.yPct &&
            sticker.zIndex === other.zIndex &&
            sticker.scale === other.scale &&
            sticker.style?.color === other.style?.color &&
            sticker.style?.textAlign === other.style?.textAlign &&
            sticker.style?.fontSize === other.style?.fontSize &&
            sticker.style?.fontPreset === other.style?.fontPreset
        );
    });
};

// ============================================================================
// Provider 实现
// ============================================================================

export const ZenShelfProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 状态初始化：从 localStorage 加载
    const [stickers, setStickers] = useState<Sticker[]>(() => storage.getStickers());
    const [deletedStickers, setDeletedStickers] = useState<Sticker[]>(() => storage.getDeletedStickers());
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

    // 保存流程控制
    const saveTimeoutRef = useRef<number>();
    const hasHydratedRef = useRef(false);
    const hasSkippedInitialSaveRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 运行时恢复：懒迁移坐标 + 读取已迁移图片资源
    useEffect(() => {
        let cancelled = false;

        const hydrateFromStorage = async () => {
            const viewport = getViewportSize();
            try {
                const [hydratedStickers, hydratedDeleted] = await Promise.all([
                    Promise.all(stickers.map(sticker => hydrateStickerForRuntime(sticker, viewport))),
                    Promise.all(deletedStickers.map(sticker => hydrateStickerForRuntime(sticker, viewport))),
                ]);

                if (cancelled) return;

                if (!areStickerListsEqual(stickers, hydratedStickers)) {
                    setStickers(hydratedStickers);
                }

                if (!areStickerListsEqual(deletedStickers, hydratedDeleted)) {
                    setDeletedStickers(hydratedDeleted);
                }
            } catch (error) {
                logger.error('[ZenShelf] Failed to hydrate stickers', error);
            } finally {
                if (!cancelled) {
                    hasHydratedRef.current = true;
                }
            }
        };

        void hydrateFromStorage();

        return () => {
            cancelled = true;
        };
        // 仅初始化执行，后续通过 state 更新驱动
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 持久化：stickers 变化时防抖保存到 localStorage（图片资源懒迁移到 IndexedDB）
    useEffect(() => {
        if (!hasHydratedRef.current) {
            return;
        }

        if (!hasSkippedInitialSaveRef.current) {
            hasSkippedInitialSaveRef.current = true;
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
            const persist = async () => {
                const viewport = getViewportSize();
                try {
                    const runtimeStickers = await Promise.all(stickers.map(async (sticker) => {
                        const normalized = normalizeStickerCoordinatesForStorage(sticker, viewport);
                        return ensureStickerAsset(normalized);
                    }));
                    const runtimeDeleted = await Promise.all(deletedStickers.map(async (sticker) => {
                        const normalized = normalizeStickerCoordinatesForStorage(sticker, viewport);
                        return ensureStickerAsset(normalized);
                    }));

                    if (isMountedRef.current) {
                        if (!areStickerListsEqual(stickers, runtimeStickers)) {
                            setStickers(runtimeStickers);
                        }
                        if (!areStickerListsEqual(deletedStickers, runtimeDeleted)) {
                            setDeletedStickers(runtimeDeleted);
                        }
                    }

                    storage.saveStickers(runtimeStickers.map(toStorageSticker));
                    storage.saveDeletedStickers(runtimeDeleted.map(toStorageSticker));
                } catch (error) {
                    logger.error('[ZenShelf] Failed to persist stickers', error);
                }
            };

            void persist();
        }, SAVE_DEBOUNCE_MS);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [stickers, deletedStickers]);

    // ========================================================================
    // 操作函数
    // ========================================================================

    const addSticker = useCallback((input: StickerInput) => {
        setStickers(prev => {
            // 计算下一个 zIndex (比当前最大值高 1)
            const maxZ = Math.max(...prev.map(s => s.zIndex || 1), 0);
            const newSticker: Sticker = {
                ...input,
                id: generateId(),
                zIndex: maxZ + 1,
                // 确保文字贴纸有默认样式
                style: input.type === 'text' ? (input.style || DEFAULT_TEXT_STYLE) : undefined,
            };
            return [...prev, newSticker];
        });
    }, []);

    const updateSticker = useCallback((id: string, updates: Partial<Sticker>) => {
        setStickers(prev => prev.map(sticker =>
            sticker.id === id ? { ...sticker, ...updates } : sticker
        ));
    }, []);

    const deleteSticker = useCallback((id: string) => {
        const stickerToDelete = stickers.find(s => s.id === id);

        setStickers(prev => prev.filter(sticker => sticker.id !== id));

        if (stickerToDelete) {
            setDeletedStickers(prev => {
                const newDeleted = [stickerToDelete, ...prev];
                // Limit to 30 items
                if (newDeleted.length > 30) {
                    const overflow = newDeleted.slice(30);
                    overflow.forEach(sticker => {
                        void removeStickerAssetIfPresent(sticker);
                    });
                    return newDeleted.slice(0, 30);
                }
                return newDeleted;
            });
        }

        // 如果删除的是选中的贴纸，取消选中
        setSelectedStickerId(prev => prev === id ? null : prev);
    }, [stickers]);

    const restoreSticker = useCallback((stickerToRestore: Sticker) => {
        // Remove from deleted
        setDeletedStickers(prev => prev.filter(s => s.id !== stickerToRestore.id));

        // Add back to active stickers
        setStickers(prev => {
            // Recalculate zIndex to be on top
            const maxZ = Math.max(...prev.map(s => s.zIndex || 1), 0);
            return [...prev, { ...stickerToRestore, zIndex: maxZ + 1 }];
        });
    }, []);

    const permanentlyDeleteSticker = useCallback((id: string) => {
        setDeletedStickers(prev => {
            const target = prev.find(sticker => sticker.id === id);
            if (target) {
                void removeStickerAssetIfPresent(target);
            }
            return prev.filter(sticker => sticker.id !== id);
        });
    }, []);

    const clearRecycleBin = useCallback(() => {
        setDeletedStickers(prev => {
            prev.forEach(sticker => {
                void removeStickerAssetIfPresent(sticker);
            });
            return [];
        });
    }, []);

    const bringToTop = useCallback((id: string) => {
        setStickers(prev => {
            // 计算当前最大 zIndex
            const maxZ = Math.max(...prev.map(s => s.zIndex || 1), 0);
            return prev.map(sticker =>
                sticker.id === id ? { ...sticker, zIndex: maxZ + 1 } : sticker
            );
        });
    }, []);

    const selectSticker = useCallback((id: string | null) => {
        setSelectedStickerId(id);
    }, []);


    // ========================================================================
    // Context 值
    // ========================================================================

    const contextValue: ZenShelfContextType = useMemo(() => ({
        stickers,
        deletedStickers,
        selectedStickerId,
        addSticker,
        updateSticker,
        deleteSticker,
        restoreSticker,
        permanentlyDeleteSticker,
        clearRecycleBin,
        selectSticker,
        bringToTop,
    }), [
        stickers,
        deletedStickers,
        selectedStickerId,
        addSticker,
        updateSticker,
        deleteSticker,
        restoreSticker,
        permanentlyDeleteSticker,
        clearRecycleBin,
        selectSticker,
        bringToTop,
    ]);

    return (
        <ZenShelfContext.Provider value={contextValue}>
            {children}
        </ZenShelfContext.Provider>
    );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * 获取 Zen Shelf 上下文
 */
export const useZenShelf = (): ZenShelfContextType => {
    const context = useContext(ZenShelfContext);
    if (context === undefined) {
        throw new Error('useZenShelf must be used within a ZenShelfProvider');
    }
    return context;
};
