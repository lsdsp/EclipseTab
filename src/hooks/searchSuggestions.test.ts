import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSuggestions, requestSuggestionPermissions } from './searchSuggestions';

const createJsonResponse = (data: unknown, ok: boolean = true): Response => {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
};

describe('fetchSuggestions', () => {
  const originalChromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'chrome');

  const setChrome = (value: unknown) => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      writable: true,
      value,
    });
  };

  const restoreChrome = () => {
    if (originalChromeDescriptor) {
      Object.defineProperty(globalThis, 'chrome', originalChromeDescriptor);
      return;
    }
    Reflect.deleteProperty(globalThis, 'chrome');
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  afterEach(() => {
    restoreChrome();
  });

  it('passes AbortSignal to fetch and uses Google suggestions first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createJsonResponse(['hello', ['hello world', 'hello kitty']]));
    const controller = new AbortController();

    const result = await fetchSuggestions('hello', {
      signal: controller.signal,
      allowWithoutExtensionPermission: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      suggestions: ['hello world', 'hello kitty'],
      permissionStatus: 'granted',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('falls back to Baidu when Google returns no suggestions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(['hello', []]))
      .mockResolvedValueOnce(createJsonResponse(['hello', ['hello from baidu']]));

    const result = await fetchSuggestions('hello', {
      allowWithoutExtensionPermission: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      suggestions: ['hello from baidu'],
      permissionStatus: 'granted',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('suggestqueries.google.com');
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain('suggestion.baidu.com');
  });

  it('uses Baidu directly when Google permission is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(['hello', ['hello from baidu']]));
    const hasPermissionForOrigin = vi.fn(async (origin: string) => origin.includes('baidu'));
    setChrome({
      permissions: {
        contains: (_permissions: { origins: string[] }, callback: (result: boolean) => void) =>
          callback(true),
      },
      runtime: {},
    });

    const result = await fetchSuggestions('hello', {
      fetchImpl: fetchMock as unknown as typeof fetch,
      hasPermissionForOrigin,
    });

    expect(result).toEqual({
      suggestions: ['hello from baidu'],
      permissionStatus: 'granted',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('suggestion.baidu.com');
  });

  it('returns missing permission status when both suggestion origins are denied', async () => {
    const fetchMock = vi.fn();
    const chromeMock = {
      permissions: {
        contains: (_permissions: { origins: string[] }, callback: (result: boolean) => void) =>
          callback(false),
      },
      runtime: {},
    };
    setChrome(chromeMock);

    const result = await fetchSuggestions('hello', {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      permissionStatus: 'missing',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns unavailable permission status when extension permissions API is absent', async () => {
    const fetchMock = vi.fn();

    const result = await fetchSuggestions('hello', {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      suggestions: [],
      permissionStatus: 'unavailable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rethrows AbortError and does not continue fallback requests', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    await expect(
      fetchSuggestions('hello', {
        allowWithoutExtensionPermission: true,
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests optional host permissions when API is available', async () => {
    const chromeMock = {
      permissions: {
        request: (_permissions: { origins: string[] }, callback: (result: boolean) => void) =>
          callback(true),
      },
      runtime: {},
    };
    setChrome(chromeMock);

    await expect(requestSuggestionPermissions()).resolves.toBe(true);
  });

  it('returns false when permission request API is unavailable', async () => {
    await expect(requestSuggestionPermissions()).resolves.toBe(false);
  });
});
