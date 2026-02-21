import type { Language } from '../../context/LanguageContext';
import type { Sticker } from '../../types';
import { parseTodoWidgetState } from '../../utils/widgetStickers';

export type SearchSuggestionGroup = 'apps' | 'spaces' | 'notes' | 'web' | 'help';

export type SearchSuggestionAction =
  | { type: 'search'; query: string }
  | { type: 'openApp'; appId: string }
  | { type: 'switchSpace'; spaceId: string }
  | { type: 'fillQuery'; query: string }
  | { type: 'noop' };

export interface SearchSuggestionItem {
  id: string;
  group: SearchSuggestionGroup;
  label: string;
  meta?: string;
  action: SearchSuggestionAction;
}

export interface SearchLocalApp {
  id: string;
  name: string;
  url: string;
  spaceName?: string;
}

export interface SearchLocalSpace {
  id: string;
  name: string;
  index: number;
}

export interface SearchLocalNote {
  id: string;
  text: string;
}

interface BuildSuggestionsInput {
  query: string;
  apps: SearchLocalApp[];
  spaces: SearchLocalSpace[];
  notes: SearchLocalNote[];
  remoteSuggestions: string[];
}

interface ResolveCommandInput {
  query: string;
  apps: SearchLocalApp[];
  spaces: SearchLocalSpace[];
}

const MAX_GROUP_ITEMS = 5;

const trimAndLower = (value: string): string => value.trim().toLowerCase();

const isHelpQuery = (query: string): boolean => query.trim() === '?';

const parseAppCommandKeyword = (query: string): string | null => {
  const trimmed = query.trim();
  if (!trimmed.toLowerCase().startsWith('@app')) {
    return null;
  }
  return trimmed.slice(4).trim();
};

const parseSpaceCommandKeyword = (query: string): string | null => {
  const trimmed = query.trim();
  if (!trimmed.startsWith('#')) {
    return null;
  }
  return trimmed.slice(1).trim();
};

const byScore = <T>(items: T[], keyword: string, toLabel: (item: T) => string): T[] => {
  const normalizedKeyword = trimAndLower(keyword);
  if (!normalizedKeyword) {
    return [...items];
  }

  return [...items]
    .map((item) => {
      const label = trimAndLower(toLabel(item));
      const index = label.indexOf(normalizedKeyword);
      let score = Number.POSITIVE_INFINITY;
      if (label === normalizedKeyword) {
        score = 0;
      } else if (label.startsWith(normalizedKeyword)) {
        score = 1;
      } else if (index >= 0) {
        score = 2 + index / 100;
      }
      return { item, score, label };
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return left.label.localeCompare(right.label);
    })
    .map((entry) => entry.item);
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
};

const buildHelpSuggestions = (): SearchSuggestionItem[] => {
  return [
    {
      id: 'help-app',
      group: 'help',
      label: '@app notion',
      meta: 'Open app by name',
      action: { type: 'fillQuery', query: '@app ' },
    },
    {
      id: 'help-space-index',
      group: 'help',
      label: '#2',
      meta: 'Switch to space by order',
      action: { type: 'fillQuery', query: '#' },
    },
    {
      id: 'help-space-name',
      group: 'help',
      label: '#work',
      meta: 'Switch to space by name',
      action: { type: 'fillQuery', query: '#' },
    },
    {
      id: 'help-help',
      group: 'help',
      label: '?',
      meta: 'Show command help',
      action: { type: 'noop' },
    },
  ];
};

const toAppSuggestion = (app: SearchLocalApp): SearchSuggestionItem => ({
  id: `app-${app.id}`,
  group: 'apps',
  label: app.name,
  meta: app.spaceName,
  action: { type: 'openApp', appId: app.id },
});

const toSpaceSuggestion = (space: SearchLocalSpace): SearchSuggestionItem => ({
  id: `space-${space.id}`,
  group: 'spaces',
  label: `#${space.index} ${space.name}`,
  action: { type: 'switchSpace', spaceId: space.id },
});

const toNoteSuggestion = (note: SearchLocalNote): SearchSuggestionItem => ({
  id: `note-${note.id}`,
  group: 'notes',
  label: truncate(note.text, 72),
  action: { type: 'search', query: note.text },
});

const toWebSuggestion = (text: string, index: number): SearchSuggestionItem => ({
  id: `web-${index}-${text}`,
  group: 'web',
  label: text,
  action: { type: 'search', query: text },
});

const matchApps = (apps: SearchLocalApp[], keyword: string): SearchLocalApp[] => {
  if (!keyword) {
    return apps.slice(0, MAX_GROUP_ITEMS);
  }
  return byScore(apps, keyword, (app) => app.name).slice(0, MAX_GROUP_ITEMS);
};

const matchSpaces = (spaces: SearchLocalSpace[], keyword: string): SearchLocalSpace[] => {
  if (!keyword) {
    return spaces.slice(0, MAX_GROUP_ITEMS);
  }

  const numericIndex = Number(keyword);
  if (Number.isInteger(numericIndex) && numericIndex >= 1) {
    const byOrder = spaces.find((space) => space.index === numericIndex);
    if (byOrder) {
      const others = spaces.filter((space) => space.id !== byOrder.id);
      return [byOrder, ...byScore(others, keyword, (space) => space.name)].slice(0, MAX_GROUP_ITEMS);
    }
  }

  return byScore(spaces, keyword, (space) => space.name).slice(0, MAX_GROUP_ITEMS);
};

const matchNotes = (notes: SearchLocalNote[], keyword: string): SearchLocalNote[] => {
  if (!keyword) {
    return [];
  }
  return byScore(notes, keyword, (note) => note.text).slice(0, MAX_GROUP_ITEMS);
};

export const isCommandLikeQuery = (query: string): boolean => {
  const trimmed = query.trim();
  return trimmed.toLowerCase().startsWith('@app') || trimmed.startsWith('#') || trimmed === '?';
};

export const shouldUseRemoteSuggestions = (query: string): boolean => {
  const trimmed = query.trim();
  return Boolean(trimmed) && !isCommandLikeQuery(trimmed);
};

export const buildUnifiedSuggestions = ({
  query,
  apps,
  spaces,
  notes,
  remoteSuggestions,
}: BuildSuggestionsInput): SearchSuggestionItem[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  if (isHelpQuery(trimmed)) {
    return buildHelpSuggestions();
  }

  const appKeyword = parseAppCommandKeyword(trimmed);
  if (appKeyword !== null) {
    return matchApps(apps, appKeyword).map(toAppSuggestion);
  }

  const spaceKeyword = parseSpaceCommandKeyword(trimmed);
  if (spaceKeyword !== null) {
    return matchSpaces(spaces, spaceKeyword).map(toSpaceSuggestion);
  }

  const appItems = matchApps(apps, trimmed).map(toAppSuggestion);
  const spaceItems = matchSpaces(spaces, trimmed).map(toSpaceSuggestion);
  const noteItems = matchNotes(notes, trimmed).map(toNoteSuggestion);
  const webItems = remoteSuggestions.slice(0, MAX_GROUP_ITEMS).map(toWebSuggestion);

  return [...appItems, ...spaceItems, ...noteItems, ...webItems];
};

export const resolveDirectCommandAction = ({ query, apps, spaces }: ResolveCommandInput): SearchSuggestionAction | null => {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  if (isHelpQuery(trimmed)) {
    return { type: 'noop' };
  }

  const appKeyword = parseAppCommandKeyword(trimmed);
  if (appKeyword !== null) {
    const first = matchApps(apps, appKeyword)[0];
    if (!first) return null;
    return { type: 'openApp', appId: first.id };
  }

  const spaceKeyword = parseSpaceCommandKeyword(trimmed);
  if (spaceKeyword !== null) {
    const first = matchSpaces(spaces, spaceKeyword)[0];
    if (!first) return null;
    return { type: 'switchSpace', spaceId: first.id };
  }

  return null;
};

const normalizeNoteText = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const extractSearchableNotesFromStickers = (
  stickers: Sticker[],
  language: Language
): SearchLocalNote[] => {
  const notes: SearchLocalNote[] = [];

  stickers.forEach((sticker) => {
    if (sticker.type === 'text') {
      const text = normalizeNoteText(sticker.content || '');
      if (text) {
        notes.push({ id: sticker.id, text });
      }
      return;
    }

    if (sticker.type === 'todo') {
      const state = parseTodoWidgetState(sticker.content || '', language);
      state.items.forEach((item) => {
        const text = normalizeNoteText(item.text || '');
        if (!text) return;
        notes.push({ id: `${sticker.id}:${item.id}`, text });
      });
    }
  });

  return notes;
};
