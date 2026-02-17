import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSuggestions, isAbortError } from './searchSuggestions';

interface UseSearchSuggestionsResult {
    suggestions: string[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * 搜索建议 Hook
 * 使用 fetch API 获取搜索建议（需要浏览器扩展权限）
 * 
 * 特性:
 * - 300ms 防抖
 * - 竞态条件处理
 * - Google/百度 API 自动降级
 */
export function useSearchSuggestions(query: string): UseSearchSuggestionsResult {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const latestRequestRef = useRef<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchWithDebounce = useCallback(async (searchQuery: string) => {
        const trimmedQuery = searchQuery.trim();

        // 如果查询内容为空，清空建议列表
        if (!trimmedQuery) {
            setSuggestions([]);
            setError(null);
            latestRequestRef.current = `cleared_${Date.now()}`;
            return;
        }

        // 跟踪当前请求以处理竞态条件
        const currentRequestId = `req_${Date.now()}`;
        latestRequestRef.current = currentRequestId;

        // 如果存在之前的请求，则将其取消
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        setError(null);

        try {
            const results = await fetchSuggestions(trimmedQuery, {
                signal: abortControllerRef.current.signal,
                // 开发环境允许在无扩展权限 API 时获取建议，便于本地调试
                allowWithoutExtensionPermission: import.meta.env.DEV,
            });

            // 仅当这仍然是最新请求时才更新状态
            if (latestRequestRef.current === currentRequestId) {
                // Limit to 10 suggestions
                setSuggestions(results.slice(0, 10));
            }
        } catch (err) {
            if (isAbortError(err)) {
                return;
            }
            if (latestRequestRef.current === currentRequestId) {
                setError(err instanceof Error ? err : new Error('Failed to fetch suggestions'));
                setSuggestions([]);
            }
        } finally {
            if (latestRequestRef.current === currentRequestId) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        // Debounce: 300ms
        const timerId = setTimeout(() => {
            fetchWithDebounce(query);
        }, 300);

        return () => {
            clearTimeout(timerId);
        };
    }, [query, fetchWithDebounce]);

    // 卸载时清理
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return { suggestions, isLoading, error };
}
