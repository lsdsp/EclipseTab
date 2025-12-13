import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Space, SpacesState, DockItem, createDefaultSpace } from '../types';
import { storage } from '../utils/storage';

// ============================================================================
// Context 类型定义
// ============================================================================

interface SpacesContextType {
    // 状态
    spaces: Space[];
    activeSpaceId: string;
    isSwitching: boolean;

    // 派生
    currentSpace: Space;
    currentIndex: number;

    // 操作
    switchToNextSpace: () => void;
    switchToSpace: (spaceId: string) => void;
    addSpace: (name?: string) => void;
    deleteSpace: (spaceId: string) => void;
    renameSpace: (spaceId: string, newName: string) => void;
    updateCurrentSpaceApps: (apps: DockItem[]) => void;

    // 动画控制
    setIsSwitching: (value: boolean) => void;
}

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

// ============================================================================
// Provider 实现
// ============================================================================

interface SpacesProviderProps {
    children: React.ReactNode;
}

export function SpacesProvider({ children }: SpacesProviderProps) {
    // 初始化状态（从 localStorage 读取）
    const [spacesState, setSpacesState] = useState<SpacesState>(() => storage.getSpaces());
    const [isSwitching, setIsSwitching] = useState(false);

    // 解构状态
    const { spaces, activeSpaceId } = spacesState;

    // 派生：当前空间
    const currentSpace = useMemo(() => {
        return spaces.find(s => s.id === activeSpaceId) || spaces[0];
    }, [spaces, activeSpaceId]);

    // 派生：当前索引
    const currentIndex = useMemo(() => {
        return spaces.findIndex(s => s.id === activeSpaceId);
    }, [spaces, activeSpaceId]);

    // 持久化到 localStorage
    useEffect(() => {
        storage.saveSpaces(spacesState);
    }, [spacesState]);

    // ============================================================================
    // 空间切换操作
    // ============================================================================

    const switchToNextSpace = useCallback(() => {
        if (isSwitching || spaces.length <= 1) return;

        const nextIndex = (currentIndex + 1) % spaces.length;
        const nextSpace = spaces[nextIndex];

        setSpacesState(prev => ({
            ...prev,
            activeSpaceId: nextSpace.id,
        }));
    }, [isSwitching, spaces, currentIndex]);

    const switchToSpace = useCallback((spaceId: string) => {
        if (isSwitching) return;

        const targetSpace = spaces.find(s => s.id === spaceId);
        if (!targetSpace) return;

        setSpacesState(prev => ({
            ...prev,
            activeSpaceId: spaceId,
        }));
    }, [isSwitching, spaces]);

    // ============================================================================
    // 空间管理操作
    // ============================================================================

    const addSpace = useCallback((name?: string) => {
        const newSpace = createDefaultSpace(name || `SPACE ${spaces.length + 1}`);

        setSpacesState(prev => ({
            ...prev,
            spaces: [...prev.spaces, newSpace],
            activeSpaceId: newSpace.id, // 自动跳转到新空间
        }));
    }, [spaces.length]);

    const deleteSpace = useCallback((spaceId: string) => {
        if (spaces.length <= 1) {
            console.warn('[SpacesContext] Cannot delete the last space');
            return;
        }

        const deleteIndex = spaces.findIndex(s => s.id === spaceId);
        if (deleteIndex === -1) return;

        // 确定删除后要跳转到的空间
        let newActiveId = activeSpaceId;
        if (spaceId === activeSpaceId) {
            // 删除的是当前空间，跳转到上一个（如果是第一个则跳转到下一个）
            const newIndex = deleteIndex === 0 ? 1 : deleteIndex - 1;
            newActiveId = spaces[newIndex].id;
        }

        setSpacesState(prev => ({
            ...prev,
            spaces: prev.spaces.filter(s => s.id !== spaceId),
            activeSpaceId: newActiveId,
        }));
    }, [spaces, activeSpaceId]);

    const renameSpace = useCallback((spaceId: string, newName: string) => {
        if (!newName.trim()) return;

        setSpacesState(prev => ({
            ...prev,
            spaces: prev.spaces.map(s =>
                s.id === spaceId ? { ...s, name: newName.trim().toUpperCase() } : s
            ),
        }));
    }, []);

    // ============================================================================
    // Apps 更新（供 DockContext 调用）
    // ============================================================================

    const updateCurrentSpaceApps = useCallback((apps: DockItem[]) => {
        setSpacesState(prev => ({
            ...prev,
            spaces: prev.spaces.map(s =>
                s.id === prev.activeSpaceId ? { ...s, apps } : s
            ),
        }));
    }, []);

    // ============================================================================
    // Context Value
    // ============================================================================

    const contextValue = useMemo<SpacesContextType>(() => ({
        // 状态
        spaces,
        activeSpaceId,
        isSwitching,

        // 派生
        currentSpace,
        currentIndex,

        // 操作
        switchToNextSpace,
        switchToSpace,
        addSpace,
        deleteSpace,
        renameSpace,
        updateCurrentSpaceApps,

        // 动画控制
        setIsSwitching,
    }), [
        spaces,
        activeSpaceId,
        isSwitching,
        currentSpace,
        currentIndex,
        switchToNextSpace,
        switchToSpace,
        addSpace,
        deleteSpace,
        renameSpace,
        updateCurrentSpaceApps,
    ]);

    return (
        <SpacesContext.Provider value={contextValue}>
            {children}
        </SpacesContext.Provider>
    );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取完整的 Spaces Context
 */
export function useSpaces(): SpacesContextType {
    const context = useContext(SpacesContext);
    if (!context) {
        throw new Error('useSpaces must be used within a SpacesProvider');
    }
    return context;
}

/**
 * 仅获取当前空间数据（性能优化用）
 */
export function useCurrentSpace(): Space {
    const { currentSpace } = useSpaces();
    return currentSpace;
}

/**
 * 仅获取空间切换状态（性能优化用）
 */
export function useSpaceSwitching(): {
    isSwitching: boolean;
    setIsSwitching: (value: boolean) => void;
} {
    const { isSwitching, setIsSwitching } = useSpaces();
    return { isSwitching, setIsSwitching };
}
