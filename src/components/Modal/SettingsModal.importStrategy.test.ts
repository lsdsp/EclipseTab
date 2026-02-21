import { describe, expect, it, vi } from 'vitest';
import { promptImportStrategy, promptMergeConflictPolicy } from './SettingsModal';

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

describe('promptMergeConflictPolicy', () => {
  it('uses default keep-both policy when user confirms recommended handling', () => {
    const confirmFn = vi.fn(() => true);

    const policy = promptMergeConflictPolicy(
      'zh',
      {
        spaceNameConflicts: ['Main'],
        searchEngineIdConflicts: [],
        searchEngineUrlConflicts: [],
      },
      confirmFn
    );

    expect(policy).toEqual({
      spaceName: 'keepBoth',
      searchEngine: 'keepLocal',
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
  });

  it('switches to keep-local for space and keep-remote for search engines when both prompts are declined', () => {
    const confirmFn = vi.fn(() => false);

    const policy = promptMergeConflictPolicy(
      'en',
      {
        spaceNameConflicts: ['Main', 'Work'],
        searchEngineIdConflicts: ['google'],
        searchEngineUrlConflicts: [],
      },
      confirmFn
    );

    expect(policy).toEqual({
      spaceName: 'keepLocal',
      searchEngine: 'keepRemote',
    });
    expect(confirmFn).toHaveBeenCalledTimes(2);
  });

  it('prompts for search conflicts even when no space conflicts exist', () => {
    const confirmFn = vi.fn(() => false);

    const policy = promptMergeConflictPolicy(
      'zh',
      {
        spaceNameConflicts: [],
        searchEngineIdConflicts: ['google'],
        searchEngineUrlConflicts: [],
      },
      confirmFn
    );

    expect(policy).toEqual({
      spaceName: 'keepBoth',
      searchEngine: 'keepRemote',
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
  });
});
