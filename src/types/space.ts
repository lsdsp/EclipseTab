/**
 * Space 相关类型定义
 * Focus Spaces 多空间系统的核心数据模型
 */

import { DockItem } from './dock';

/**
 * 单个空间定义
 */
export interface Space {
    /** 唯一标识符 (UUID) */
    id: string;

    /** 显示名称，建议大写英文如 WORK, LIFE, GAME */
    name: string;

    /** 图标类型: 纯文本取首字母 | emoji | 自定义图标 */
    iconType: 'text' | 'emoji' | 'icon';

    /** 图标值: emoji 字符或图标名称 (iconType 为 text 时可选) */
    iconValue?: string;

    /** 该空间下的应用/文件夹列表 */
    apps: DockItem[];

    /** 创建时间戳 (ms) */
    createdAt: number;
}

/**
 * 空间持久化状态
 */
export interface SpacesState {
    /** 空间列表 */
    spaces: Space[];

    /** 当前激活空间 ID */
    activeSpaceId: string;

    /** 数据版本号，用于迁移 */
    version: number;
}

/**
 * 创建默认空间
 */
export function createDefaultSpace(name: string = 'MAIN', apps: DockItem[] = []): Space {
    return {
        id: crypto.randomUUID(),
        name,
        iconType: 'text',
        apps,
        createdAt: Date.now(),
    };
}

/**
 * 创建默认空间状态
 */
export function createDefaultSpacesState(initialApps: DockItem[] = []): SpacesState {
    const defaultSpace = createDefaultSpace('MAIN', initialApps);
    return {
        spaces: [defaultSpace],
        activeSpaceId: defaultSpace.id,
        version: 1,
    };
}
