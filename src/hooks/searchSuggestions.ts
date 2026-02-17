interface SuggestionApiConfig {
    buildUrl: (query: string) => string;
    parseResponse: (data: unknown) => string[];
    headers?: Record<string, string>;
}

export interface FetchSuggestionsOptions {
    signal?: AbortSignal;
    allowWithoutExtensionPermission?: boolean;
    fetchImpl?: typeof fetch;
    hasGooglePermission?: () => Promise<boolean>;
}

const GOOGLE_PERMISSION_ORIGIN = 'https://suggestqueries.google.com/*';

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

export const checkGoogleSuggestionPermission = async (): Promise<boolean> => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.permissions?.contains) {
        return false;
    }

    try {
        const hasPermission = await new Promise<boolean>((resolve) => {
            chromeApi.permissions?.contains({ origins: [GOOGLE_PERMISSION_ORIGIN] }, (result) => {
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
): Promise<string[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const {
        signal,
        allowWithoutExtensionPermission = false,
        fetchImpl = fetch,
        hasGooglePermission = checkGoogleSuggestionPermission,
    } = options;

    const permissionApiAvailable = hasExtensionPermissionApi();
    if (permissionApiAvailable) {
        const hasPermission = await hasGooglePermission();
        if (!hasPermission) {
            return [];
        }
    } else if (!allowWithoutExtensionPermission) {
        return [];
    }

    try {
        const googleSuggestions = await requestSuggestions(
            trimmedQuery,
            SUGGESTION_API.google,
            fetchImpl,
            signal
        );
        if (googleSuggestions.length > 0) {
            return googleSuggestions;
        }
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
    }

    try {
        return await requestSuggestions(trimmedQuery, SUGGESTION_API.baidu, fetchImpl, signal);
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
    }

    return [];
}
