import { describe, expect, it, vi } from 'vitest';
import { getSafeNavigableUrl, normalizeUrl, openUrl } from './url';

describe('url helpers', () => {
  it('normalizes url by adding https protocol when missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('returns safe url only for allowed protocols', () => {
    expect(getSafeNavigableUrl('https://example.com')).toBe('https://example.com/');
    expect(getSafeNavigableUrl('javascript:alert(1)')).toBeNull();
    expect(getSafeNavigableUrl('data:text/html,hello')).toBeNull();
  });

  it('opens url in new tab with noopener and noreferrer', () => {
    const openWindow = vi.fn(() => null);
    const assignLocation = vi.fn();

    const result = openUrl('https://example.com', {
      openInNewTab: true,
      dependencies: { openWindow, assignLocation },
    });

    expect(result).toBe(true);
    expect(openWindow).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
    expect(assignLocation).not.toHaveBeenCalled();
  });

  it('opens url in current tab when openInNewTab is false', () => {
    const openWindow = vi.fn(() => null);
    const assignLocation = vi.fn();

    const result = openUrl('https://example.com', {
      openInNewTab: false,
      dependencies: { openWindow, assignLocation },
    });

    expect(result).toBe(true);
    expect(assignLocation).toHaveBeenCalledWith('https://example.com/');
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('rejects disallowed protocol and does not navigate', () => {
    const openWindow = vi.fn(() => null);
    const assignLocation = vi.fn();

    const result = openUrl('javascript:alert(1)', {
      openInNewTab: true,
      dependencies: { openWindow, assignLocation },
    });

    expect(result).toBe(false);
    expect(openWindow).not.toHaveBeenCalled();
    expect(assignLocation).not.toHaveBeenCalled();
  });
});
