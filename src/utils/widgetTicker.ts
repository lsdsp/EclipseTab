import { useSyncExternalStore } from 'react';

type Listener = () => void;

let now = Date.now();
let timerId: number | null = null;
const listeners = new Set<Listener>();

const emitNow = () => {
  now = Date.now();
  listeners.forEach((listener) => listener());
};

const ensureTickerRunning = () => {
  if (typeof window === 'undefined') return;
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    emitNow();
  }, 1000);
};

const stopTickerIfIdle = () => {
  if (typeof window === 'undefined') return;
  if (listeners.size > 0) return;
  if (timerId === null) return;
  window.clearInterval(timerId);
  timerId = null;
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    ensureTickerRunning();
  }

  return () => {
    listeners.delete(listener);
    stopTickerIfIdle();
  };
};

const getSnapshot = () => now;
const getServerSnapshot = () => Date.now();

export const useWidgetNow = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
