import { useState, useMemo, useCallback, lazy, Suspense, useEffect, useRef, useLayoutEffect } from 'react';
import { DockItem } from './types';
import { useDockData, useDockUI, useDockDrag } from './context/DockContext';
import { useThemeData } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useSpaces } from './context/SpacesContext';
import { Searcher } from './components/Searcher/Searcher';
import { Dock } from './components/Dock/Dock';
import { Editor } from './components/Editor/Editor';
import { Settings } from './components/Settings/Settings';
import { Background } from './components/Background/Background';
import { ZenShelf } from './components/ZenShelf';
import { resolveDockInsertIndex } from './utils/dockInsertIndex';
import { storage } from './utils/storage';
import { createDomainRule, getActiveTabDomain, isMinuteInQuietHours, resolveSpaceSuggestion, SpaceSuggestion } from './utils/spaceRules';
import { openUrl } from './utils/url';
import { useStickerStrokeSync } from './hooks/useStickerStrokeSync';
import styles from './App.module.css';
import { useUndo } from './context/UndoContext';
import { UndoSnackbar } from './components/UndoSnackbar/UndoSnackbar';

// ============================================================================
// 性能优化: 懒加载非核心组件，减少初始包大小
// ============================================================================
const FolderView = lazy(() => import('./components/FolderView/FolderView').then(m => ({ default: m.FolderView })));
const AddEditModal = lazy(() => import('./components/Modal/AddEditModal').then(m => ({ default: m.AddEditModal })));
const SearchEngineModal = lazy(() => import('./components/Modal/SearchEngineModal').then(m => ({ default: m.SearchEngineModal })));
const SettingsModal = lazy(() => import('./components/Modal/SettingsModal').then(m => ({ default: m.SettingsModal })));

const applySearchQuery = (template: string, query: string): string => {
  const encodedQuery = encodeURIComponent(query);
  if (template.includes('{query}')) {
    return template.split('{query}').join(encodedQuery);
  }
  if (template.includes('%s')) {
    return template.split('%s').join(encodedQuery);
  }
  return `${template}${encodedQuery}`;
};

const buildSpaceSuggestionKey = (suggestion: SpaceSuggestion): string =>
  `${suggestion.spaceId}:${suggestion.reason}:${suggestion.domain || ''}:${suggestion.ruleId || ''}`;

function App() {
  // ============================================================================
  // 性能优化: 使用细粒度 Context Hooks 减少不必要的重渲染
  // ============================================================================

  // 数据层 (低频变化) - 仅在 dockItems/searchEngine 变化时重渲染
  const {
    dockItems,
    recentImportedIds,
    searchEngines,
    selectedSearchEngine,
    setSelectedSearchEngine,
    addSearchEngine,
    removeSearchEngine,
    restoreDeletedDockItem,
    handleItemDelete,
    handleItemSave,
    handleItemsReorder,
    handleFolderItemsReorder,
    handleFolderItemDelete,
    handleDragFromFolder,
    handleDragToFolder,
    handleDropOnFolder,
  } = useDockData();

  // UI 层 (中频变化) - 仅在 editMode/openFolder 变化时重渲染
  const {
    isEditMode,
    openFolderId,
    folderAnchor,
    setIsEditMode,
    setOpenFolderId,
    setFolderAnchor,
  } = useDockUI();

  // 拖拽层 (高频变化) - 仅在拖拽状态变化时重渲染
  const { draggingItem, setDraggingItem, setFolderPlaceholderActive } = useDockDrag();

  // 布局设置
  const { dockPosition, openInNewTab } = useThemeData();
  const { language, t } = useLanguage();
  const { showUndo } = useUndo();
  const { spaces, activeSpaceId, switchToSpace } = useSpaces();
  const [spaceRulesVersion, setSpaceRulesVersion] = useState(0);
  const [spaceSuggestionConfigVersion, setSpaceSuggestionConfigVersion] = useState(0);
  const [spaceSuggestion, setSpaceSuggestion] = useState<SpaceSuggestion | null>(null);
  const dismissedSuggestionRef = useRef<Record<string, number>>({});

  // 计算派生状态
  const openFolder = useMemo(
    () => dockItems.find((item) => item.id === openFolderId),
    [dockItems, openFolderId]
  );

  // 组合操作 - 需要同时访问数据和 UI
  const handleItemClick = useCallback((item: DockItem, rect?: DOMRect) => {
    if (item.type === 'folder') {
      setOpenFolderId(item.id);
      setFolderAnchor(rect ?? null);
    } else if (item.url) {
      openUrl(item.url, { openInNewTab });
    }
  }, [openInNewTab, setOpenFolderId, setFolderAnchor]);

  const handleHoverOpenFolder = useCallback((_item: DockItem, folder: DockItem) => {
    if (folder.type === 'folder') {
      setOpenFolderId(folder.id);
    }
  }, [setOpenFolderId]);

  // 本地 UI 状态 (Modal 相关)
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isSearchEngineModalOpen, setIsSearchEngineModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [searchEngineAnchor, setSearchEngineAnchor] = useState<DOMRect | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
  const [addIconAnchor, setAddIconAnchor] = useState<DOMRect | null>(null);
  const [editingItem, setEditingItem] = useState<DockItem | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dockWidth, setDockWidth] = useState<number | null>(null);

  // ============================================================================
  // 响应式缩放: 当窗口宽度接近容器宽度时，缩放底部容器
  // ============================================================================
  const SCALE_PADDING = 48; // 左右各留 24px 边距
  const MIN_SCALE = 0.5; // 最小缩放比例

  const [containerScale, setContainerScale] = useState(1);

  useLayoutEffect(() => {
    const calculateScale = () => {
      const windowWidth = window.innerWidth;
      // 使用实际的 dockWidth 作为阈值基准，如果还没有测量到则使用默认值 640
      const containerWidth = dockWidth ?? 640;
      const scaleThreshold = containerWidth + SCALE_PADDING;

      if (windowWidth >= scaleThreshold) {
        setContainerScale(1);
      } else {
        // 计算缩放比例: 窗口宽度 / 阈值宽度
        const scale = Math.max(MIN_SCALE, windowWidth / scaleThreshold);
        setContainerScale(scale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [dockWidth]);
  // 跟踪拖拽来源，用于区分内部拖拽和外部拖拽
  const [draggingFromFolder, setDraggingFromFolder] = useState(false);

  // 用于检测悬停区域的 Refs
  const settingsAreaRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // 性能优化: 使用 RAF 节流 + 状态变化检测，减少 mousemove 期间的重渲染
  // ============================================================================
  const lastSettingsState = useRef(false);
  const lastEditorState = useRef(false);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 取消上一帧的待处理更新
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        // 检查设置区域 (左上角)
        if (settingsAreaRef.current) {
          const rect = settingsAreaRef.current.getBoundingClientRect();
          const inSettingsZone = e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom;
          // 仅在状态变化时更新
          if (inSettingsZone !== lastSettingsState.current) {
            lastSettingsState.current = inSettingsZone;
            setShowSettings(inSettingsZone);
          }
        }
        // 检查编辑器区域 (右上角)
        if (editorAreaRef.current) {
          const rect = editorAreaRef.current.getBoundingClientRect();
          const inEditorZone = e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom;
          // 仅在状态变化时更新
          if (inEditorZone !== lastEditorState.current) {
            lastEditorState.current = inEditorZone;
            setShowEditor(inEditorZone);
          }
        }
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditMode, setIsEditMode]);

  useEffect(() => {
    const handleRulesChanged = () => {
      setSpaceRulesVersion((prev) => prev + 1);
    };
    window.addEventListener('eclipse-space-rules-changed', handleRulesChanged as EventListener);
    return () => {
      window.removeEventListener('eclipse-space-rules-changed', handleRulesChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleConfigChanged = () => {
      setSpaceSuggestionConfigVersion((prev) => prev + 1);
    };
    window.addEventListener('eclipse-config-changed', handleConfigChanged as EventListener);
    return () => {
      window.removeEventListener('eclipse-config-changed', handleConfigChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const evaluateSuggestion = async () => {
      const rules = storage.getSpaceRules().filter((rule) => rule.enabled);
      const now = new Date();

      const quietHoursEnabled = storage.getSpaceSuggestionQuietHoursEnabled();
      if (quietHoursEnabled) {
        const quietStartMinute = storage.getSpaceSuggestionQuietStartMinute();
        const quietEndMinute = storage.getSpaceSuggestionQuietEndMinute();
        const currentMinute = now.getHours() * 60 + now.getMinutes();

        if (isMinuteInQuietHours(currentMinute, quietStartMinute, quietEndMinute)) {
          if (!disposed) {
            setSpaceSuggestion(null);
          }
          return;
        }
      }

      const suggestionCooldownMinutes = storage.getSpaceSuggestionCooldownMinutes();

      const activeDomain = await getActiveTabDomain();
      const next = resolveSpaceSuggestion({
        spaces,
        activeSpaceId,
        rules,
        now,
        activeDomain,
      });

      if (disposed) return;
      if (!next) {
        setSpaceSuggestion(null);
        return;
      }

      const key = buildSpaceSuggestionKey(next);
      const dismissedAt = dismissedSuggestionRef.current[key] || 0;
      if (Date.now() - dismissedAt < suggestionCooldownMinutes * 60 * 1000) {
        setSpaceSuggestion(null);
        return;
      }

      setSpaceSuggestion(next);
    };

    void evaluateSuggestion();
    const timer = window.setInterval(() => {
      void evaluateSuggestion();
    }, 60000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [activeSpaceId, spaceRulesVersion, spaceSuggestionConfigVersion, spaces]);

  const dismissSpaceSuggestion = useCallback(() => {
    if (spaceSuggestion) {
      dismissedSuggestionRef.current[buildSpaceSuggestionKey(spaceSuggestion)] = Date.now();
    }
    setSpaceSuggestion(null);
  }, [spaceSuggestion]);

  const applySpaceSuggestion = useCallback(() => {
    if (!spaceSuggestion) return;
    switchToSpace(spaceSuggestion.spaceId);
    dismissedSuggestionRef.current[buildSpaceSuggestionKey(spaceSuggestion)] = Date.now();
    setSpaceSuggestion(null);
  }, [spaceSuggestion, switchToSpace]);

  const rememberSuggestedDomainRule = useCallback(() => {
    if (!spaceSuggestion?.domain || !spaceSuggestion.canRememberDomain) return;
    const currentRules = storage.getSpaceRules();
    const exists = currentRules.some((rule) =>
      rule.type === 'domain' &&
      rule.spaceId === spaceSuggestion.spaceId &&
      rule.domain === spaceSuggestion.domain
    );
    if (!exists) {
      storage.saveSpaceRules([...currentRules, createDomainRule(spaceSuggestion.spaceId, spaceSuggestion.domain)]);
    }
    dismissedSuggestionRef.current[buildSpaceSuggestionKey(spaceSuggestion)] = Date.now();
    setSpaceSuggestion(null);
  }, [spaceSuggestion]);

  const handleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // 输入的是 URL 时，按设置决定在当前页或新标签页打开
    try {
      const url = new URL(trimmedQuery);
      if (openUrl(url.toString(), { openInNewTab })) {
        return;
      }
    } catch {
      // 不是 URL，继续执行搜索
    }

    const searchTemplate = selectedSearchEngine.url || 'https://www.google.com/search?q=';
    const searchUrl = applySearchQuery(searchTemplate, trimmedQuery);
    openUrl(searchUrl, { openInNewTab });
  };

  const handleItemEdit = (item: DockItem, rect?: DOMRect) => {
    setEditingItem(item);
    setAddIconAnchor(rect ?? null);
    setIsAddEditModalOpen(true);
  };

  const handleItemAdd = () => {
    setEditingItem(null);
    setIsAddEditModalOpen(true);
  };

  const handleModalSave = (data: Partial<DockItem>) => {
    handleItemSave(data, editingItem);
    setIsAddEditModalOpen(false);
    setEditingItem(null);
  };

  const handleDockItemDelete = useCallback((item: DockItem) => {
    const message = language === 'zh'
      ? `确定要删除 "${item.name}" 吗？${item.type === 'folder' ? '文件夹内的所有内容也将被删除。' : ''}`
      : `Delete "${item.name}"?${item.type === 'folder' ? ' All items inside this folder will also be removed.' : ''}`;

    if (!window.confirm(message)) {
      return;
    }

    const record = handleItemDelete(item);
    if (!record) return;

    showUndo(
      language === 'zh' ? `已删除：${item.name}` : `Deleted: ${item.name}`,
      () => {
        restoreDeletedDockItem(record.id);
      }
    );
  }, [handleItemDelete, language, restoreDeletedDockItem, showUndo]);

  const handleDockItemsReorderWithUndo = useCallback((items: DockItem[]) => {
    const previous = dockItems;
    const sameOrder =
      previous.length === items.length &&
      previous.every((item, index) => item.id === items[index]?.id);

    handleItemsReorder(items);
    if (sameOrder) {
      return;
    }
    showUndo(
      language === 'zh' ? 'Dock 已调整，可撤销' : 'Dock reordered',
      () => {
        handleItemsReorder(previous);
      }
    );
  }, [dockItems, handleItemsReorder, language, showUndo]);

  const handleFolderItemDeleteWithUndo = useCallback((folderId: string, item: DockItem) => {
    const message = language === 'zh'
      ? `确定要删除 "${item.name}" 吗？`
      : `Delete "${item.name}"?`;
    if (!window.confirm(message)) return;

    const record = handleFolderItemDelete(folderId, item);
    if (!record) return;

    showUndo(
      language === 'zh' ? `已删除：${item.name}` : `Deleted: ${item.name}`,
      () => {
        restoreDeletedDockItem(record.id);
      }
    );
  }, [handleFolderItemDelete, language, restoreDeletedDockItem, showUndo]);

  const handleFolderItemClick = useCallback((item: DockItem) => {
    if (item.url) {
      openUrl(item.url, { openInNewTab });
    }
  }, [openInNewTab]);

  const handleFolderItemEdit = useCallback((item: DockItem, rect?: DOMRect) => {
    handleItemEdit(item, rect);
  }, []);

  const resolveDockInsertIndexFromDom = useCallback((mouseX: number): number => {
    const dockElement = document.querySelector('[data-dock-container="true"]');
    if (!dockElement) {
      return dockItems.length;
    }

    const dockItemElements = Array.from(dockElement.querySelectorAll('[data-dock-item-wrapper="true"]'));
    const centers = dockItemElements.map((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    return resolveDockInsertIndex(mouseX, centers);
  }, [dockItems.length]);

  const handleDragFromFolderToDock = useCallback((item: DockItem, { x }: { x: number; y: number }) => {
    const insertIndex = resolveDockInsertIndexFromDom(x);
    handleDragFromFolder(item, insertIndex);
  }, [handleDragFromFolder, resolveDockInsertIndexFromDom]);

  useStickerStrokeSync();

  const suggestionSpaceName = spaceSuggestion
    ? (spaces.find((space) => space.id === spaceSuggestion.spaceId)?.name || '')
    : '';

  return (
    <div className={styles.app}>
      {/* SVG 滤镜定义 - 用于文字贴纸的平滑描边效果 */}
      <svg width="0" height="0" style={{ position: 'absolute', visibility: 'hidden' }}>
        <defs>
          {/* 圆角描边滤镜：使用 feMorphology dilate + 模糊 + 锐化实现圆角效果 */}
          <filter id="text-sticker-stroke" x="-25%" y="-25%" width="150%" height="150%">
            {/* 步骤1: 扩展原始图形轮廓 */}
            <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="dilated" />
            {/* 步骤2: 轻微模糊使边缘变圆滑 */}
            <feGaussianBlur in="dilated" stdDeviation="2" result="blurred" />
            {/* 步骤3: 使用 feComponentTransfer 锐化边缘,将模糊重新变成实心 */}
            <feComponentTransfer in="blurred" result="rounded">
              <feFuncA type="table" tableValues="0 0 0.5 1 1 1 1 1" />
            </feComponentTransfer>
            {/* 步骤4: 将圆角轮廓填充为 --color-sticker-stroke (动态更新) */}
            <feFlood floodColor="white" result="white" />
            <feComposite in="white" in2="rounded" operator="in" result="stroke" />
            {/* 步骤5: 将描边放在原始图形下方 */}
            <feMerge>
              <feMergeNode in="stroke" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <Background />
      <ZenShelf onOpenSettings={(pos) => {
        // 直接使用传入的位置，不需要为了抵消 SettingsModal 的内部偏移而做运算
        setSettingsAnchor({ left: pos.x, top: pos.y, right: pos.x, bottom: pos.y, width: 0, height: 0, x: pos.x, y: pos.y, toJSON: () => ({}) } as DOMRect);
        setIsSettingsModalOpen(true);
      }} />
      <div
        className={dockPosition === 'center' ? styles.containerCenter : styles.container}
        data-ui-zone="bottom"
        style={containerScale < 1 ? {
          transform: dockPosition === 'center'
            ? `translate(-50%, -50%) scale(${containerScale})`
            : `translate(-50%, -100%) scale(${containerScale})`,
          transformOrigin: dockPosition === 'center' ? 'center center' : 'bottom center',
        } : undefined}
      >
        <Searcher
          searchEngine={selectedSearchEngine}
          onSearch={handleSearch}
          onSearchEngineClick={(rect) => {
            setSearchEngineAnchor(rect);
            setIsSearchEngineModalOpen(true);
          }}
          containerStyle={dockWidth ? { width: `${dockWidth}px` } : undefined}
        />
        <Dock
          items={dockItems}
          isEditMode={isEditMode}
          onItemClick={handleItemClick}
          onItemEdit={handleItemEdit}
          onItemDelete={handleDockItemDelete}
          onItemAdd={(rect) => {
            setAddIconAnchor(rect ?? null);
            handleItemAdd();
          }}
          onItemsReorder={handleDockItemsReorderWithUndo}
          onDropToFolder={handleDropOnFolder}
          onDragToOpenFolder={handleDragToFolder}
          onHoverOpenFolder={handleHoverOpenFolder}
          onLongPressEdit={() => setIsEditMode(true)}
          onWidthChange={(w) => setDockWidth(w)}
          onDragStart={(item) => setDraggingItem(item)}
          onDragEnd={() => setDraggingItem(null)}
          externalDragItem={draggingItem}
          highlightedItemIds={recentImportedIds}
        />
      </div>
      {/* 左上角触发热点：悬停显示设置按钮 */}
      <div
        ref={settingsAreaRef}
        className={styles.settingsArea}
        data-ui-zone="top-left"
      >
        <Settings
          visible={showSettings}
          onClick={(e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSettingsAnchor(rect);
            setIsSettingsModalOpen(true);
          }}
        />
      </div>
      {/* 右上角触发热点：悬停显示编辑按钮 */}
      <div
        ref={editorAreaRef}
        className={styles.editorArea}
        data-ui-zone="top-right"
      >
        <Editor
          visible={showEditor || isEditMode}
          isEditMode={isEditMode}
          onClick={() => setIsEditMode(!isEditMode)}
        />
      </div>
      {openFolder && openFolder.type === 'folder' && (
        <Suspense fallback={null}>
          <FolderView
            folder={openFolder}
            isEditMode={isEditMode}
            onItemClick={handleFolderItemClick}
            onItemEdit={handleFolderItemEdit}
            onItemDelete={(item) => handleFolderItemDeleteWithUndo(openFolder.id, item)}
            onClose={() => { setOpenFolderId(null); setFolderAnchor(null); }}
            onItemsReorder={(items) => handleFolderItemsReorder(openFolder.id, items)}
            onItemDragOut={handleDragFromFolderToDock}
            anchorRect={folderAnchor}
            onDragStart={(item) => { setDraggingItem(item); setDraggingFromFolder(true); }}
            onDragEnd={() => { setDraggingItem(null); setDraggingFromFolder(false); }}
            externalDragItem={draggingFromFolder ? null : draggingItem}
            onFolderPlaceholderChange={setFolderPlaceholderActive}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
          />
        </Suspense>
      )}
      {isAddEditModalOpen && (
        <Suspense fallback={null}>
          <AddEditModal
            isOpen={isAddEditModalOpen}
            item={editingItem}
            onClose={() => {
              setIsAddEditModalOpen(false);
              setEditingItem(null);
            }}
            onSave={handleModalSave}
            anchorRect={addIconAnchor}
            hideHeader
          />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <SearchEngineModal
          isOpen={isSearchEngineModalOpen}
          selectedEngine={selectedSearchEngine}
          engines={searchEngines}
          isEditMode={isEditMode}
          onClose={() => setIsSearchEngineModalOpen(false)}
          onSelect={setSelectedSearchEngine}
          onAddCustomEngine={addSearchEngine}
          onDeleteEngine={removeSearchEngine}
          anchorRect={searchEngineAnchor}
        />
      </Suspense>
      {isSettingsModalOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            // 显式添加偏移量：ZenShelf 右键菜单不需要偏移（anchorPosition 已经是鼠标位置），
            // 但如果是从左上角按钮触发（settingsAnchor 来自 getBoundingClientRect），我们需要手动加上偏移量（+60px 或按钮高度+间距）
            // 这里我们简单判断：如果是从按钮触发（通常 y < 100），加上偏移；如果是 ZenShelf 右键（通常 y > 100），不加偏移
            anchorPosition={settingsAnchor ? {
              x: settingsAnchor.left,
              y: settingsAnchor.top < 100 ? settingsAnchor.top + 60 : settingsAnchor.top
            } : { x: 0, y: 0 }}
          />
        </Suspense>
      )}
      {spaceSuggestion && (
        <div className={styles.spaceSuggestion} data-ui-zone="space-suggestion">
          <span className={styles.spaceSuggestionText}>
            {`${t.space.suggestionSwitchPrefix}: ${suggestionSpaceName} · ${spaceSuggestion.reason === 'domain' ? t.space.suggestionReasonDomain : t.space.suggestionReasonTime}`}
          </span>
          <button className={styles.spaceSuggestionAction} onClick={applySpaceSuggestion} type="button">
            {t.space.suggestionSwitchAction}
          </button>
          {spaceSuggestion.canRememberDomain && spaceSuggestion.domain && (
            <button className={styles.spaceSuggestionAction} onClick={rememberSuggestedDomainRule} type="button">
              {t.space.suggestionRememberAction}
            </button>
          )}
          <button className={styles.spaceSuggestionClose} onClick={dismissSpaceSuggestion} type="button" aria-label={t.space.suggestionDismissAction}>
            ×
          </button>
        </div>
      )}
      <UndoSnackbar />
    </div>
  );
}

export default App;
