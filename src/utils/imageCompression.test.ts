import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressIcon } from './imageCompression';

const ICON_URL = 'https://example.com/icon.png';

describe('compressIcon', () => {
  const originalImage = (globalThis as { Image?: unknown }).Image;

  beforeEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'Image');
  });

  afterEach(() => {
    if (originalImage === undefined) {
      Reflect.deleteProperty(globalThis, 'Image');
      return;
    }
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: originalImage,
    });
  });

  it('converts http icon URL into data URL before compression', async () => {
    const imageBlob = new Blob(['fake-image'], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(imageBlob),
    });
    const blobToDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,ZmFrZQ==');

    const result = await compressIcon(ICON_URL, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      blobToDataUrl,
    });

    expect(fetchMock).toHaveBeenCalledWith(ICON_URL);
    expect(blobToDataUrl).toHaveBeenCalledWith(imageBlob);
    expect(result).toBe('data:image/png;base64,ZmFrZQ==');
  });

  it('returns original URL when icon fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      blob: vi.fn(),
    });

    const result = await compressIcon(ICON_URL, {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toBe(ICON_URL);
  });

  it('returns original source for non-image URL response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['not-image'], { type: 'text/plain' })),
    });

    const result = await compressIcon(ICON_URL, {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toBe(ICON_URL);
  });

  it('keeps non-url/non-data values unchanged', async () => {
    await expect(compressIcon('icon-name')).resolves.toBe('icon-name');
  });
});
