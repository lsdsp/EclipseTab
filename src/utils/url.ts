/**
 * URL 处理工具函数
 */

type OpenUrlProtocol = 'http:' | 'https:' | 'chrome-extension:' | 'moz-extension:';

interface OpenUrlDependencies {
    openWindow: (url?: string | URL, target?: string, features?: string) => Window | null;
    assignLocation: (url: string | URL) => void;
}

export interface OpenUrlOptions {
    openInNewTab: boolean;
    allowedProtocols?: OpenUrlProtocol[];
    dependencies?: Partial<OpenUrlDependencies>;
}

const DEFAULT_ALLOWED_PROTOCOLS: OpenUrlProtocol[] = ['http:', 'https:', 'chrome-extension:', 'moz-extension:'];

const getAllowedProtocolSet = (allowedProtocols?: OpenUrlProtocol[]): Set<OpenUrlProtocol> =>
    new Set((allowedProtocols && allowedProtocols.length > 0 ? allowedProtocols : DEFAULT_ALLOWED_PROTOCOLS));

/**
 * 规范化 URL
 * 如果 URL 缺少协议，默认添加 https://
 * 如果已有协议，保持不变
 */
export const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    // 如果以 http://, https://, 或 // 开头，则按原样返回
    if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
    // 否则假设为 https://
    return `https://${trimmed}`;
};

/**
 * 检查字符串是否为有效 URL
 */
export const isValidUrl = (input: string): boolean => {
    try {
        new URL(normalizeUrl(input));
        return true;
    } catch {
        return false;
    }
};

/**
 * 从 URL 中提取域名
 */
export const getDomainFromUrl = (input: string): string => {
    try {
        const url = new URL(normalizeUrl(input));
        return url.hostname;
    } catch {
        return '';
    }
};

/**
 * 校验 URL 协议是否允许导航
 */
export const getSafeNavigableUrl = (
    input: string,
    allowedProtocols?: OpenUrlProtocol[]
): string | null => {
    try {
        const normalized = normalizeUrl(input);
        if (!normalized) return null;
        const url = new URL(normalized);
        const protocol = url.protocol.toLowerCase() as OpenUrlProtocol;
        if (!getAllowedProtocolSet(allowedProtocols).has(protocol)) {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
};

/**
 * 统一打开 URL（协议白名单 + noopener/noreferrer + 新标签页策略）
 */
export const openUrl = (input: string, options: OpenUrlOptions): boolean => {
    const safeUrl = getSafeNavigableUrl(input, options.allowedProtocols);
    if (!safeUrl) return false;

    const openWindow = options.dependencies?.openWindow ?? ((url?: string | URL, target?: string, features?: string) =>
        window.open(url, target, features));
    const assignLocation = options.dependencies?.assignLocation ?? ((url: string | URL) =>
        window.location.assign(url));

    if (options.openInNewTab) {
        const popup = openWindow(safeUrl, '_blank', 'noopener,noreferrer');
        if (popup) {
            try {
                popup.opener = null;
            } catch {
                // Ignore cross-origin setter failures.
            }
        }
        return true;
    }

    assignLocation(safeUrl);
    return true;
};
