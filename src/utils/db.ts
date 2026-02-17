import { logger } from './logger';

export const DB_NAME = 'EclipseTabDB';
export const WALLPAPER_STORE_NAME = 'wallpapers';
export const STICKER_ASSET_STORE_NAME = 'stickers_assets';
// Backward compatibility alias
export const STORE_NAME = WALLPAPER_STORE_NAME;
const DB_VERSION = 2;

export interface WallpaperItem {
    id: string;
    data: Blob;
    thumbnail?: Blob;
    createdAt: number;
}

export interface StickerAssetItem {
    id: string;
    data: string;
    createdAt: number;
}

interface DBWrapper {
    save: (item: WallpaperItem) => Promise<string>;
    saveMultiple: (items: WallpaperItem[]) => Promise<string[]>;
    get: (id: string) => Promise<WallpaperItem | null>;
    remove: (id: string) => Promise<void>;
    removeMultiple: (ids: string[]) => Promise<void>;
    getAll: () => Promise<WallpaperItem[]>;
    saveStickerAsset: (item: StickerAssetItem) => Promise<string>;
    getStickerAsset: (id: string) => Promise<StickerAssetItem | null>;
    removeStickerAsset: (id: string) => Promise<void>;
    removeStickerAssets: (ids: string[]) => Promise<void>;
}

class IndexedDBWrapper implements DBWrapper {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private getDB(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.dbPromise = new Promise((resolve, reject) => {
                if (typeof window === 'undefined' || !window.indexedDB) {
                    reject(new Error('IndexedDB is not supported'));
                    return;
                }

                try {
                    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                    request.onerror = (event) => {
                        this.dbPromise = null;
                        // Handle privacy mode restrictions (SecurityError)
                        const error = (event.target as IDBOpenDBRequest).error;
                        logger.error('IndexedDB open error:', error);
                        reject(error || new Error('Failed to open IndexedDB'));
                    };

                    request.onsuccess = () => resolve(request.result);

                    request.onupgradeneeded = (event) => {
                        const db = (event.target as IDBOpenDBRequest).result;
                        if (!db.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
                            // Use keyPath 'id' for future extensibility and easier querying
                            db.createObjectStore(WALLPAPER_STORE_NAME, { keyPath: 'id' });
                        }

                        if (!db.objectStoreNames.contains(STICKER_ASSET_STORE_NAME)) {
                            db.createObjectStore(STICKER_ASSET_STORE_NAME, { keyPath: 'id' });
                        }
                    };
                } catch (e) {
                    this.dbPromise = null;
                    reject(e);
                }
            });
        }
        return this.dbPromise;
    }

    async save(item: WallpaperItem): Promise<string> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);
                const request = store.put(item);

                request.onsuccess = () => resolve(item.id);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB Save Error:', error);
            throw error;
        }
    }

    // ========================================================================
    // 性能优化: 批量操作使用单个事务，减少事务开销
    // ========================================================================

    async saveMultiple(items: WallpaperItem[]): Promise<string[]> {
        if (items.length === 0) return [];

        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);
                const ids: string[] = [];

                // 在单个事务中执行所有写入操作
                items.forEach(item => {
                    store.put(item);
                    ids.push(item.id);
                });

                transaction.oncomplete = () => resolve(ids);
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            logger.error('DB SaveMultiple Error:', error);
            throw error;
        }
    }

    async get(id: string): Promise<WallpaperItem | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readonly');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB Get Error:', error);
            return null;
        }
    }

    async remove(id: string): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);
                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB Remove Error:', error);
            throw error;
        }
    }

    async removeMultiple(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);

                // 在单个事务中执行所有删除操作
                ids.forEach(id => {
                    store.delete(id);
                });

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            logger.error('DB RemoveMultiple Error:', error);
            throw error;
        }
    }

    async getAll(): Promise<WallpaperItem[]> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(WALLPAPER_STORE_NAME, 'readonly');
                const store = transaction.objectStore(WALLPAPER_STORE_NAME);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB GetAll Error:', error);
            return [];
        }
    }

    async saveStickerAsset(item: StickerAssetItem): Promise<string> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STICKER_ASSET_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STICKER_ASSET_STORE_NAME);
                const request = store.put(item);

                request.onsuccess = () => resolve(item.id);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB SaveStickerAsset Error:', error);
            throw error;
        }
    }

    async getStickerAsset(id: string): Promise<StickerAssetItem | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STICKER_ASSET_STORE_NAME, 'readonly');
                const store = transaction.objectStore(STICKER_ASSET_STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB GetStickerAsset Error:', error);
            return null;
        }
    }

    async removeStickerAsset(id: string): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STICKER_ASSET_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STICKER_ASSET_STORE_NAME);
                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            logger.error('DB RemoveStickerAsset Error:', error);
            throw error;
        }
    }

    async removeStickerAssets(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STICKER_ASSET_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STICKER_ASSET_STORE_NAME);

                ids.forEach(id => {
                    store.delete(id);
                });

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            logger.error('DB RemoveStickerAssets Error:', error);
            throw error;
        }
    }
}

export const db = new IndexedDBWrapper();
