import {
  DockItem,
  SearchEngine,
  SpacesState,
  SpaceOverride,
  SpaceOverrides,
  SpaceOverrideTheme,
  createDefaultSpacesState,
  DeletedDockItemRecord,
  DeletedSpaceRecord,
} from '../types';
import { logger } from './logger';

export const STORAGE_KEYS = {
  DOCK_ITEMS: 'EclipseTab_dockItems',
  SEARCH_ENGINE: 'EclipseTab_searchEngine',
  SEARCH_ENGINES: 'EclipseTab_searchEngines',
  // Config (Unified settings)
  CONFIG: 'EclipseTab_config',

  // Legacy Keys (kept for reference, strictly used for migration)
  // THEME: 'EclipseTab_theme',
  // FOLLOW_SYSTEM: 'EclipseTab_followSystem',
  // DOCK_POSITION: 'EclipseTab_dockPosition',
  // ICON_SIZE: 'EclipseTab_iconSize',
  // GRADIENT: 'EclipseTab_gradient',
  // TEXTURE: 'EclipseTab_texture',

  WALLPAPER: 'EclipseTab_wallpaper',
  LAST_WALLPAPER: 'EclipseTab_lastWallpaper',
  WALLPAPER_ID: 'EclipseTab_wallpaperId',

  // Focus Spaces
  SPACES: 'EclipseTab_spaces',
  SPACE_RULES: 'EclipseTab_spaceRules',
  SPACE_OVERRIDES: 'EclipseTab_spaceOverrides',
  // Zen Shelf Stickers
  STICKERS: 'EclipseTab_stickers',
  // Deleted Stickers (Recycle Bin)
  DELETED_STICKERS: 'EclipseTab_deletedStickers',
  // Dock/Space Recycle Bin
  DELETED_DOCK_ITEMS: 'EclipseTab_deletedDockItems',
  DELETED_SPACES: 'EclipseTab_deletedSpaces',
} as const;

const LEGACY_LANGUAGE_KEY = 'app_language';
type AppLanguage = 'en' | 'zh';

// Unified Configuration Interface
export interface AppConfig {
  language: AppLanguage;
  theme: string;
  followSystem: boolean;
  dockPosition: 'center' | 'bottom';
  iconSize: 'large' | 'small';
  gridSnapEnabled: boolean;
  widgetSnapAutoGroupEnabled: boolean;
  openInNewTab: boolean;
  allowThirdPartyIconService: boolean;
  thirdPartyIconServicePrompted: boolean;
  texture: string;
  gradient: string | null;
  spaceSuggestionCooldownMinutes: number;
  spaceSuggestionQuietHoursEnabled: boolean;
  spaceSuggestionQuietStartMinute: number;
  spaceSuggestionQuietEndMinute: number;
}

const DEFAULT_CONFIG: AppConfig = {
  language: 'en',
  theme: 'light',
  followSystem: true,
  dockPosition: 'bottom',
  iconSize: 'large',
  gridSnapEnabled: true,
  widgetSnapAutoGroupEnabled: false,
  openInNewTab: false,
  allowThirdPartyIconService: false,
  thirdPartyIconServicePrompted: false,
  texture: 'point',
  gradient: null,
  spaceSuggestionCooldownMinutes: 10,
  spaceSuggestionQuietHoursEnabled: true,
  spaceSuggestionQuietStartMinute: 23 * 60,
  spaceSuggestionQuietEndMinute: 7 * 60,
};

// ============================================================================
// 性能优化: 内存缓存层，避免重复 JSON.parse
// ============================================================================
interface CacheEntry<T> {
  data: T;
  raw: string; // 用于检测 localStorage 是否被外部修改
}

const memoryCache = {
  spaces: null as CacheEntry<SpacesState> | null,
  spaceRules: null as CacheEntry<import('../types').SpaceRule[]> | null,
  spaceOverrides: null as CacheEntry<SpaceOverrides> | null,
  stickers: null as CacheEntry<import('../types').Sticker[]> | null,
  deletedStickers: null as CacheEntry<import('../types').Sticker[]> | null,
  deletedDockItems: null as CacheEntry<DeletedDockItemRecord[]> | null,
  deletedSpaces: null as CacheEntry<DeletedSpaceRecord[]> | null,
  config: null as CacheEntry<AppConfig> | null,
};

const isValidLanguage = (value: unknown): value is AppLanguage =>
  value === 'en' || value === 'zh';

const isValidSpaceOverrideTheme = (value: unknown): value is SpaceOverrideTheme =>
  value === 'default' || value === 'light' || value === 'dark';

const normalizeSpaceOverride = (value: unknown): SpaceOverride => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const candidate = value as SpaceOverride;
  const normalized: SpaceOverride = {};

  if (typeof candidate.searchEngineId === 'string' && candidate.searchEngineId.trim()) {
    normalized.searchEngineId = candidate.searchEngineId.trim();
  }

  if (isValidSpaceOverrideTheme(candidate.theme)) {
    normalized.theme = candidate.theme;
  }

  if (candidate.dockPosition === 'center' || candidate.dockPosition === 'bottom') {
    normalized.dockPosition = candidate.dockPosition;
  }

  return normalized;
};

const isEmptySpaceOverride = (override: SpaceOverride): boolean =>
  !override.searchEngineId && !override.theme && !override.dockPosition;

let storageFailureNotified = false;

const notifyStorageFailure = (): void => {
  if (storageFailureNotified) return;
  storageFailureNotified = true;

  if (typeof window === 'undefined') return;
  window.alert('Storage is full. Please export/clean up data, then try again.');
};

/**
 * 从缓存获取数据，如果 localStorage 数据未变则返回缓存
 */
function getCached<T>(key: string, cache: CacheEntry<T> | null): T | null {
  if (!cache) return null;
  try {
    const currentRaw = localStorage.getItem(key);
    if (currentRaw === cache.raw) {
      return cache.data;
    }
  } catch {
    // ignore
  }
  return null;
}

export const storage = {
  // ==========================================================================
  // Configuration Management (New Structured Storage)
  // ==========================================================================

  getConfig(): AppConfig {
    try {
      // Check memory cache
      const cached = getCached(STORAGE_KEYS.CONFIG, memoryCache.config);
      if (cached) return cached;

      const json = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (json) {
        const parsed = JSON.parse(json);
        const config = { ...DEFAULT_CONFIG, ...parsed } as AppConfig;
        const legacyLanguage = localStorage.getItem(LEGACY_LANGUAGE_KEY);
        const shouldApplyLegacyLanguage =
          !isValidLanguage((parsed as { language?: unknown }).language) &&
          isValidLanguage(legacyLanguage);
        if (shouldApplyLegacyLanguage) {
          config.language = legacyLanguage;
        }

        const normalizedJson = JSON.stringify(config);
        if (normalizedJson !== json) {
          localStorage.setItem(STORAGE_KEYS.CONFIG, normalizedJson);
        }
        if (isValidLanguage(legacyLanguage)) {
          localStorage.removeItem(LEGACY_LANGUAGE_KEY);
        }
        memoryCache.config = { data: config, raw: normalizedJson };
        return config;
      }

      // Migration: Try to read legacy keys
      const config = { ...DEFAULT_CONFIG };

      const legacyTheme = localStorage.getItem('EclipseTab_theme');
      if (legacyTheme) config.theme = legacyTheme;

      const legacyFollow = localStorage.getItem('EclipseTab_followSystem');
      if (legacyFollow !== null) config.followSystem = legacyFollow === 'true';

      const legacyDockPos = localStorage.getItem('EclipseTab_dockPosition');
      if (legacyDockPos === 'center' || legacyDockPos === 'bottom') config.dockPosition = legacyDockPos;

      const legacyIconSize = localStorage.getItem('EclipseTab_iconSize');
      if (legacyIconSize === 'small' || legacyIconSize === 'large') config.iconSize = legacyIconSize;

      const legacyTexture = localStorage.getItem('EclipseTab_texture');
      if (legacyTexture) config.texture = legacyTexture;

      const legacyGradient = localStorage.getItem('EclipseTab_gradient');
      if (legacyGradient) config.gradient = legacyGradient;

      const legacyLanguage = localStorage.getItem(LEGACY_LANGUAGE_KEY);
      if (isValidLanguage(legacyLanguage)) config.language = legacyLanguage;

      // Save migrated config
      const newJson = JSON.stringify(config);
      localStorage.setItem(STORAGE_KEYS.CONFIG, newJson);
      if (isValidLanguage(legacyLanguage)) {
        localStorage.removeItem(LEGACY_LANGUAGE_KEY);
      }
      memoryCache.config = { data: config, raw: newJson };

      return config;
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  saveConfig(config: AppConfig): void {
    try {
      const json = JSON.stringify(config);
      localStorage.setItem(STORAGE_KEYS.CONFIG, json);
      memoryCache.config = { data: config, raw: json };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eclipse-config-changed'));
      }
    } catch (error) {
      logger.error('Failed to save config:', error);
    }
  },

  updateConfig(patch: Partial<AppConfig>): void {
    const current = this.getConfig();
    const next = { ...current, ...patch };
    this.saveConfig(next);
  },

  // ==========================================================================
  // Specific Settings Accessors (Adapters using getConfig/saveConfig)
  // ==========================================================================

  getLanguage(): AppLanguage {
    const language = this.getConfig().language;
    return isValidLanguage(language) ? language : 'en';
  },

  saveLanguage(language: AppLanguage): void {
    this.updateConfig({ language });
    try {
      localStorage.removeItem(LEGACY_LANGUAGE_KEY);
    } catch {
      // ignore
    }
  },

  getTheme(): string {
    return this.getConfig().theme;
  },

  saveTheme(theme: string): void {
    this.updateConfig({ theme });
  },

  getFollowSystem(): boolean {
    return this.getConfig().followSystem;
  },

  saveFollowSystem(followSystem: boolean): void {
    this.updateConfig({ followSystem });
  },

  getDockPosition(): 'center' | 'bottom' {
    return this.getConfig().dockPosition;
  },

  saveDockPosition(dockPosition: 'center' | 'bottom'): void {
    this.updateConfig({ dockPosition });
  },

  getIconSize(): 'large' | 'small' {
    return this.getConfig().iconSize;
  },

  saveIconSize(iconSize: 'large' | 'small'): void {
    this.updateConfig({ iconSize });
  },

  getGridSnapEnabled(): boolean {
    return this.getConfig().gridSnapEnabled;
  },

  saveGridSnapEnabled(gridSnapEnabled: boolean): void {
    this.updateConfig({ gridSnapEnabled });
  },

  getWidgetSnapAutoGroupEnabled(): boolean {
    return this.getConfig().widgetSnapAutoGroupEnabled;
  },

  saveWidgetSnapAutoGroupEnabled(enabled: boolean): void {
    this.updateConfig({ widgetSnapAutoGroupEnabled: Boolean(enabled) });
  },

  getOpenInNewTab(): boolean {
    return this.getConfig().openInNewTab;
  },

  saveOpenInNewTab(openInNewTab: boolean): void {
    this.updateConfig({ openInNewTab });
  },

  getAllowThirdPartyIconService(): boolean {
    return this.getConfig().allowThirdPartyIconService;
  },

  saveAllowThirdPartyIconService(allowThirdPartyIconService: boolean): void {
    this.updateConfig({ allowThirdPartyIconService });
  },

  getThirdPartyIconServicePrompted(): boolean {
    return this.getConfig().thirdPartyIconServicePrompted;
  },

  saveThirdPartyIconServicePrompted(thirdPartyIconServicePrompted: boolean): void {
    this.updateConfig({ thirdPartyIconServicePrompted });
  },

  getTexture(): string {
    return this.getConfig().texture;
  },

  saveTexture(texture: string): void {
    this.updateConfig({ texture });
  },

  getGradient(): string | null {
    return this.getConfig().gradient;
  },

  saveGradient(gradient: string | null): void {
    this.updateConfig({ gradient });
  },

  getSpaceSuggestionCooldownMinutes(): number {
    return this.getConfig().spaceSuggestionCooldownMinutes;
  },

  saveSpaceSuggestionCooldownMinutes(value: number): void {
    const nextValue = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 10;
    this.updateConfig({ spaceSuggestionCooldownMinutes: nextValue });
  },

  getSpaceSuggestionQuietHoursEnabled(): boolean {
    return this.getConfig().spaceSuggestionQuietHoursEnabled;
  },

  saveSpaceSuggestionQuietHoursEnabled(enabled: boolean): void {
    this.updateConfig({ spaceSuggestionQuietHoursEnabled: Boolean(enabled) });
  },

  getSpaceSuggestionQuietStartMinute(): number {
    return this.getConfig().spaceSuggestionQuietStartMinute;
  },

  saveSpaceSuggestionQuietStartMinute(value: number): void {
    const nextValue = Number.isFinite(value) ? Math.max(0, Math.min(1439, Math.floor(value))) : 23 * 60;
    this.updateConfig({ spaceSuggestionQuietStartMinute: nextValue });
  },

  getSpaceSuggestionQuietEndMinute(): number {
    return this.getConfig().spaceSuggestionQuietEndMinute;
  },

  saveSpaceSuggestionQuietEndMinute(value: number): void {
    const nextValue = Number.isFinite(value) ? Math.max(0, Math.min(1439, Math.floor(value))) : 7 * 60;
    this.updateConfig({ spaceSuggestionQuietEndMinute: nextValue });
  },

  // ==========================================================================
  // Large Data / Independent Storage
  // ==========================================================================

  getDockItems(): DockItem[] {
    try {
      const items = localStorage.getItem(STORAGE_KEYS.DOCK_ITEMS);
      return items ? JSON.parse(items) : [];
    } catch {
      return [];
    }
  },

  saveDockItems(items: DockItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DOCK_ITEMS, JSON.stringify(items));
    } catch (error) {
      logger.error('Failed to save dock items:', error);
    }
  },

  getSearchEngine(): SearchEngine | null {
    try {
      const engine = localStorage.getItem(STORAGE_KEYS.SEARCH_ENGINE);
      return engine ? JSON.parse(engine) : null;
    } catch {
      return null;
    }
  },

  saveSearchEngine(engine: SearchEngine): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_ENGINE, JSON.stringify(engine));
    } catch (error) {
      logger.error('Failed to save search engine:', error);
    }
  },

  getSearchEngines(): SearchEngine[] | null {
    try {
      const engines = localStorage.getItem(STORAGE_KEYS.SEARCH_ENGINES);
      return engines ? JSON.parse(engines) : null;
    } catch {
      return null;
    }
  },

  saveSearchEngines(engines: SearchEngine[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_ENGINES, JSON.stringify(engines));
    } catch (error) {
      logger.error('Failed to save search engines:', error);
    }
  },

  getWallpaper(): string | null {
    try {
      // Legacy compatibility: wallpaper binary is now in IndexedDB; this key only keeps fallback/base64.
      return localStorage.getItem(STORAGE_KEYS.WALLPAPER);
    } catch {
      return null;
    }
  },

  saveWallpaper(wallpaper: string | null): void {
    try {
      if (wallpaper) {
        // Legacy compatibility path. Preferred storage is IndexedDB + wallpaperId.
        localStorage.setItem(STORAGE_KEYS.WALLPAPER, wallpaper);
        localStorage.setItem(STORAGE_KEYS.LAST_WALLPAPER, wallpaper);
      } else {
        localStorage.removeItem(STORAGE_KEYS.WALLPAPER);
      }
    } catch (error) {
      logger.error('Failed to save wallpaper:', error);
    }
  },

  getWallpaperId(): string | null {
    try {
      // Primary reference to wallpaper binary in IndexedDB.
      return localStorage.getItem(STORAGE_KEYS.WALLPAPER_ID);
    } catch {
      return null;
    }
  },

  saveWallpaperId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.WALLPAPER_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.WALLPAPER_ID);
      }
    } catch (error) {
      logger.error('Failed to save wallpaper ID:', error);
    }
  },

  getLastWallpaper(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_WALLPAPER);
    } catch {
      return null;
    }
  },

  saveLastWallpaper(wallpaper: string | null): void {
    try {
      if (wallpaper) {
        localStorage.setItem(STORAGE_KEYS.LAST_WALLPAPER, wallpaper);
      } else {
        localStorage.removeItem(STORAGE_KEYS.LAST_WALLPAPER);
      }
    } catch (error) {
      logger.error('Failed to save last wallpaper:', error);
    }
  },

  // ==========================================================================
  // Focus Spaces
  // ==========================================================================

  getSpaces(): SpacesState {
    try {
      const cached = getCached(STORAGE_KEYS.SPACES, memoryCache.spaces);
      if (cached) return cached;

      const spacesJson = localStorage.getItem(STORAGE_KEYS.SPACES);
      if (spacesJson) {
        const parsed = JSON.parse(spacesJson);
        if (parsed && parsed.spaces && parsed.spaces.length > 0) {
          memoryCache.spaces = { data: parsed, raw: spacesJson };
          return parsed;
        }
      }

      // Migration from legacy dock items
      const legacyItems = this.getDockItems();
      if (legacyItems.length > 0) {
        const migratedState = createDefaultSpacesState(legacyItems);
        this.saveSpaces(migratedState);
        return migratedState;
      }

      const defaultState = createDefaultSpacesState();
      this.saveSpaces(defaultState);
      return defaultState;
    } catch (error) {
      logger.error('Failed to get spaces:', error);
      const fallbackState = createDefaultSpacesState();
      this.saveSpaces(fallbackState);
      return fallbackState;
    }
  },

  saveSpaces(state: SpacesState): void {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEYS.SPACES, json);
      memoryCache.spaces = { data: state, raw: json };
    } catch (error) {
      logger.error('Failed to save spaces:', error);
    }
  },

  getSpaceOverrides(): SpaceOverrides {
    try {
      const cached = getCached(STORAGE_KEYS.SPACE_OVERRIDES, memoryCache.spaceOverrides);
      if (cached) return cached;

      const json = localStorage.getItem(STORAGE_KEYS.SPACE_OVERRIDES);
      if (!json) return {};

      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};

      const normalized: SpaceOverrides = {};
      Object.entries(parsed).forEach(([spaceId, override]) => {
        if (!spaceId.trim()) return;
        const next = normalizeSpaceOverride(override);
        if (isEmptySpaceOverride(next)) return;
        normalized[spaceId] = next;
      });

      const normalizedJson = JSON.stringify(normalized);
      if (normalizedJson !== json) {
        localStorage.setItem(STORAGE_KEYS.SPACE_OVERRIDES, normalizedJson);
      }
      memoryCache.spaceOverrides = { data: normalized, raw: normalizedJson };
      return normalized;
    } catch (error) {
      logger.error('Failed to get space overrides:', error);
      return {};
    }
  },

  saveSpaceOverrides(overrides: SpaceOverrides): void {
    try {
      const normalized: SpaceOverrides = {};
      Object.entries(overrides).forEach(([spaceId, override]) => {
        if (!spaceId.trim()) return;
        const next = normalizeSpaceOverride(override);
        if (isEmptySpaceOverride(next)) return;
        normalized[spaceId] = next;
      });
      const json = JSON.stringify(normalized);
      localStorage.setItem(STORAGE_KEYS.SPACE_OVERRIDES, json);
      memoryCache.spaceOverrides = { data: normalized, raw: json };
    } catch (error) {
      logger.error('Failed to save space overrides:', error);
    }
  },

  getSpaceOverride(spaceId: string): SpaceOverride | null {
    if (!spaceId.trim()) return null;
    const overrides = this.getSpaceOverrides();
    return overrides[spaceId] || null;
  },

  updateSpaceOverride(spaceId: string, patch: Partial<SpaceOverride>): void {
    if (!spaceId.trim()) return;
    const overrides = this.getSpaceOverrides();
    const current = overrides[spaceId] || {};
    const merged = normalizeSpaceOverride({ ...current, ...patch });
    if (isEmptySpaceOverride(merged)) {
      delete overrides[spaceId];
    } else {
      overrides[spaceId] = merged;
    }
    this.saveSpaceOverrides(overrides);
  },

  removeSpaceOverride(spaceId: string): void {
    if (!spaceId.trim()) return;
    const overrides = this.getSpaceOverrides();
    if (!overrides[spaceId]) return;
    delete overrides[spaceId];
    this.saveSpaceOverrides(overrides);
  },

  getSpaceRules(): import('../types').SpaceRule[] {
    try {
      const cached = getCached(STORAGE_KEYS.SPACE_RULES, memoryCache.spaceRules);
      if (cached) return cached;

      const json = localStorage.getItem(STORAGE_KEYS.SPACE_RULES);
      if (!json) return [];

      const parsed = JSON.parse(json) as import('../types').SpaceRule[];
      memoryCache.spaceRules = { data: parsed, raw: json };
      return parsed;
    } catch (error) {
      logger.error('Failed to get space rules:', error);
      return [];
    }
  },

  saveSpaceRules(rules: import('../types').SpaceRule[]): void {
    try {
      const json = JSON.stringify(rules);
      localStorage.setItem(STORAGE_KEYS.SPACE_RULES, json);
      memoryCache.spaceRules = { data: rules, raw: json };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eclipse-space-rules-changed'));
      }
    } catch (error) {
      logger.error('Failed to save space rules:', error);
      notifyStorageFailure();
    }
  },

  clearSpaces(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SPACES);
    } catch (error) {
      logger.error('Failed to clear spaces:', error);
    }
  },

  // ==========================================================================
  // Zen Shelf Stickers
  // ==========================================================================

  getStickers(): import('../types').Sticker[] {
    try {
      const cached = getCached(STORAGE_KEYS.STICKERS, memoryCache.stickers);
      if (cached) return cached;

      const stickersJson = localStorage.getItem(STORAGE_KEYS.STICKERS);
      if (stickersJson) {
        const parsed = JSON.parse(stickersJson);
        memoryCache.stickers = { data: parsed, raw: stickersJson };
        return parsed;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get stickers:', error);
      return [];
    }
  },

  saveStickers(stickers: import('../types').Sticker[]): void {
    try {
      const json = JSON.stringify(stickers);
      localStorage.setItem(STORAGE_KEYS.STICKERS, json);
      memoryCache.stickers = { data: stickers, raw: json };
    } catch (error) {
      logger.error('Failed to save stickers:', error);
      notifyStorageFailure();
    }
  },

  getDeletedStickers(): import('../types').Sticker[] {
    try {
      const cached = getCached(STORAGE_KEYS.DELETED_STICKERS, memoryCache.deletedStickers);
      if (cached) return cached;

      const deletedStickersJson = localStorage.getItem(STORAGE_KEYS.DELETED_STICKERS);
      if (deletedStickersJson) {
        const parsed = JSON.parse(deletedStickersJson);
        memoryCache.deletedStickers = { data: parsed, raw: deletedStickersJson };
        return parsed;
      }
      return [];
    } catch (error) {
      logger.error('Failed to get deleted stickers:', error);
      return [];
    }
  },

  saveDeletedStickers(stickers: import('../types').Sticker[]): void {
    try {
      const json = JSON.stringify(stickers);
      localStorage.setItem(STORAGE_KEYS.DELETED_STICKERS, json);
      memoryCache.deletedStickers = { data: stickers, raw: json };
    } catch (error) {
      logger.error('Failed to save deleted stickers:', error);
      notifyStorageFailure();
    }
  },

  getDeletedDockItems(): DeletedDockItemRecord[] {
    try {
      const cached = getCached(STORAGE_KEYS.DELETED_DOCK_ITEMS, memoryCache.deletedDockItems);
      if (cached) return cached;

      const json = localStorage.getItem(STORAGE_KEYS.DELETED_DOCK_ITEMS);
      if (!json) return [];

      const parsed = JSON.parse(json) as DeletedDockItemRecord[];
      memoryCache.deletedDockItems = { data: parsed, raw: json };
      return parsed;
    } catch (error) {
      logger.error('Failed to get deleted dock items:', error);
      return [];
    }
  },

  saveDeletedDockItems(records: DeletedDockItemRecord[]): void {
    try {
      const json = JSON.stringify(records);
      localStorage.setItem(STORAGE_KEYS.DELETED_DOCK_ITEMS, json);
      memoryCache.deletedDockItems = { data: records, raw: json };
    } catch (error) {
      logger.error('Failed to save deleted dock items:', error);
      notifyStorageFailure();
    }
  },

  getDeletedSpaces(): DeletedSpaceRecord[] {
    try {
      const cached = getCached(STORAGE_KEYS.DELETED_SPACES, memoryCache.deletedSpaces);
      if (cached) return cached;

      const json = localStorage.getItem(STORAGE_KEYS.DELETED_SPACES);
      if (!json) return [];

      const parsed = JSON.parse(json) as DeletedSpaceRecord[];
      memoryCache.deletedSpaces = { data: parsed, raw: json };
      return parsed;
    } catch (error) {
      logger.error('Failed to get deleted spaces:', error);
      return [];
    }
  },

  saveDeletedSpaces(records: DeletedSpaceRecord[]): void {
    try {
      const json = JSON.stringify(records);
      localStorage.setItem(STORAGE_KEYS.DELETED_SPACES, json);
      memoryCache.deletedSpaces = { data: records, raw: json };
    } catch (error) {
      logger.error('Failed to save deleted spaces:', error);
      notifyStorageFailure();
    }
  },

  getManagedStorageKeys(): string[] {
    return Object.values(STORAGE_KEYS);
  },

  resetMemoryCache(): void {
    memoryCache.spaces = null;
    memoryCache.spaceRules = null;
    memoryCache.spaceOverrides = null;
    memoryCache.stickers = null;
    memoryCache.deletedStickers = null;
    memoryCache.deletedDockItems = null;
    memoryCache.deletedSpaces = null;
    memoryCache.config = null;
  },
};
