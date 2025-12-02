/**
 * A lightweight JSONP utility for cross-origin requests.
 * @param url The base URL for the request.
 * @param params Query parameters to append to the URL.
 * @param callbackKey The name of the query parameter that specifies the callback function name (default: 'callback').
 * @returns A promise that resolves with the response data.
 */
export function jsonp<T>(
    url: string,
    params: Record<string, string | number>,
    callbackKey: string = 'callback'
): Promise<T> {
    return new Promise((resolve, reject) => {
        // Generate a unique callback name
        const callbackName = `jsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

        // Create the script element
        const script = document.createElement('script');

        // Construct the full URL
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            queryParams.append(key, String(value));
        });
        queryParams.append(callbackKey, callbackName);

        script.src = `${url}?${queryParams.toString()}`;
        script.async = true;

        // Define the global callback function
        (window as any)[callbackName] = (data: T) => {
            cleanup();
            resolve(data);
        };

        // Error handling
        script.onerror = () => {
            cleanup();
            reject(new Error(`JSONP request to ${url} failed`));
        };

        // Cleanup function
        const cleanup = () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            delete (window as any)[callbackName];
        };

        // Append script to document to trigger request
        document.body.appendChild(script);
    });
}
