import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWebDavOriginPattern,
  downloadTextFromWebDav,
  ensureWebDavPermissionForEndpoint,
  normalizeWebDavEndpoint,
  uploadTextToWebDav,
} from './webdavSync';

describe('webdavSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('normalizes endpoint and builds permission origin pattern', () => {
    const endpoint = normalizeWebDavEndpoint(' https://dav.example.com/backup/eclipsetab.json ');
    expect(endpoint).toBe('https://dav.example.com/backup/eclipsetab.json');
    expect(buildWebDavOriginPattern(endpoint)).toBe('https://dav.example.com/*');
  });

  it('requests permission when host permission is missing', async () => {
    const contains = vi.fn((_: { origins?: string[] }, callback: (granted: boolean) => void) => callback(false));
    const request = vi.fn((_: { origins?: string[] }, callback: (granted: boolean) => void) => callback(true));
    (globalThis as { chrome?: unknown }).chrome = {
      permissions: {
        contains,
        request,
      },
      runtime: {
        lastError: undefined,
      },
    };

    const granted = await ensureWebDavPermissionForEndpoint('https://dav.example.com/backup/eclipsetab.json');

    expect(granted).toBe(true);
    expect(contains).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uploads and downloads encrypted text via basic auth', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'encrypted-payload' });
    vi.stubGlobal('fetch', fetchMock);

    await uploadTextToWebDav(
      {
        endpoint: 'https://dav.example.com/backup/eclipsetab.enc.json',
        username: 'alice',
        password: 'secret',
      },
      'payload'
    );

    const downloaded = await downloadTextFromWebDav({
      endpoint: 'https://dav.example.com/backup/eclipsetab.enc.json',
      username: 'alice',
      password: 'secret',
    });

    expect(downloaded).toBe('encrypted-payload');
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe('https://dav.example.com/backup/eclipsetab.enc.json');
    expect((firstCall?.[1] as RequestInit)?.method).toBe('PUT');
    expect(((firstCall?.[1] as RequestInit)?.headers as Record<string, string>).Authorization).toContain('Basic ');

    const secondCall = fetchMock.mock.calls[1];
    expect((secondCall?.[1] as RequestInit)?.method).toBe('GET');
  });
});

