import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sticker, StickerInput, DEFAULT_TEXT_STYLE } from '../types';
import { storage } from '../utils/storage';

// 防抖保存延迟 (ms)
const SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// Context 类型定义
// ============================================================================

interface ZenShelfContextType {
    // 状态
    stickers: Sticker[];
    selectedStickerId: string | null;
    confirmDelete: boolean;

    // 操作
    addSticker: (input: StickerInput) => void;
    updateSticker: (id: string, updates: Partial<Sticker>) => void;
    deleteSticker: (id: string) => void;
    selectSticker: (id: string | null) => void;
    bringToTop: (id: string) => void;
    setConfirmDelete: (confirm: boolean) => void;
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

// ============================================================================
// Provider 实现
// ============================================================================

export const ZenShelfProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 状态初始化：从 localStorage 加载
    const [stickers, setStickers] = useState<Sticker[]>(() => storage.getStickers());
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDeleteState] = useState<boolean>(() => {
        const saved = localStorage.getItem('sticker_confirm_delete');
        return saved === null ? true : saved === 'true'; // Default to true
    });

    // 防抖保存 ref
    const saveTimeoutRef = useRef<number>();

    // 持久化：stickers 变化时防抖保存到 localStorage
    useEffect(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = window.setTimeout(() => {
            storage.saveStickers(stickers);
        }, SAVE_DEBOUNCE_MS);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [stickers]);

    const setConfirmDelete = useCallback((confirm: boolean) => {
        setConfirmDeleteState(confirm);
        localStorage.setItem('sticker_confirm_delete', String(confirm));
    }, []);



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
        setStickers(prev => prev.filter(sticker => sticker.id !== id));
        // 如果删除的是选中的贴纸，取消选中
        setSelectedStickerId(prev => prev === id ? null : prev);
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
        selectedStickerId,
        confirmDelete,
        addSticker,
        updateSticker,
        deleteSticker,
        selectSticker,
        bringToTop,
        setConfirmDelete,
    }), [
        stickers,
        selectedStickerId,
        confirmDelete,
        addSticker,
        updateSticker,
        deleteSticker,
        selectSticker,
        bringToTop,
        setConfirmDelete,
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
