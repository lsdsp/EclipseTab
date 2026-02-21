import { describe, expect, it, vi } from 'vitest';
import { syncStickerStrokeColor } from './useStickerStrokeSync';

describe('syncStickerStrokeColor', () => {
  it('syncs css variable value to sticker stroke filter', () => {
    const setAttribute = vi.fn();
    const querySelector = vi.fn(() => ({ setAttribute }));
    const getComputedStyle = vi.fn(() => ({
      getPropertyValue: () => ' #123456 ',
    }));

    const doc = {
      documentElement: {},
      querySelector,
      defaultView: {
        getComputedStyle,
      },
    } as unknown as Document;

    syncStickerStrokeColor(doc);

    expect(getComputedStyle).toHaveBeenCalled();
    expect(querySelector).toHaveBeenCalledWith('#text-sticker-stroke feFlood');
    expect(setAttribute).toHaveBeenCalledWith('flood-color', '#123456');
  });
});

