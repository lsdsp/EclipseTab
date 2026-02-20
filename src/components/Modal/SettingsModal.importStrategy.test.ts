import { describe, expect, it, vi } from 'vitest';
import { promptImportStrategy } from './SettingsModal';

describe('promptImportStrategy', () => {
  it('returns merge when first prompt confirmed', () => {
    const confirmFn = vi.fn(() => true);

    const result = promptImportStrategy('zh', confirmFn);

    expect(result).toBe('merge');
    expect(confirmFn).toHaveBeenCalledTimes(1);
  });

  it('returns overwrite when merge declined and overwrite confirmed', () => {
    const confirmFn = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const result = promptImportStrategy('en', confirmFn);

    expect(result).toBe('overwrite');
    expect(confirmFn).toHaveBeenCalledTimes(2);
  });

  it('returns null when both prompts declined', () => {
    const confirmFn = vi.fn(() => false);

    const result = promptImportStrategy('zh', confirmFn);

    expect(result).toBeNull();
    expect(confirmFn).toHaveBeenCalledTimes(2);
  });
});
