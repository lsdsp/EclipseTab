import { describe, expect, it } from 'vitest';
import {
  buildUnifiedSuggestions,
  extractSearchableNotesFromStickers,
  resolveDirectCommandAction,
  shouldUseRemoteSuggestions,
} from './searchSuggestionsLocal';

describe('searchSuggestionsLocal', () => {
  it('extracts text and todo notes from stickers', () => {
    const notes = extractSearchableNotesFromStickers(
      [
        {
          id: 'text-1',
          type: 'text',
          content: '  hello   eclipse  ',
          x: 10,
          y: 10,
        },
        {
          id: 'todo-1',
          type: 'todo',
          content: JSON.stringify({
            title: 'Today',
            items: [
              { id: 'a', text: 'write tests', done: false },
              { id: 'b', text: ' ', done: false },
            ],
          }),
          x: 20,
          y: 20,
        },
      ],
      'en'
    );

    expect(notes).toEqual([
      { id: 'text-1', text: 'hello eclipse' },
      { id: 'todo-1:a', text: 'write tests' },
    ]);
  });

  it('builds grouped suggestions with command and web entries', () => {
    const suggestions = buildUnifiedSuggestions({
      query: 'wo',
      apps: [{ id: 'app-1', name: 'Workspace', url: 'https://example.com', spaceName: 'Main' }],
      spaces: [{ id: 'space-1', name: 'Work', index: 1 }],
      notes: [{ id: 'note-1', text: 'weekly work review' }],
      remoteSuggestions: ['world clock'],
    });

    expect(suggestions.map((item) => item.group)).toEqual(['apps', 'spaces', 'notes', 'web']);
    expect(suggestions[0]?.label).toBe('Workspace');
    expect(suggestions[1]?.label).toBe('#1 Work');
    expect(suggestions[2]?.label).toContain('weekly work review');
    expect(suggestions[3]?.label).toBe('world clock');
  });

  it('resolves direct command actions for app and space', () => {
    const apps = [{ id: 'app-1', name: 'Notion', url: 'https://notion.so' }];
    const spaces = [
      { id: 'space-1', name: 'Main', index: 1 },
      { id: 'space-2', name: 'Work', index: 2 },
    ];

    expect(resolveDirectCommandAction({ query: '@app notion', apps, spaces })).toEqual({
      type: 'openApp',
      appId: 'app-1',
    });
    expect(resolveDirectCommandAction({ query: '#2', apps, spaces })).toEqual({
      type: 'switchSpace',
      spaceId: 'space-2',
    });
  });

  it('disables remote suggestions for command-like queries', () => {
    expect(shouldUseRemoteSuggestions('@app test')).toBe(false);
    expect(shouldUseRemoteSuggestions('#2')).toBe(false);
    expect(shouldUseRemoteSuggestions('?')).toBe(false);
    expect(shouldUseRemoteSuggestions('hello')).toBe(true);
  });
});

