import { useState, useEffect, useRef } from 'react';
import { jsonp } from '../utils/jsonp';

interface BaiduSuggestionResponse {
    q: string;
    s: string[];
}

interface UseSearchSuggestionsResult {
    suggestions: string[];
    isLoading: boolean;
    error: Error | null;
}

export function useSearchSuggestions(query: string): UseSearchSuggestionsResult {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const latestRequestRef = useRef<string>('');

    useEffect(() => {
        const trimmedQuery = query.trim();

        // Clear suggestions if query is empty
        if (!trimmedQuery) {
            setSuggestions([]);
            setError(null);
            return;
        }

        // Debounce logic
        const timerId = setTimeout(() => {
            const fetchSuggestions = async () => {
                setIsLoading(true);
                setError(null);

                // Track the current request to handle race conditions
                const currentRequestId = `req_${Date.now()}`;
                latestRequestRef.current = currentRequestId;

                try {
                    // Baidu Suggest API
                    // URL: https://suggestion.baidu.com/su
                    // Params: wd (query), cb (callback)
                    const data = await jsonp<BaiduSuggestionResponse>(
                        'https://suggestion.baidu.com/su',
                        { wd: trimmedQuery },
                        'cb'
                    );

                    // Only update state if this is still the latest request
                    if (latestRequestRef.current === currentRequestId) {
                        setSuggestions(data.s || []);
                    }
                } catch (err) {
                    if (latestRequestRef.current === currentRequestId) {
                        setError(err instanceof Error ? err : new Error('Failed to fetch suggestions'));
                        setSuggestions([]);
                    }
                } finally {
                    if (latestRequestRef.current === currentRequestId) {
                        setIsLoading(false);
                    }
                }
            };

            fetchSuggestions();
        }, 300); // 300ms debounce

        return () => {
            clearTimeout(timerId);
        };
    }, [query]);

    return { suggestions, isLoading, error };
}
