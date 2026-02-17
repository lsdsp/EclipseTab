import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DockItem } from '../types';
import { compressIcon, compressIconsInItemsSequential } from './imageCompression';

const ICON_URL = 'https://example.com/icon.png';
const ORIGINAL_DATA_URL = `data:image/png;base64,${'x'.repeat(200)}`;

describe('compressIcon', () => {
  const originalImage = (globalThis as { Image?: unknown }).Image;
  const originalOffscreenCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
  const originalFileReader = (globalThis as { FileReader?: unknown }).FileReader;
  const originalDocument = (globalThis as { document?: unknown }).document;

  beforeEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'Image');
    Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
    Reflect.deleteProperty(globalThis, 'FileReader');
  });

  afterEach(() => {
    if (originalDocument !== undefined) {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: originalDocument,
      });
    } else {
      Reflect.deleteProperty(globalThis, 'document');
    }

    if (originalImage === undefined) {
      Reflect.deleteProperty(globalThis, 'Image');
    } else {
      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        writable: true,
        value: originalImage,
      });
    }

    if (originalOffscreenCanvas === undefined) {
      Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
    } else {
      Object.defineProperty(globalThis, 'OffscreenCanvas', {
        configurable: true,
        writable: true,
        value: originalOffscreenCanvas,
      });
    }

    if (originalFileReader === undefined) {
      Reflect.deleteProperty(globalThis, 'FileReader');
    } else {
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
    }
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

  it('uses OffscreenCanvas convertToBlob path without document dependency', async () => {
    const offscreenInstances: Array<{ convertToBlob: unknown }> = [];

    class MockOffscreenCanvas {
      width: number;
      height: number;
      convertToBlob = vi.fn(async () => new Blob(['ok'], { type: 'image/webp' }));

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        offscreenInstances.push({ convertToBlob: this.convertToBlob });
      }

      getContext() {
        return {
          clearRect: vi.fn(),
          drawImage: vi.fn(),
        };
      }
    }

    class MockImage {
      width = 180;
      height = 180;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(_blob: Blob) {
        this.result = 'data:image/webp;base64,AA';
        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      writable: true,
      value: MockOffscreenCanvas,
    });
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });
    Reflect.deleteProperty(globalThis, 'document');

    const result = await compressIcon(ORIGINAL_DATA_URL);

    expect(offscreenInstances.length).toBeGreaterThan(0);
    expect(offscreenInstances[0].convertToBlob as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(result).toBe('data:image/webp;base64,AA');
  });
});

describe('compressIconsInItemsSequential', () => {
  it('compresses icons serially to avoid concurrent canvas writes', async () => {
    const sourceItems: DockItem[] = [
      { id: '1', name: 'One', type: 'app', icon: 'icon-1' },
      {
        id: 'folder-1',
        name: 'Folder',
        type: 'folder',
        icon: 'icon-folder',
        items: [{ id: '2', name: 'Two', type: 'app', icon: 'icon-2' }],
      },
    ];

    let inFlight = 0;
    let maxInFlight = 0;
    const compressFn = vi.fn(async (iconSource: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return `${iconSource}-compressed`;
    });

    const result = await compressIconsInItemsSequential(sourceItems, compressFn);

    expect(maxInFlight).toBe(1);
    expect(compressFn).toHaveBeenCalledTimes(3);
    expect(result[0].icon).toBe('icon-1-compressed');
    expect(result[1].icon).toBe('icon-folder-compressed');
    expect(result[1].type).toBe('folder');
    expect((result[1].type === 'folder' ? result[1].items?.[0].icon : '')).toBe(
      'icon-2-compressed'
    );
  });
});
