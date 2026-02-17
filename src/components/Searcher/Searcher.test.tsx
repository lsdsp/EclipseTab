// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { LanguageProvider } from '../../context/LanguageContext';
import { Searcher } from './Searcher';

const mockUseSearchSuggestions = vi.hoisted(() => ({
  requestPermission: vi.fn(async () => true),
}));

vi.mock('../../hooks/useSearchSuggestions', () => ({
  useSearchSuggestions: () => ({
    suggestions: [],
    isLoading: false,
    error: null,
    permissionStatus: 'granted' as const,
    requestPermission: mockUseSearchSuggestions.requestPermission,
  }),
}));

describe('Searcher', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockUseSearchSuggestions.requestPermission.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const renderSearcher = (onSearch: (query: string) => void) => {
    act(() => {
      root.render(
        <LanguageProvider>
          <Searcher
            searchEngine={{ id: 'google', name: 'Google', url: 'https://google.com/search?q=%s' }}
            onSearch={onSearch}
            onSearchEngineClick={() => undefined}
          />
        </LanguageProvider>
      );
    });
  };

  it('submits search query through semantic form submit button', async () => {
    const onSearch = vi.fn();
    renderSearcher(onSearch);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, 'hello world');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const searchForm = container.querySelector('form') as HTMLFormElement;
    expect(searchForm).toBeTruthy();

    await act(async () => {
      searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSearch).toHaveBeenCalledWith('hello world');
  });

  it('clears pending blur timeout on unmount', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const onSearch = vi.fn();
    renderSearcher(onSearch);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      input.focus();
      input.blur();
    });

    act(() => {
      root.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
