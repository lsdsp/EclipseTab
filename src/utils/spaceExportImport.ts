/**
 * Space 导入/导出工具函数
 * 处理空间的 JSON 导出和导入功能
 */

import { Space, DockItem } from '../types';
import { compressIcon, compressIconsInItems } from './imageCompression';

export const CURRENT_SPACE_EXPORT_SCHEMA_VERSION = 1;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 导出文件的 JSON 结构
 */
export interface SpaceExportData {
    version: string;
    schemaVersion?: number;
    type: 'eclipse-space-export';
    data: {
        name: string;
        iconType: Space['iconType'];
        iconValue?: string;
        apps: ExportedDockItem[];
    };
}

/**
 * 多空间导出文件的 JSON 结构
 */
export interface MultiSpaceExportData {
    version: string;
    schemaVersion?: number;
    type: 'eclipse-multi-space-export';
    data: {
        spaces: Array<{
            name: string;
            iconType: Space['iconType'];
            iconValue?: string;
            apps: ExportedDockItem[];
        }>;
    };
}

/**
 * 导出的 DockItem 结构 (不含 id，导入时重新生成)
 */
interface ExportedDockItem {
    title: string;
    url?: string;
    icon?: string;
    type: 'app' | 'folder';
    children?: ExportedDockItem[];
}

interface ShareCodePayload {
    kind: 'single' | 'multi';
    data: SpaceExportData | MultiSpaceExportData;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeSpaceName = (value: unknown): string => {
    if (typeof value !== 'string') {
        throw new Error('Invalid space name');
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Invalid space name');
    }
    return trimmed;
};

const normalizeSpaceIconType = (value: unknown): Space['iconType'] => {
    if (value === 'text' || value === 'emoji' || value === 'icon') {
        return value;
    }
    return 'text';
};

const normalizeSpaceIconValue = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
};

const sanitizeExportedDockItem = (
    input: unknown,
    path: string,
    depth: number = 0
): ExportedDockItem => {
    if (depth > 8) {
        throw new Error(`Dock tree too deep at ${path}`);
    }
    if (!isPlainObject(input)) {
        throw new Error(`Invalid dock item at ${path}`);
    }

    const titleRaw = input.title;
    if (typeof titleRaw !== 'string' || !titleRaw.trim()) {
        throw new Error(`Invalid dock item title at ${path}`);
    }

    const typeRaw = input.type;
    if (typeRaw !== 'app' && typeRaw !== 'folder') {
        throw new Error(`Invalid dock item type at ${path}`);
    }

    const item: ExportedDockItem = {
        title: titleRaw.trim(),
        type: typeRaw,
    };

    if (typeof input.url === 'string' && input.url.trim()) {
        item.url = input.url.trim();
    }
    if (typeof input.icon === 'string' && input.icon.trim()) {
        item.icon = input.icon.trim();
    }

    if (typeRaw === 'folder') {
        if (input.children !== undefined && !Array.isArray(input.children)) {
            throw new Error(`Invalid folder children at ${path}`);
        }
        const children = Array.isArray(input.children) ? input.children : [];
        item.children = children.map((child, index) =>
            sanitizeExportedDockItem(child, `${path}.children[${index}]`, depth + 1)
        );
    }

    return item;
};

const sanitizeExportedDockItems = (input: unknown, path: string): ExportedDockItem[] => {
    if (!Array.isArray(input)) {
        throw new Error(`Invalid dock item list at ${path}`);
    }
    return input.map((item, index) => sanitizeExportedDockItem(item, `${path}[${index}]`));
};

const sanitizeSingleSpaceData = (value: unknown): SpaceExportData => {
    if (!isPlainObject(value)) {
        throw new Error('Invalid file format: missing required fields');
    }
    if (value.type !== 'eclipse-space-export') {
        throw new Error('Invalid file format: missing required fields');
    }
    if (!isPlainObject(value.data)) {
        throw new Error('Invalid file format: missing required fields');
    }

    return {
        version: typeof value.version === 'string' ? value.version : '1.0',
        schemaVersion: normalizeSchemaVersion(value.schemaVersion),
        type: 'eclipse-space-export',
        data: {
            name: normalizeSpaceName(value.data.name),
            iconType: normalizeSpaceIconType(value.data.iconType),
            iconValue: normalizeSpaceIconValue(value.data.iconValue),
            apps: sanitizeExportedDockItems(value.data.apps, 'data.apps'),
        },
    };
};

const sanitizeMultiSpaceData = (value: unknown): MultiSpaceExportData => {
    if (!isPlainObject(value)) {
        throw new Error('Invalid file format: missing required fields');
    }
    if (value.type !== 'eclipse-multi-space-export') {
        throw new Error('Invalid file format: missing required fields');
    }
    if (!isPlainObject(value.data) || !Array.isArray(value.data.spaces) || value.data.spaces.length === 0) {
        throw new Error('Invalid file format: missing required fields');
    }

    return {
        version: typeof value.version === 'string' ? value.version : '1.0',
        schemaVersion: normalizeSchemaVersion(value.schemaVersion),
        type: 'eclipse-multi-space-export',
        data: {
            spaces: value.data.spaces.map((space, index) => {
                if (!isPlainObject(space)) {
                    throw new Error(`Invalid space item at data.spaces[${index}]`);
                }
                return {
                    name: normalizeSpaceName(space.name),
                    iconType: normalizeSpaceIconType(space.iconType),
                    iconValue: normalizeSpaceIconValue(space.iconValue),
                    apps: sanitizeExportedDockItems(space.apps, `data.spaces[${index}].apps`),
                };
            }),
        },
    };
};

const normalizeSchemaVersion = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(1, Math.floor(value));
    }
    return 1;
};

export const normalizeSingleSpaceImportSchema = (data: SpaceExportData): SpaceExportData => {
    const sanitized = sanitizeSingleSpaceData(data);
    const schemaVersion = normalizeSchemaVersion(sanitized.schemaVersion);
    if (schemaVersion > CURRENT_SPACE_EXPORT_SCHEMA_VERSION) {
        throw new Error(`Unsupported space import schema version: ${schemaVersion}`);
    }

    if (schemaVersion === 1) {
        return {
            ...sanitized,
            schemaVersion: 1,
        };
    }

    throw new Error(`Unsupported space import schema version: ${schemaVersion}`);
};

export const normalizeMultiSpaceImportSchema = (data: MultiSpaceExportData): MultiSpaceExportData => {
    const sanitized = sanitizeMultiSpaceData(data);
    const schemaVersion = normalizeSchemaVersion(sanitized.schemaVersion);
    if (schemaVersion > CURRENT_SPACE_EXPORT_SCHEMA_VERSION) {
        throw new Error(`Unsupported multi-space import schema version: ${schemaVersion}`);
    }

    if (schemaVersion === 1) {
        return {
            ...sanitized,
            schemaVersion: 1,
        };
    }

    throw new Error(`Unsupported multi-space import schema version: ${schemaVersion}`);
};

// ============================================================================
// 导出功能
// ============================================================================

/**
 * 将 DockItem 转换为导出格式（异步版，压缩图标）
 */
async function convertToExportItemAsync(item: DockItem): Promise<ExportedDockItem> {
    const exported: ExportedDockItem = {
        title: item.name,
        type: item.type,
    };

    if (item.url) {
        exported.url = item.url;
    }

    // 压缩图标到 500x500 WebP
    if (item.icon) {
        exported.icon = await compressIcon(item.icon);
    }

    if (item.type === 'folder' && item.items) {
        exported.children = await Promise.all(
            item.items.map(convertToExportItemAsync)
        );
    }

    return exported;
}

const toBase64Url = (value: string): string => {
    const utf8 = new TextEncoder().encode(value);
    let binary = '';
    utf8.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string): string => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

/**
 * 导出空间到 JSON 文件并触发下载
 * 导出时会压缩所有图标到 500x500 以减小文件体积
 */
export async function buildSpaceExportData(space: Space): Promise<SpaceExportData> {
    const compressedApps = await Promise.all(space.apps.map(convertToExportItemAsync));
    return {
        version: '1.0',
        schemaVersion: CURRENT_SPACE_EXPORT_SCHEMA_VERSION,
        type: 'eclipse-space-export',
        data: {
            name: space.name,
            iconType: space.iconType,
            iconValue: space.iconValue,
            apps: compressedApps,
        },
    };
}

export async function buildMultiSpaceExportData(spaces: Space[]): Promise<MultiSpaceExportData> {
    const spacesData = await Promise.all(
        spaces.map(async (space) => {
            const compressedApps = await Promise.all(
                space.apps.map(convertToExportItemAsync)
            );
            return {
                name: space.name,
                iconType: space.iconType,
                iconValue: space.iconValue,
                apps: compressedApps,
            };
        })
    );

    return {
        version: '1.0',
        schemaVersion: CURRENT_SPACE_EXPORT_SCHEMA_VERSION,
        type: 'eclipse-multi-space-export',
        data: {
            spaces: spacesData,
        },
    };
}

export async function exportSpaceToFile(space: Space): Promise<void> {
    const exportData = await buildSpaceExportData(space);

    // 序列化为 JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 生成文件名: eclipse-space-{name}-{date}.json
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeName = space.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `eclipse-space-${safeName}-${date}.json`;

    // 触发下载
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 导出所有空间到 JSON 文件并触发下载
 * 导出时会压缩所有图标到 500x500 以减小文件体积
 */
export async function exportAllSpacesToFile(spaces: Space[]): Promise<void> {
    const exportData = await buildMultiSpaceExportData(spaces);

    // 序列化为 JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 生成文件名: eclipse-all-spaces-{date}.json
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `eclipse-all-spaces-${date}.json`;

    // 触发下载
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================================================
// 导入功能
// ============================================================================

/**
 * 校验导出文件格式
 */
function validateExportData(data: unknown): data is SpaceExportData {
    try {
        sanitizeSingleSpaceData(data);
        return true;
    } catch {
        return false;
    }
}

/**
 * 校验多空间导出文件格式
 */
function validateMultiSpaceExportData(data: unknown): data is MultiSpaceExportData {
    try {
        sanitizeMultiSpaceData(data);
        return true;
    } catch {
        return false;
    }
}

/**
 * 导入文件的解析结果类型
 */
export type ImportFileResult =
    | { type: 'single'; data: SpaceExportData }
    | { type: 'multi'; data: MultiSpaceExportData };

export interface SpaceImportPreviewItem {
    originalName: string;
    finalName: string;
    appCount: number;
    renamed: boolean;
}

export interface SpaceImportPreview {
    type: 'single' | 'multi';
    incomingSpaces: number;
    selectedSpaces: number;
    totalAppItems: number;
    nameConflicts: number;
    items: SpaceImportPreviewItem[];
}

export const formatSpaceImportPreviewMessage = (
    preview: SpaceImportPreview,
    language: 'zh' | 'en',
    options?: {
        maxItems?: number;
        includeIndexList?: boolean;
    }
): string => {
    const maxItems = Math.max(1, options?.maxItems ?? 20);
    const includeIndexList = options?.includeIndexList ?? true;
    const lines: string[] = [
        language === 'zh'
            ? `将导入空间：${preview.selectedSpaces} 项（文件内共 ${preview.incomingSpaces} 项）`
            : `Spaces to import: ${preview.selectedSpaces} (total in file: ${preview.incomingSpaces})`,
        language === 'zh'
            ? `应用项总数：${preview.totalAppItems}`
            : `Total app items: ${preview.totalAppItems}`,
    ];

    if (preview.nameConflicts > 0) {
        lines.push(
            language === 'zh'
                ? `重名冲突：${preview.nameConflicts}（将自动改名）`
                : `Name conflicts: ${preview.nameConflicts} (auto-rename)`
        );
    }

    if (includeIndexList && preview.items.length > 0) {
        lines.push(language === 'zh' ? '空间列表：' : 'Space list:');
        preview.items.slice(0, maxItems).forEach((item, index) => {
            const suffix =
                language === 'zh'
                    ? `（应用 ${item.appCount}）`
                    : ` (${item.appCount} apps)`;
            const label = item.renamed
                ? `${item.originalName} -> ${item.finalName}`
                : item.finalName;
            lines.push(`[${index + 1}] ${label}${suffix}`);
        });
        if (preview.items.length > maxItems) {
            const remaining = preview.items.length - maxItems;
            lines.push(
                language === 'zh'
                    ? `... 还有 ${remaining} 项`
                    : `... ${remaining} more`
            );
        }
    }

    return lines.join('\n');
};

export const encodeSpaceShareCode = (result: ImportFileResult): string => {
    const payload: ShareCodePayload =
        result.type === 'single'
            ? { kind: 'single', data: result.data }
            : { kind: 'multi', data: result.data };
    return toBase64Url(JSON.stringify(payload));
};

export const decodeSpaceShareCode = (shareCode: string): ImportFileResult => {
    try {
        const parsed = JSON.parse(fromBase64Url(shareCode.trim())) as ShareCodePayload;
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid share code payload');
        }

        if (parsed.kind === 'single' && validateExportData(parsed.data)) {
            return { type: 'single', data: normalizeSingleSpaceImportSchema(parsed.data) };
        }

        if (parsed.kind === 'multi' && validateMultiSpaceExportData(parsed.data)) {
            return { type: 'multi', data: normalizeMultiSpaceImportSchema(parsed.data) };
        }

        throw new Error('Invalid share code data');
    } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Invalid share code');
    }
};

const countExportedItems = (items: ExportedDockItem[]): number =>
    items.reduce((count, item) => {
        const childCount = item.children ? countExportedItems(item.children) : 0;
        return count + 1 + childCount;
    }, 0);

export const parseSpaceImportSelectionInput = (input: string, max: number): number[] => {
    const trimmed = input.trim();
    if (!trimmed) {
        return [];
    }
    const tokens = trimmed.split(/[,\s，]+/).filter(Boolean);
    if (tokens.length === 0) {
        return [];
    }

    const indices = new Set<number>();
    tokens.forEach((token) => {
        const rangeMatch = token.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);
            if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
                throw new Error(`Invalid selection token: ${token}`);
            }
            for (let value = start; value <= end; value += 1) {
                if (value < 1 || value > max) {
                    throw new Error(`Selection out of range: ${value}`);
                }
                indices.add(value - 1);
            }
            return;
        }

        const single = Number(token);
        if (!Number.isInteger(single)) {
            throw new Error(`Invalid selection token: ${token}`);
        }
        if (single < 1 || single > max) {
            throw new Error(`Selection out of range: ${single}`);
        }
        indices.add(single - 1);
    });

    return Array.from(indices).sort((left, right) => left - right);
};

export const pickMultiSpaceImportData = (
    data: MultiSpaceExportData,
    selectedIndexes: number[]
): MultiSpaceExportData => {
    const source = data.data.spaces;
    const picked = selectedIndexes
        .filter((index) => index >= 0 && index < source.length)
        .map((index) => source[index]);
    if (picked.length === 0) {
        throw new Error('No spaces selected');
    }

    return {
        ...data,
        data: {
            ...data.data,
            spaces: picked,
        },
    };
};

export const buildSpaceImportPreview = (
    result: ImportFileResult,
    existingSpaces: Space[]
): SpaceImportPreview => {
    const sourceSpaces =
        result.type === 'single'
            ? [result.data.data]
            : result.data.data.spaces;

    const existingNames = existingSpaces.map((space) => space.name);
    const nextNames = [...existingNames];
    const items: SpaceImportPreviewItem[] = sourceSpaces.map((space) => {
        const finalName = generateUniqueName(space.name, nextNames);
        nextNames.push(finalName);
        const renamed = finalName !== space.name;
        return {
            originalName: space.name,
            finalName,
            appCount: countExportedItems(space.apps),
            renamed,
        };
    });

    return {
        type: result.type,
        incomingSpaces: result.type === 'single' ? 1 : result.data.data.spaces.length,
        selectedSpaces: sourceSpaces.length,
        totalAppItems: items.reduce((sum, item) => sum + item.appCount, 0),
        nameConflicts: items.filter((item) => item.renamed).length,
        items,
    };
};

/**
 * 解析并验证导入文件（支持单空间和多空间格式）
 */
export async function parseAndValidateImportFile(file: File): Promise<ImportFileResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);

                // 尝试验证多空间格式
                if (validateMultiSpaceExportData(data)) {
                    resolve({ type: 'multi', data: normalizeMultiSpaceImportSchema(data) });
                    return;
                }

                // 尝试验证单空间格式
                if (validateExportData(data)) {
                    resolve({ type: 'single', data: normalizeSingleSpaceImportSchema(data) });
                    return;
                }

                reject(new Error('Invalid file format: missing required fields'));
            } catch (error) {
                if (error instanceof SyntaxError) {
                    reject(new Error('Invalid JSON file'));
                    return;
                }
                reject(error instanceof Error ? error : new Error('Invalid file'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * 解析并验证导入文件
 */
export async function parseAndValidateSpaceFile(file: File): Promise<SpaceExportData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);

                if (!validateExportData(data)) {
                    reject(new Error('Invalid file format: missing required fields'));
                    return;
                }

                resolve(normalizeSingleSpaceImportSchema(data));
            } catch (error) {
                if (error instanceof SyntaxError) {
                    reject(new Error('Invalid JSON file'));
                    return;
                }
                reject(error instanceof Error ? error : new Error('Invalid file'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}


/**
 * 将导出的 DockItem 转换回内部格式，生成新 ID
 */
function convertFromExportItem(item: ExportedDockItem): DockItem {
    const dockItem: DockItem = {
        id: crypto.randomUUID(),
        name: item.title,
        type: item.type,
    };

    if (item.url) {
        dockItem.url = item.url;
    }

    if (item.icon) {
        dockItem.icon = item.icon;
    }

    if (item.type === 'folder' && item.children) {
        dockItem.items = item.children.map(convertFromExportItem);
    }

    return dockItem;
}

/**
 * 生成不重复的空间名称
 */
function generateUniqueName(baseName: string, existingNames: string[]): string {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }

    let counter = 1;
    let newName = `${baseName} (${counter})`;

    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} (${counter})`;
    }

    return newName;
}

/**
 * 从导入数据创建新的 Space 对象
 * 导入时会压缩所有图标到 500x500 以减少存储占用
 */
export async function createSpaceFromImport(
    data: SpaceExportData,
    existingSpaces: Space[]
): Promise<Space> {
    const existingNames = existingSpaces.map(s => s.name);
    const uniqueName = generateUniqueName(data.data.name, existingNames);

    // 转换并压缩图标
    const convertedApps = data.data.apps.map(convertFromExportItem);
    const compressedApps = await compressIconsInItems(convertedApps);

    return {
        id: crypto.randomUUID(),
        name: uniqueName,
        iconType: data.data.iconType || 'text',
        iconValue: data.data.iconValue,
        apps: compressedApps,
        createdAt: Date.now(),
    };
}

/**
 * 从多空间导入数据创建多个 Space 对象
 * 导入时会压缩所有图标到 500x500 以减少存储占用
 */
export async function createSpacesFromMultiImport(
    data: MultiSpaceExportData,
    existingSpaces: Space[]
): Promise<Space[]> {
    const existingNames = existingSpaces.map(s => s.name);
    const newSpaces: Space[] = [];

    for (const spaceData of data.data.spaces) {
        // 生成唯一名称（考虑已存在的空间和本次导入中已创建的空间）
        const allExistingNames = [...existingNames, ...newSpaces.map(s => s.name)];
        const uniqueName = generateUniqueName(spaceData.name, allExistingNames);

        // 转换并压缩图标
        const convertedApps = spaceData.apps.map(convertFromExportItem);
        const compressedApps = await compressIconsInItems(convertedApps);

        newSpaces.push({
            id: crypto.randomUUID(),
            name: uniqueName,
            iconType: spaceData.iconType || 'text',
            iconValue: spaceData.iconValue,
            apps: compressedApps,
            createdAt: Date.now(),
        });
    }

    return newSpaces;
}

