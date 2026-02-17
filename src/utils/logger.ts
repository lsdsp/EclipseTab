const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

type LogArgs = unknown[];

export const logger = {
  debug: (...args: LogArgs): void => {
    if (!isDev) return;
    console.debug(...args);
  },
  info: (...args: LogArgs): void => {
    if (!isDev) return;
    console.info(...args);
  },
  warn: (...args: LogArgs): void => {
    console.warn(...args);
  },
  error: (...args: LogArgs): void => {
    console.error(...args);
  },
};

