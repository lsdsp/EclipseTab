// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { LanguageProvider } from '../../context/LanguageContext';
import { Searcher } from './Searcher';
import { storage } from '../../utils/storage';

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

  const renderSearcher = (
    onSearch: (query: string) => void,
    options?: {
      onOpenApp?: (appId: string) => void;
      onSwitchSpace?: (spaceId: string) => void;
    }
  ) => {
    act(() => {
      root.render(
        <LanguageProvider>
          <Searcher
            searchEngine={{ id: 'google', name: 'Google', url: 'https://google.com/search?q=%s' }}
            onSearch={onSearch}
            onSearchEngineClick={() => undefined}
            searchApps={[{ id: 'app-1', name: 'Notion', url: 'https://notion.so' }]}
            searchSpaces={[
              { id: 'space-1', name: 'Main', index: 1 },
              { id: 'space-2', name: 'Work', index: 2 },
            ]}
            onOpenApp={options?.onOpenApp}
            onSwitchSpace={options?.onSwitchSpace}
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

  it('executes direct @app command via submit', async () => {
    const onSearch = vi.fn();
    const onOpenApp = vi.fn();
    renderSearcher(onSearch, { onOpenApp });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, '@app notion');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onOpenApp).toHaveBeenCalledWith('app-1');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('executes direct # command via submit', async () => {
    const onSearch = vi.fn();
    const onSwitchSpace = vi.fn();
    renderSearcher(onSearch, { onSwitchSpace });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, '#2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSwitchSpace).toHaveBeenCalledWith('space-2');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('shows sticker note suggestions when sticker content search is enabled', async () => {
    const onSearch = vi.fn();
    const getStickerContentSpy = vi.spyOn(storage, 'getSearchStickerContent').mockReturnValue(true);
    vi.spyOn(storage, 'getStickers').mockReturnValue([
      {
        id: 'sticker-1',
        type: 'text',
        content: 'unique note keyword',
        x: 10,
        y: 10,
      },
    ]);
    renderSearcher(onSearch);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, 'unique note');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('unique note keyword');
    expect(getStickerContentSpy).toHaveBeenCalled();
  });

  it('does not build sticker note suggestions when sticker content search is disabled', async () => {
    const onSearch = vi.fn();
    vi.spyOn(storage, 'getSearchStickerContent').mockReturnValue(false);
    const getStickersSpy = vi.spyOn(storage, 'getStickers').mockReturnValue([
      {
        id: 'sticker-1',
        type: 'text',
        content: 'disabled note keyword',
        x: 10,
        y: 10,
      },
    ]);
    renderSearcher(onSearch);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(input, 'disabled note');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(document.body.textContent).not.toContain('disabled note keyword');
    expect(getStickersSpy).not.toHaveBeenCalled();
  });
});
