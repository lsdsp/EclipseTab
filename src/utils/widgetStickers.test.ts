import { describe, expect, it } from 'vitest';
import {
  addTodoWidgetItem,
  advanceTimerWidgetIfNeeded,
  buildDefaultCalendarWidgetContent,
  buildDefaultTimerWidgetContent,
  formatTimerSeconds,
  parseCalendarWidgetState,
  parseTimerWidgetState,
  parseTodoWidgetState,
  pauseTimerWidget,
  serializeWidgetState,
  startTimerWidget,
  toggleTodoWidgetItem,
  updateTimerWidgetDurations,
} from './widgetStickers';

describe('widget sticker timer helpers', () => {
  it('parses invalid timer content with safe defaults', () => {
    const state = parseTimerWidgetState('not-json');
    expect(state.mode).toBe('focus');
    expect(state.focusMinutes).toBe(25);
    expect(state.breakMinutes).toBe(5);
    expect(state.longBreakMinutes).toBe(15);
    expect(state.longBreakInterval).toBe(4);
    expect(state.remainingSec).toBe(1500);
    expect(state.soundEnabled).toBe(false);
  });

  it('starts and pauses timer without losing remaining time', () => {
    const base = parseTimerWidgetState(buildDefaultTimerWidgetContent());
    const started = startTimerWidget(base, 1000);
    expect(started.isRunning).toBe(true);
    expect(started.endAt).toBe(1000 + base.remainingSec * 1000);

    const paused = pauseTimerWidget(started, 31_000);
    expect(paused.isRunning).toBe(false);
    expect(paused.endAt).toBeUndefined();
    expect(paused.remainingSec).toBe(1470);
  });

  it('advances pomodoro phase and increments cycles after focus completes', () => {
    const running = parseTimerWidgetState(serializeWidgetState({
      mode: 'focus',
      focusMinutes: 25,
      breakMinutes: 5,
      remainingSec: 10,
      isRunning: true,
      endAt: 20_000,
      cycles: 2,
      soundEnabled: false,
    }));

    const next = advanceTimerWidgetIfNeeded(running, 20_000);
    expect(next).not.toBeNull();
    expect(next?.mode).toBe('break');
    expect(next?.remainingSec).toBe(300);
    expect(next?.cycles).toBe(3);
    expect(next?.isRunning).toBe(true);
  });

  it('switches to long break at configured interval', () => {
    const running = parseTimerWidgetState(serializeWidgetState({
      mode: 'focus',
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 20,
      longBreakInterval: 2,
      remainingSec: 1,
      isRunning: true,
      endAt: 10_000,
      cycles: 1,
      soundEnabled: false,
    }));

    const next = advanceTimerWidgetIfNeeded(running, 10_000);
    expect(next?.mode).toBe('longBreak');
    expect(next?.remainingSec).toBe(1200);
    expect(next?.cycles).toBe(2);
  });

  it('updates timer durations with bounds and refreshes current phase countdown', () => {
    const state = parseTimerWidgetState(serializeWidgetState({
      mode: 'break',
      focusMinutes: 25,
      breakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      remainingSec: 300,
      isRunning: false,
      cycles: 0,
      soundEnabled: false,
    }));

    const updated = updateTimerWidgetDurations(state, 0, {
      breakMinutes: 12,
      longBreakMinutes: 220,
      longBreakInterval: 0,
    });

    expect(updated.breakMinutes).toBe(12);
    expect(updated.longBreakMinutes).toBe(180);
    expect(updated.longBreakInterval).toBe(1);
    expect(updated.remainingSec).toBe(12 * 60);
  });
});

describe('widget sticker todo helpers', () => {
  it('adds and toggles todo items', () => {
    const parsed = parseTodoWidgetState('{"title":"Today","items":[]}', 'en');
    const withItem = addTodoWidgetItem(parsed, 'Review PR');
    expect(withItem.items).toHaveLength(1);
    expect(withItem.items[0].text).toBe('Review PR');
    expect(withItem.items[0].done).toBe(false);

    const toggled = toggleTodoWidgetItem(withItem, withItem.items[0].id);
    expect(toggled.items[0].done).toBe(true);
  });

  it('falls back to localized default title', () => {
    const parsed = parseTodoWidgetState('{"items":[]}', 'zh');
    expect(parsed.title).toBe('今日待办');
  });
});

describe('widget sticker calendar helpers', () => {
  it('parses calendar defaults from empty content', () => {
    const state = parseCalendarWidgetState('{}');
    expect(state.enabled).toBe(false);
    expect(state.url).toBe('');
    expect(state.events).toEqual([]);
  });

  it('builds default calendar content with disabled state', () => {
    const state = parseCalendarWidgetState(buildDefaultCalendarWidgetContent());
    expect(state.enabled).toBe(false);
    expect(state.error).toBeUndefined();
  });
});

describe('widget sticker formatters', () => {
  it('formats timer seconds as mm:ss', () => {
    expect(formatTimerSeconds(65)).toBe('01:05');
    expect(formatTimerSeconds(0)).toBe('00:00');
  });
});
