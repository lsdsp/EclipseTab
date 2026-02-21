import { useEffect } from 'react';

const TEXT_STICKER_STROKE_SELECTOR = '#text-sticker-stroke feFlood';

export const syncStickerStrokeColor = (doc: Document): void => {
  const getComputedStyleFn = doc.defaultView?.getComputedStyle;
  if (!getComputedStyleFn) return;

  const strokeColor = getComputedStyleFn(doc.documentElement)
    .getPropertyValue('--color-sticker-stroke')
    .trim();

  const floodElement = doc.querySelector(TEXT_STICKER_STROKE_SELECTOR);
  if (floodElement && strokeColor) {
    floodElement.setAttribute('flood-color', strokeColor);
  }
};

export const useStickerStrokeSync = (): void => {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const updateStrokeColor = () => {
      syncStickerStrokeColor(document);
    };

    updateStrokeColor();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateStrokeColor();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);
};
