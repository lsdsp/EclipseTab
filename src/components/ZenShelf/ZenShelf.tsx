import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDockUI } from '../../context/DockContext';
import { useLanguage } from '../../context/LanguageContext';
import { useZenShelf } from '../../context/ZenShelfContext';
import { Sticker, IMAGE_MAX_WIDTH } from '../../types';
import { compressStickerImage } from '../../utils/imageCompression';
import { copyBlobToClipboard, createImageStickerImage, createTextStickerImage, downloadBlob, imageToBlob } from '../../utils/canvasUtils';
import { db } from '../../utils/db';
import { storage } from '../../utils/storage';
import { resolveStickerPosition, updateStickerPercentCoordinates } from '../../utils/stickerCoordinates';
import { StickerItem } from './StickerItem';
import { TextInput } from './TextInput';
import { ContextMenu } from './ContextMenu';
import { RecycleBin } from './RecycleBin';
import { RecycleBinModal } from './RecycleBinModal';
import { type StickerFontPreset } from '../../constants/stickerFonts';
import {
    AlignmentGuide,
    computeSelectionActionState,
    createRuntimeGroupId,
    lockSelection,
    normalizeSelectionRect,
    rectOverlaps,
    resolveMoveStickerIds,
    toggleLockSelection,
    unlockSelection,
} from '../../utils/whiteboard';
import { buildStickerTemplate, StickerTemplateType } from '../../utils/stickerTemplates';
import styles from './ZenShelf.module.css';

const UI_ZONE_SELECTOR = '[data-ui-zone]';


// ============================================================================
// ZenShelf 主组件
// ============================================================================

interface ZenShelfProps {
    onOpenSettings?: (position: { x: number; y: number }) => void;
}

export const ZenShelf: React.FC<ZenShelfProps> = ({ onOpenSettings }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { stickers, addSticker, updateSticker, deleteSticker, selectSticker, bringToTop } = useZenShelf();
    const { isEditMode, setIsEditMode } = useDockUI();
    const { language } = useLanguage();

    const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        type: 'background' | 'sticker';
        stickerId?: string;
    } | null>(null);

    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
    const [selectedStickerIds, setSelectedStickerIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        append: boolean;
    } | null>(null);
    const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
    const [gridSnapEnabled, setGridSnapEnabled] = useState(() => storage.getGridSnapEnabled());
    const [snapModifierPressed, setSnapModifierPressed] = useState(false);

    const [viewport, setViewport] = useState(() => ({
        width: Math.max(window.innerWidth, 1),
        height: Math.max(window.innerHeight, 1),
    }));

    // 处理窗口调整大小以实现响应式贴纸布局
    useEffect(() => {
        const handleResize = () => {
            setViewport({
                width: Math.max(window.innerWidth, 1),
                height: Math.max(window.innerHeight, 1),
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [editingSticker, setEditingSticker] = useState<Sticker | null>(null);
    const [isAnyDragging, setIsAnyDragging] = useState(false);

    const runtimeStickers = stickers.map((sticker) => ({
        ...sticker,
        ...resolveStickerPosition(sticker, viewport),
    }));
    const groupMap = useMemo<Record<string, string | undefined>>(() => {
        const map: Record<string, string | undefined> = {};
        stickers.forEach((sticker) => {
            if (sticker.groupId) {
                map[sticker.id] = sticker.groupId;
            }
        });
        return map;
    }, [stickers]);
    const lockedStickerIds = useMemo(
        () => stickers.filter((sticker) => sticker.locked).map((sticker) => sticker.id),
        [stickers]
    );
    const selectedStickerIdSet = useMemo(() => new Set(selectedStickerIds), [selectedStickerIds]);
    const lockedStickerIdSet = useMemo(() => new Set(lockedStickerIds), [lockedStickerIds]);
    const effectiveGridSnap = gridSnapEnabled !== snapModifierPressed;
    const selectionActionState = useMemo(() => computeSelectionActionState({
        selectedStickerIds,
        groupMap,
        lockedStickerIds,
    }), [groupMap, lockedStickerIds, selectedStickerIds]);

    useEffect(() => {
        const existingIds = new Set(stickers.map((sticker) => sticker.id));
        setSelectedStickerIds(prev => prev.filter(id => existingIds.has(id)));
    }, [stickers]);

    useEffect(() => {
        storage.saveGridSnapEnabled(gridSnapEnabled);
    }, [gridSnapEnabled]);

    useEffect(() => {
        selectSticker(selectedStickerIds[0] ?? null);
    }, [selectedStickerIds, selectSticker]);

    const resolveImageStickerContent = useCallback(async (sticker: Sticker): Promise<string | null> => {
        if (sticker.type !== 'image') return null;
        if (sticker.content) return sticker.content;
        if (!sticker.assetId) return null;

        const asset = await db.getStickerAsset(sticker.assetId);
        return asset?.data || null;
    }, []);

    const applyStickerPosition = useCallback((sticker: Sticker, x: number, y: number) => {
        const next = updateStickerPercentCoordinates({ ...sticker, x, y }, viewport);
        updateSticker(sticker.id, {
            x: next.x,
            y: next.y,
            xPct: next.xPct,
            yPct: next.yPct,
        });
    }, [updateSticker, viewport]);

    const handleStickerSelect = useCallback((stickerId: string, appendSelection: boolean) => {
        setSelectedStickerIds((prev) => {
            if (appendSelection) {
                if (prev.includes(stickerId)) {
                    return prev.filter((id) => id !== stickerId);
                }
                return [...prev, stickerId];
            }
            return [stickerId];
        });
    }, []);

    const handleStickerPositionChange = useCallback((sticker: Sticker, x: number, y: number) => {
        const dx = x - sticker.x;
        const dy = y - sticker.y;
        const moveTargetIds = resolveMoveStickerIds({
            activeStickerId: sticker.id,
            selectedStickerIds,
            groupMap,
            lockedStickerIds,
        });

        if (moveTargetIds.length === 0) {
            return;
        }

        const runtimeStickerMap = new Map(runtimeStickers.map((item) => [item.id, item]));
        moveTargetIds.forEach((moveId) => {
            const targetSticker = runtimeStickerMap.get(moveId);
            if (!targetSticker) return;
            const targetX = moveId === sticker.id ? x : targetSticker.x + dx;
            const targetY = moveId === sticker.id ? y : targetSticker.y + dy;
            applyStickerPosition(targetSticker, targetX, targetY);
        });
    }, [applyStickerPosition, groupMap, lockedStickerIds, runtimeStickers, selectedStickerIds]);

    const handleNudgeSelection = useCallback((dx: number, dy: number) => {
        if (selectedStickerIds.length === 0) return;
        const runtimeStickerMap = new Map(runtimeStickers.map((item) => [item.id, item]));
        selectedStickerIds.forEach((id) => {
            if (lockedStickerIdSet.has(id)) return;
            const sticker = runtimeStickerMap.get(id);
            if (!sticker) return;
            applyStickerPosition(sticker, sticker.x + dx, sticker.y + dy);
        });
    }, [applyStickerPosition, lockedStickerIdSet, runtimeStickers, selectedStickerIds]);

    const handleStickerDragStart = useCallback(() => {
        setIsAnyDragging(true);
    }, []);

    const handleStickerDragEnd = useCallback(() => {
        setIsAnyDragging(false);
        setAlignmentGuides([]);
    }, []);

    // 上下文菜单的全局右键处理程序
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // 不在 UI 元素上显示
            if (target.closest(UI_ZONE_SELECTOR)) {
                return;
            }

            // 事件委托优化: 使用 data-sticker-id 属性检测贴纸
            const stickerEl = target.closest('[data-sticker-id]') as HTMLElement;
            if (stickerEl) {
                e.preventDefault();
                const stickerId = stickerEl.dataset.stickerId;
                if (stickerId) {
                    setSelectedStickerIds(prev => prev.includes(stickerId) ? prev : [stickerId]);
                    setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'sticker',
                        stickerId,
                    });
                }
                return;
            }

            // 在背景上右键单击
            e.preventDefault();
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'background',
            });
        };

        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    // 双击背景以快速添加贴纸
    useEffect(() => {
        const handleDoubleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            if (target.closest(UI_ZONE_SELECTOR)) {
                return;
            }

            // 事件委托优化: 使用 data-sticker-id 属性检测贴纸
            if (target.closest('[data-sticker-id]')) {
                return;
            }

            if (textInputPos) {
                return;
            }

            setTextInputPos({ x: e.clientX, y: e.clientY });
        };

        document.addEventListener('dblclick', handleDoubleClick);
        return () => document.removeEventListener('dblclick', handleDoubleClick);
    }, [textInputPos]);

    // 热键：Delete 删除、方向键微调、分组/解组、锁定、网格吸附切换
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const activeElement = document.activeElement;
                // Avoid deleting when typing in input
                if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                    return;
                }

                if (selectedStickerIds.length > 0) {
                    const deletingIds = selectedStickerIds.filter((id) => !lockedStickerIdSet.has(id));
                    deletingIds.forEach((id) => deleteSticker(id));
                    setSelectedStickerIds(prev => prev.filter((id) => !deletingIds.includes(id)));
                }
                return;
            }

            if (!isEditMode) return;

            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'Alt') {
                setSnapModifierPressed(true);
                return;
            }

            if (
                (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
                selectedStickerIds.length > 0
            ) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp') handleNudgeSelection(0, -step);
                if (e.key === 'ArrowDown') handleNudgeSelection(0, step);
                if (e.key === 'ArrowLeft') handleNudgeSelection(-step, 0);
                if (e.key === 'ArrowRight') handleNudgeSelection(step, 0);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (selectedStickerIds.length === 0) return;
                    selectedStickerIds.forEach((id) => {
                        if (groupMap[id]) {
                            updateSticker(id, { groupId: undefined });
                        }
                    });
                    return;
                }

                if (selectedStickerIds.length < 2) return;
                const nextGroupId = createRuntimeGroupId();
                selectedStickerIds.forEach((id) => {
                    if (groupMap[id] !== nextGroupId) {
                        updateSticker(id, { groupId: nextGroupId });
                    }
                });
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                const nextLockedIds = toggleLockSelection(lockedStickerIds, selectedStickerIds);
                const nextLockedSet = new Set(nextLockedIds);
                selectedStickerIds.forEach((id) => {
                    const shouldLock = nextLockedSet.has(id);
                    if (lockedStickerIdSet.has(id) !== shouldLock) {
                        updateSticker(id, { locked: shouldLock ? true : undefined });
                    }
                });
                return;
            }

            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                setGridSnapEnabled(prev => !prev);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setSnapModifierPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [
        deleteSticker,
        groupMap,
        handleNudgeSelection,
        isEditMode,
        lockedStickerIdSet,
        lockedStickerIds,
        selectedStickerIds,
        updateSticker,
    ]);

    useEffect(() => {
        if (!isEditMode) {
            setSelectionBox(null);
            return;
        }

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target.closest(UI_ZONE_SELECTOR)) return;
            if (target.closest('[data-sticker-id]')) return;
            if (textInputPos) return;

            setSelectionBox({
                startX: e.clientX,
                startY: e.clientY,
                currentX: e.clientX,
                currentY: e.clientY,
                append: e.shiftKey,
            });

            if (!e.shiftKey) {
                setSelectedStickerIds([]);
            }
            e.preventDefault();
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isEditMode, textInputPos]);

    useEffect(() => {
        if (!selectionBox) return;

        const handleMouseMove = (e: MouseEvent) => {
            setSelectionBox(prev => prev ? {
                ...prev,
                currentX: e.clientX,
                currentY: e.clientY,
            } : prev);
        };

        const handleMouseUp = () => {
            setSelectionBox((current) => {
                if (!current) return null;

                const normalized = normalizeSelectionRect(
                    current.startX,
                    current.startY,
                    current.currentX,
                    current.currentY
                );
                const minSize = 4;
                const width = normalized.right - normalized.left;
                const height = normalized.bottom - normalized.top;

                if (width < minSize && height < minSize) {
                    if (!current.append) {
                        setSelectedStickerIds([]);
                    }
                    return null;
                }

                const selectedIdsFromBox = runtimeStickers
                    .map((sticker) => {
                        const element = document.querySelector<HTMLElement>(`[data-sticker-id="${sticker.id}"]`);
                        if (!element) return null;
                        const rect = element.getBoundingClientRect();
                        const stickerRect = {
                            left: rect.left,
                            top: rect.top,
                            right: rect.right,
                            bottom: rect.bottom,
                        };
                        return rectOverlaps(normalized, stickerRect) ? sticker.id : null;
                    })
                    .filter((id): id is string => Boolean(id));

                setSelectedStickerIds(prev => {
                    if (current.append) {
                        const merged = new Set([...prev, ...selectedIdsFromBox]);
                        return Array.from(merged);
                    }
                    return selectedIdsFromBox;
                });
                return null;
            });
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [runtimeStickers, selectionBox]);

    // 处理图片文件选择
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result as string;
            const compressed = await compressStickerImage(base64);
            const img = new Image();
            img.onload = () => {
                const x = window.innerWidth / 2 - Math.min(img.width, IMAGE_MAX_WIDTH) / 2;
                const y = window.innerHeight / 2 - (img.height * Math.min(img.width, IMAGE_MAX_WIDTH) / img.width) / 2;
                const withPercent = updateStickerPercentCoordinates({
                    id: '',
                    type: 'image',
                    content: compressed,
                    x,
                    y,
                }, viewport);
                addSticker({
                    type: 'image',
                    content: compressed,
                    x: withPercent.x,
                    y: withPercent.y,
                    xPct: withPercent.xPct,
                    yPct: withPercent.yPct,
                });
            };
            img.src = compressed;
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [addSticker, viewport]);

    // 处理文本输入提交
    const handleTextSubmit = useCallback((content: string, style?: { color: string; textAlign: 'left' | 'center' | 'right'; fontSize: number; fontPreset: StickerFontPreset }) => {
        if (editingSticker) {
            updateSticker(editingSticker.id, {
                content,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : editingSticker.style,
            });
        } else if (textInputPos) {
            const withPercent = updateStickerPercentCoordinates({
                id: '',
                type: 'text',
                content,
                x: textInputPos.x,
                y: textInputPos.y,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : undefined,
            }, viewport);
            addSticker({
                type: 'text',
                content,
                x: withPercent.x,
                y: withPercent.y,
                xPct: withPercent.xPct,
                yPct: withPercent.yPct,
                style: style ? {
                    color: style.color,
                    textAlign: style.textAlign,
                    fontSize: style.fontSize,
                    fontPreset: style.fontPreset,
                } : undefined,
            });
        }
        setTextInputPos(null);
        setEditingSticker(null);
    }, [textInputPos, editingSticker, addSticker, updateSticker, viewport]);

    const handleTextCancel = useCallback(() => {
        setTextInputPos(null);
        setEditingSticker(null);
    }, []);

    const handleAddTemplateSticker = useCallback((template: StickerTemplateType, x: number, y: number) => {
        const templateInput = buildStickerTemplate({
            template,
            language,
            x,
            y,
        });
        const withPercent = updateStickerPercentCoordinates({
            id: '',
            ...templateInput,
        }, viewport);
        addSticker({
            ...templateInput,
            x: withPercent.x,
            y: withPercent.y,
            xPct: withPercent.xPct,
            yPct: withPercent.yPct,
        });
    }, [addSticker, language, viewport]);

    const handleGroupSelection = useCallback(() => {
        if (selectedStickerIds.length < 2) return;
        const nextGroupId = createRuntimeGroupId();
        selectedStickerIds.forEach((id) => {
            if (groupMap[id] !== nextGroupId) {
                updateSticker(id, { groupId: nextGroupId });
            }
        });
    }, [groupMap, selectedStickerIds, updateSticker]);

    const handleUngroupSelection = useCallback(() => {
        if (selectedStickerIds.length === 0) return;
        selectedStickerIds.forEach((id) => {
            if (groupMap[id]) {
                updateSticker(id, { groupId: undefined });
            }
        });
    }, [groupMap, selectedStickerIds, updateSticker]);

    const handleLockSelection = useCallback(() => {
        if (selectedStickerIds.length === 0) return;
        const nextLockedIds = lockSelection(lockedStickerIds, selectedStickerIds);
        const nextLockedSet = new Set(nextLockedIds);
        selectedStickerIds.forEach((id) => {
            if (!lockedStickerIdSet.has(id) && nextLockedSet.has(id)) {
                updateSticker(id, { locked: true });
            }
        });
    }, [lockedStickerIdSet, lockedStickerIds, selectedStickerIds, updateSticker]);

    const handleUnlockSelection = useCallback(() => {
        if (selectedStickerIds.length === 0) return;
        const nextLockedIds = unlockSelection(lockedStickerIds, selectedStickerIds);
        const nextLockedSet = new Set(nextLockedIds);
        selectedStickerIds.forEach((id) => {
            if (lockedStickerIdSet.has(id) && !nextLockedSet.has(id)) {
                updateSticker(id, { locked: undefined });
            }
        });
    }, [lockedStickerIdSet, lockedStickerIds, selectedStickerIds, updateSticker]);

    const handleEditSticker = useCallback((sticker: Sticker) => {
        setEditingSticker(sticker);
        setTextInputPos({ x: sticker.x, y: sticker.y });
    }, []);

    // 处理粘贴 - 添加图片贴纸
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
                if (activeElement.closest('[data-ui-zone]')) {
                    return;
                }
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = async () => {
                        const base64 = reader.result as string;
                        const compressed = await compressStickerImage(base64);
                        const img = new Image();
                        img.onload = () => {
                            const x = window.innerWidth / 2 - Math.min(img.width, IMAGE_MAX_WIDTH) / 2;
                            const y = window.innerHeight / 2 - (img.height * Math.min(img.width, IMAGE_MAX_WIDTH) / img.width) / 2;
                            const withPercent = updateStickerPercentCoordinates({
                                id: '',
                                type: 'image',
                                content: compressed,
                                x,
                                y,
                            }, viewport);
                            addSticker({
                                type: 'image',
                                content: compressed,
                                x: withPercent.x,
                                y: withPercent.y,
                                xPct: withPercent.xPct,
                                yPct: withPercent.yPct,
                            });
                        };
                        img.src = compressed;
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [addSticker, viewport]);

    return (
        <div
            ref={canvasRef}
            className={`${styles.canvas} ${isEditMode ? styles.creativeMode : ''} ${isAnyDragging ? styles.dragging : ''}`}
        >
            {isEditMode && effectiveGridSnap && (
                <div className={styles.gridOverlay} />
            )}

            {isEditMode && alignmentGuides.map((guide, index) => (
                <div
                    key={`${guide.orientation}-${guide.position}-${guide.source}-${index}`}
                    className={[
                        styles.alignmentGuide,
                        guide.orientation === 'vertical' ? styles.verticalGuide : styles.horizontalGuide,
                        guide.source === 'grid' ? styles.gridGuide : styles.alignGuide,
                    ].join(' ')}
                    style={
                        guide.orientation === 'vertical'
                            ? { left: `${guide.position}px` }
                            : { top: `${guide.position}px` }
                    }
                />
            ))}

            {selectionBox && (
                <div
                    className={styles.selectionBox}
                    style={{
                        left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                        top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                        width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                        height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                    }}
                />
            )}

            {runtimeStickers
                .filter((sticker) => !editingSticker || sticker.id !== editingSticker.id)
                .map((sticker) => (
                    <StickerItem
                        key={sticker.id}
                        sticker={sticker}
                        isSelected={selectedStickerIdSet.has(sticker.id)}
                        isCreativeMode={isEditMode}
                        onSelect={(appendSelection) => handleStickerSelect(sticker.id, appendSelection)}
                        onDelete={() => deleteSticker(sticker.id)}
                        onPositionChange={(x, y) => handleStickerPositionChange(sticker, x, y)}
                        onStyleChange={(updates) => {
                            if (sticker.style) {
                                updateSticker(sticker.id, { style: { ...sticker.style, ...updates } });
                            }
                        }}
                        onBringToTop={() => bringToTop(sticker.id)}
                        onScaleChange={(scale) => {
                            const stickerGroupId = groupMap[sticker.id];
                            if (!stickerGroupId) {
                                updateSticker(sticker.id, { scale });
                                return;
                            }

                            const groupedIds = Object.entries(groupMap)
                                .filter(([, groupId]) => groupId === stickerGroupId)
                                .map(([id]) => id);
                            groupedIds.forEach((groupedId) => {
                                if (lockedStickerIdSet.has(groupedId)) return;
                                const groupedSticker = runtimeStickers.find(item => item.id === groupedId);
                                if (!groupedSticker || groupedSticker.type !== 'image') return;
                                updateSticker(groupedSticker.id, { scale });
                            });
                        }}
                        isEditMode={isEditMode}
                        onDoubleClick={() => {
                            if (sticker.type === 'text') {
                                handleEditSticker(sticker);
                            }
                        }}
                        onDragStart={handleStickerDragStart}
                        onDragEnd={handleStickerDragEnd}
                        isLocked={lockedStickerIdSet.has(sticker.id)}
                        snapToGrid={effectiveGridSnap}
                        onGuidesChange={setAlignmentGuides}
                    />
                ))}

            {textInputPos && (
                <TextInput
                    x={textInputPos.x}
                    y={textInputPos.y}
                    initialText={editingSticker?.content || ''}
                    initialStyle={editingSticker?.style}
                    onSubmit={handleTextSubmit}
                    onCancel={handleTextCancel}
                />
            )}

            <RecycleBin
                isVisible={isAnyDragging}
                onClick={() => setIsRecycleBinOpen(true)}
            />

            <RecycleBinModal
                isOpen={isRecycleBinOpen}
                onClose={() => setIsRecycleBinOpen(false)}
            />

            {/* 上下文菜单 */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    type={contextMenu.type}
                    stickerId={contextMenu.stickerId}
                    onAddTodoTemplate={() => {
                        handleAddTemplateSticker('todo', contextMenu.x, contextMenu.y);
                    }}
                    onAddMeetingTemplate={() => {
                        handleAddTemplateSticker('meeting', contextMenu.x, contextMenu.y);
                    }}
                    onAddIdeaTemplate={() => {
                        handleAddTemplateSticker('idea', contextMenu.x, contextMenu.y);
                    }}
                    hasSelection={selectionActionState.hasSelection}
                    canGroupSelection={selectionActionState.canGroup}
                    canUngroupSelection={selectionActionState.canUngroup}
                    canLockSelection={selectionActionState.canLock}
                    canUnlockSelection={selectionActionState.canUnlock}
                    isGridSnapEnabled={gridSnapEnabled}
                    onGroupSelection={handleGroupSelection}
                    onUngroupSelection={handleUngroupSelection}
                    onLockSelection={handleLockSelection}
                    onUnlockSelection={handleUnlockSelection}
                    onToggleGridSnap={() => setGridSnapEnabled(prev => !prev)}
                    isImageSticker={(() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        return sticker?.type === 'image';
                    })()}
                    onClose={() => setContextMenu(null)}
                    onAddSticker={() => {
                        setTextInputPos({ x: contextMenu.x, y: contextMenu.y });
                    }}
                    onUploadImage={() => {
                        fileInputRef.current?.click();
                    }}
                    onToggleEditMode={() => {
                        setIsEditMode(!isEditMode);
                    }}
                    isEditMode={isEditMode}
                    onEditSticker={() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker) {
                            handleEditSticker(sticker);
                        }
                    }}
                    onDeleteSticker={() => {
                        if (contextMenu.stickerId) {
                            deleteSticker(contextMenu.stickerId);
                        }
                    }}
                    onCopyImage={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'image') {
                            try {
                                const source = await resolveImageStickerContent(sticker);
                                if (!source) return;
                                const img = new Image();
                                img.onload = async () => {
                                    const blob = await imageToBlob(img);
                                    if (blob) {
                                        await copyBlobToClipboard(blob);
                                    }
                                };
                                img.src = source;
                            } catch (error) {
                                console.error('Failed to copy image:', error);
                            }
                        }
                    }}
                    onExportImage={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'text') {
                            try {
                                const blob = await createTextStickerImage(sticker);
                                if (blob) {
                                    downloadBlob(blob, `sticker-${Date.now()}.png`);
                                }
                            } catch (error) {
                                console.error('Failed to export sticker:', error);
                            }
                        }
                    }}
                    onCopyText={() => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'text') {
                            navigator.clipboard.writeText(sticker.content);
                        }
                    }}
                    onExportImageSticker={async () => {
                        const sticker = runtimeStickers.find(s => s.id === contextMenu.stickerId);
                        if (sticker && sticker.type === 'image') {
                            try {
                                const source = await resolveImageStickerContent(sticker);
                                if (!source) return;

                                const blob = await createImageStickerImage({
                                    ...sticker,
                                    content: source,
                                });
                                if (blob) {
                                    downloadBlob(blob, `sticker-${Date.now()}.png`);
                                }
                            } catch (error) {
                                console.error('Failed to export image sticker:', error);
                            }
                        }
                    }}
                    onOpenSettings={() => {
                        if (contextMenu) {
                            onOpenSettings?.({ x: contextMenu.x, y: contextMenu.y });
                        }
                    }}
                />
            )}

            {/* 用于图片上传的隐藏文件输入框 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </div>
    );
};
