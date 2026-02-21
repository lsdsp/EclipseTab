import type { Language } from '../context/LanguageContext';

export type WidgetStickerType = 'clock' | 'timer' | 'todo' | 'calendar';
export type PomodoroMode = 'focus' | 'break' | 'longBreak';

export interface ClockWidgetState {
  showSeconds: boolean;
}

export interface TimerWidgetState {
  mode: PomodoroMode;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  remainingSec: number;
  isRunning: boolean;
  endAt?: number;
  cycles: number;
  soundEnabled: boolean;
}

export interface TodoWidgetItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoWidgetState {
  title: string;
  items: TodoWidgetItem[];
}

export interface CalendarWidgetEvent {
  id: string;
  title: string;
  startAt: number;
  endAt?: number;
  allDay: boolean;
}

export interface CalendarWidgetState {
  enabled: boolean;
  url: string;
  events: CalendarWidgetEvent[];
  lastSyncAt?: number;
  error?: string;
}

const DEFAULT_CLOCK_WIDGET_STATE: ClockWidgetState = {
  showSeconds: true,
};

const DEFAULT_TIMER_WIDGET_STATE: TimerWidgetState = {
  mode: 'focus',
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  remainingSec: 25 * 60,
  isRunning: false,
  cycles: 0,
  soundEnabled: false,
};

const TODO_TITLES: Record<Language, string> = {
  en: 'Today',
  zh: '今日待办',
};

const DEFAULT_CALENDAR_WIDGET_STATE: CalendarWidgetState = {
  enabled: false,
  url: '',
  events: [],
};

const clampToNonNegativeInt = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
};

const clampRangeInt = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const parseJson = <T>(content: string, fallback: T): Partial<T> => {
  try {
    const parsed = JSON.parse(content) as Partial<T> | null;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const createTodoId = (): string => `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const serializeWidgetState = (state: unknown): string => JSON.stringify(state);

export const buildDefaultClockWidgetContent = (): string =>
  serializeWidgetState(DEFAULT_CLOCK_WIDGET_STATE);

export const parseClockWidgetState = (content: string): ClockWidgetState => {
  const parsed = parseJson<ClockWidgetState>(content, DEFAULT_CLOCK_WIDGET_STATE);
  return {
    showSeconds: typeof parsed.showSeconds === 'boolean'
      ? parsed.showSeconds
      : DEFAULT_CLOCK_WIDGET_STATE.showSeconds,
  };
};

export const buildDefaultTimerWidgetContent = (): string =>
  serializeWidgetState(DEFAULT_TIMER_WIDGET_STATE);

export const parseTimerWidgetState = (content: string): TimerWidgetState => {
  const parsed = parseJson<TimerWidgetState>(content, DEFAULT_TIMER_WIDGET_STATE);
  const mode: PomodoroMode = parsed.mode === 'break' || parsed.mode === 'longBreak' ? parsed.mode : 'focus';
  const focusMinutes = clampRangeInt(parsed.focusMinutes, DEFAULT_TIMER_WIDGET_STATE.focusMinutes, 1, 180);
  const breakMinutes = clampRangeInt(parsed.breakMinutes, DEFAULT_TIMER_WIDGET_STATE.breakMinutes, 1, 180);
  const longBreakMinutes = clampRangeInt(parsed.longBreakMinutes, DEFAULT_TIMER_WIDGET_STATE.longBreakMinutes, 1, 180);
  const longBreakInterval = clampRangeInt(parsed.longBreakInterval, DEFAULT_TIMER_WIDGET_STATE.longBreakInterval, 1, 12);
  const defaultRemaining = mode === 'focus'
    ? focusMinutes * 60
    : mode === 'break'
      ? breakMinutes * 60
      : longBreakMinutes * 60;

  return {
    mode,
    focusMinutes,
    breakMinutes,
    longBreakMinutes,
    longBreakInterval,
    remainingSec: clampToNonNegativeInt(parsed.remainingSec, defaultRemaining),
    isRunning: Boolean(parsed.isRunning),
    endAt: typeof parsed.endAt === 'number' && Number.isFinite(parsed.endAt) ? parsed.endAt : undefined,
    cycles: clampToNonNegativeInt(parsed.cycles, 0),
    soundEnabled: Boolean(parsed.soundEnabled),
  };
};

export const getTimerRemainingSeconds = (state: TimerWidgetState, nowMs: number): number => {
  if (state.isRunning && typeof state.endAt === 'number') {
    return Math.max(0, Math.ceil((state.endAt - nowMs) / 1000));
  }
  return Math.max(0, Math.floor(state.remainingSec));
};

export const startTimerWidget = (state: TimerWidgetState, nowMs: number): TimerWidgetState => {
  if (state.isRunning && state.endAt) return state;
  const remainingSec = Math.max(1, getTimerRemainingSeconds(state, nowMs));
  return {
    ...state,
    isRunning: true,
    remainingSec,
    endAt: nowMs + remainingSec * 1000,
  };
};

export const pauseTimerWidget = (state: TimerWidgetState, nowMs: number): TimerWidgetState => {
  if (!state.isRunning) return state;
  return {
    ...state,
    isRunning: false,
    remainingSec: getTimerRemainingSeconds(state, nowMs),
    endAt: undefined,
  };
};

const getModeSeconds = (state: TimerWidgetState, mode: PomodoroMode): number =>
  (mode === 'focus' ? state.focusMinutes : mode === 'break' ? state.breakMinutes : state.longBreakMinutes) * 60;

export const resetTimerWidget = (state: TimerWidgetState): TimerWidgetState => ({
  ...state,
  isRunning: false,
  endAt: undefined,
  remainingSec: getModeSeconds(state, state.mode),
});

export const skipTimerWidgetPhase = (state: TimerWidgetState, nowMs: number): TimerWidgetState => {
  if (state.mode === 'focus') {
    const nextCycles = state.cycles + 1;
    const useLongBreak = nextCycles % state.longBreakInterval === 0;
    const nextMode: PomodoroMode = useLongBreak ? 'longBreak' : 'break';
    const nextRemainingSec = getModeSeconds(state, nextMode);
    return {
      ...state,
      mode: nextMode,
      remainingSec: nextRemainingSec,
      isRunning: state.isRunning,
      endAt: state.isRunning ? nowMs + nextRemainingSec * 1000 : undefined,
      cycles: nextCycles,
    };
  }

  const nextMode: PomodoroMode = 'focus';
  const nextRemainingSec = getModeSeconds(state, nextMode);
  return {
    ...state,
    mode: nextMode,
    remainingSec: nextRemainingSec,
    isRunning: state.isRunning,
    endAt: state.isRunning ? nowMs + nextRemainingSec * 1000 : undefined,
  };
};

export const advanceTimerWidgetIfNeeded = (state: TimerWidgetState, nowMs: number): TimerWidgetState | null => {
  if (!state.isRunning) return null;
  if (getTimerRemainingSeconds(state, nowMs) > 0) return null;
  return skipTimerWidgetPhase(state, nowMs);
};

export const updateTimerWidgetDurations = (
  state: TimerWidgetState,
  nowMs: number,
  updates: Partial<Pick<TimerWidgetState, 'focusMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakInterval'>>
): TimerWidgetState => {
  const next: TimerWidgetState = {
    ...state,
    focusMinutes: updates.focusMinutes !== undefined
      ? clampRangeInt(updates.focusMinutes, state.focusMinutes, 1, 180)
      : state.focusMinutes,
    breakMinutes: updates.breakMinutes !== undefined
      ? clampRangeInt(updates.breakMinutes, state.breakMinutes, 1, 180)
      : state.breakMinutes,
    longBreakMinutes: updates.longBreakMinutes !== undefined
      ? clampRangeInt(updates.longBreakMinutes, state.longBreakMinutes, 1, 180)
      : state.longBreakMinutes,
    longBreakInterval: updates.longBreakInterval !== undefined
      ? clampRangeInt(updates.longBreakInterval, state.longBreakInterval, 1, 12)
      : state.longBreakInterval,
  };

  const currentModeChanged = (
    (state.mode === 'focus' && updates.focusMinutes !== undefined) ||
    (state.mode === 'break' && updates.breakMinutes !== undefined) ||
    (state.mode === 'longBreak' && updates.longBreakMinutes !== undefined)
  );

  if (!currentModeChanged) {
    return next;
  }

  const nextRemainingSec = getModeSeconds(next, state.mode);
  return {
    ...next,
    remainingSec: nextRemainingSec,
    endAt: state.isRunning ? nowMs + nextRemainingSec * 1000 : undefined,
  };
};

export const buildDefaultTodoWidgetContent = (language: Language): string =>
  serializeWidgetState({
    title: TODO_TITLES[language],
    items: [],
  } satisfies TodoWidgetState);

export const buildDefaultCalendarWidgetContent = (): string =>
  serializeWidgetState(DEFAULT_CALENDAR_WIDGET_STATE);

export const parseCalendarWidgetState = (content: string): CalendarWidgetState => {
  const parsed = parseJson<CalendarWidgetState>(content, DEFAULT_CALENDAR_WIDGET_STATE);
  const events = Array.isArray(parsed.events)
    ? parsed.events
      .filter((event): event is CalendarWidgetEvent => Boolean(
        event &&
        typeof event.id === 'string' &&
        typeof event.title === 'string' &&
        typeof event.startAt === 'number'
      ))
      .map((event) => ({
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        endAt: typeof event.endAt === 'number' ? event.endAt : undefined,
        allDay: Boolean(event.allDay),
      }))
    : [];

  return {
    enabled: Boolean(parsed.enabled),
    url: typeof parsed.url === 'string' ? parsed.url : '',
    events,
    lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : undefined,
    error: typeof parsed.error === 'string' ? parsed.error : undefined,
  };
};

export const parseTodoWidgetState = (content: string, language: Language): TodoWidgetState => {
  const fallback: TodoWidgetState = {
    title: TODO_TITLES[language],
    items: [],
  };

  const parsed = parseJson<TodoWidgetState>(content, fallback);
  const title = typeof parsed.title === 'string' && parsed.title.trim().length > 0
    ? parsed.title
    : fallback.title;
  const items = Array.isArray(parsed.items)
    ? parsed.items
      .filter((item): item is TodoWidgetItem =>
        Boolean(item && typeof item.id === 'string' && typeof item.text === 'string'))
      .map((item) => ({
        id: item.id,
        text: item.text,
        done: Boolean(item.done),
      }))
    : [];

  return {
    title,
    items,
  };
};

export const addTodoWidgetItem = (state: TodoWidgetState, text: string): TodoWidgetState => {
  const trimmed = text.trim();
  if (!trimmed) return state;
  return {
    ...state,
    items: [
      ...state.items,
      {
        id: createTodoId(),
        text: trimmed,
        done: false,
      },
    ],
  };
};

export const toggleTodoWidgetItem = (state: TodoWidgetState, itemId: string): TodoWidgetState => ({
  ...state,
  items: state.items.map((item) => (
    item.id === itemId ? { ...item, done: !item.done } : item
  )),
});

export const removeTodoWidgetItem = (state: TodoWidgetState, itemId: string): TodoWidgetState => ({
  ...state,
  items: state.items.filter((item) => item.id !== itemId),
});

export const formatTimerSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const leftSeconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${leftSeconds.toString().padStart(2, '0')}`;
};
