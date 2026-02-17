interface SuggestionApiConfig {
    buildUrl: (query: string) => string;
    parseResponse: (data: unknown) => string[];
    headers?: Record<string, string>;
}

export type SuggestionPermissionStatus = 'granted' | 'missing' | 'unavailable';

export interface FetchSuggestionsOptions {
    signal?: AbortSignal;
    allowWithoutExtensionPermission?: boolean;
    fetchImpl?: typeof fetch;
    hasPermissionForOrigin?: (origin: string) => Promise<boolean>;
}

export interface SuggestionFetchResult {
    suggestions: string[];
    permissionStatus: SuggestionPermissionStatus;
}

const GOOGLE_PERMISSION_ORIGIN = 'https://suggestqueries.google.com/*';
const BAIDU_PERMISSION_ORIGIN = 'https://suggestion.baidu.com/*';

export const SUGGESTION_PERMISSION_REQUEST_ORIGINS = [
    GOOGLE_PERMISSION_ORIGIN,
    'https://www.google.com/*',
    BAIDU_PERMISSION_ORIGIN,
] as const;

const SUGGESTION_API: Record<'google' | 'baidu', SuggestionApiConfig> = {
    google: {
        buildUrl: (query: string) =>
            `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`,
        parseResponse: (data: unknown): string[] => {
            if (Array.isArray(data) && Array.isArray(data[1])) {
                return data[1] as string[];
            }
            return [];
        },
        headers: {
            Accept: 'application/json',
        },
    },
    baidu: {
        buildUrl: (query: string) =>
            `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&action=opensearch`,
        parseResponse: (data: unknown): string[] => {
            if (Array.isArray(data) && Array.isArray(data[1])) {
                return data[1] as string[];
            }
            return [];
        },
    },
};

type ChromeLike = {
    permissions?: {
        contains: (
            permissions: { origins: string[] },
            callback: (result: boolean) => void
        ) => void;
        request?: (
            permissions: { origins: string[] },
            callback: (result: boolean) => void
        ) => void;
    };
    runtime?: {
        lastError?: unknown;
    };
};

const getChromeApi = (): ChromeLike | undefined => {
    if (typeof chrome === 'undefined') return undefined;
    return chrome as ChromeLike;
};

export const isAbortError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    return (error as { name?: string }).name === 'AbortError';
};

export const hasExtensionPermissionApi = (): boolean => {
    const chromeApi = getChromeApi();
    return Boolean(chromeApi?.permissions?.contains);
};

export const checkSuggestionPermissionForOrigin = async (origin: string): Promise<boolean> => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.permissions?.contains) {
        return false;
    }

    try {
        const hasPermission = await new Promise<boolean>((resolve) => {
            chromeApi.permissions?.contains({ origins: [origin] }, (result) => {
                if (chromeApi.runtime?.lastError) {
                    resolve(false);
                    return;
                }
                resolve(Boolean(result));
            });
        });

        return hasPermission;
    } catch {
        return false;
    }
};

export const requestSuggestionPermissions = async (): Promise<boolean> => {
    const chromeApi = getChromeApi();
    const requestPermissionApi = chromeApi?.permissions?.request;
    if (!requestPermissionApi) {
        return false;
    }

    try {
        const granted = await new Promise<boolean>((resolve) => {
            requestPermissionApi(
                { origins: [...SUGGESTION_PERMISSION_REQUEST_ORIGINS] },
                (result) => {
                    if (chromeApi.runtime?.lastError) {
                        resolve(false);
                        return;
                    }
                    resolve(Boolean(result));
                }
            );
        });

        return granted;
    } catch {
        return false;
    }
};

const requestSuggestions = async (
    query: string,
    api: SuggestionApiConfig,
    fetchImpl: typeof fetch,
    signal?: AbortSignal
): Promise<string[]> => {
    const response = await fetchImpl(api.buildUrl(query), {
        method: 'GET',
        headers: api.headers,
        signal,
    });

    if (!response.ok) {
        return [];
    }

    const data = await response.json();
    return api.parseResponse(data);
};

export async function fetchSuggestions(
    query: string,
    options: FetchSuggestionsOptions = {}
): Promise<SuggestionFetchResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return { suggestions: [], permissionStatus: 'granted' };
    }

    const {
        signal,
        allowWithoutExtensionPermission = false,
        fetchImpl = fetch,
        hasPermissionForOrigin = checkSuggestionPermissionForOrigin,
    } = options;

    let canUseGoogle = true;
    let canUseBaidu = true;
    let permissionStatus: SuggestionPermissionStatus = 'granted';

    const permissionApiAvailable = hasExtensionPermissionApi();
    if (permissionApiAvailable) {
        const [hasGooglePermission, hasBaiduPermission] = await Promise.all([
            hasPermissionForOrigin(GOOGLE_PERMISSION_ORIGIN),
            hasPermissionForOrigin(BAIDU_PERMISSION_ORIGIN),
        ]);
        canUseGoogle = hasGooglePermission;
        canUseBaidu = hasBaiduPermission;

        if (!canUseGoogle && !canUseBaidu) {
            return { suggestions: [], permissionStatus: 'missing' };
        }
    } else if (!allowWithoutExtensionPermission) {
        return { suggestions: [], permissionStatus: 'unavailable' };
    }

    if (canUseGoogle) {
        try {
            const googleSuggestions = await requestSuggestions(
                trimmedQuery,
                SUGGESTION_API.google,
                fetchImpl,
                signal
            );
            if (googleSuggestions.length > 0) {
                return { suggestions: googleSuggestions, permissionStatus };
            }
        } catch (error) {
            if (isAbortError(error)) {
                throw error;
            }
        }
    }

    if (canUseBaidu) {
        try {
            const baiduSuggestions = await requestSuggestions(
                trimmedQuery,
                SUGGESTION_API.baidu,
                fetchImpl,
                signal
            );
            return { suggestions: baiduSuggestions, permissionStatus };
        } catch (error) {
            if (isAbortError(error)) {
                throw error;
            }
        }
    }

    return { suggestions: [], permissionStatus };
}
