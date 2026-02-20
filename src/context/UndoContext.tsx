import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
}

interface UndoContextType {
  action: UndoAction | null;
  showUndo: (message: string, onUndo: () => void, timeoutMs?: number) => void;
  clearUndo: () => void;
  triggerUndo: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

const DEFAULT_TIMEOUT_MS = 5000;

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [action, setAction] = useState<UndoAction | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearUndo = useCallback(() => {
    clearTimer();
    setAction(null);
  }, [clearTimer]);

  const showUndo = useCallback((message: string, onUndo: () => void, timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
    clearTimer();
    const nextAction: UndoAction = {
      id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      onUndo,
    };
    setAction(nextAction);
    timerRef.current = window.setTimeout(() => {
      setAction((current) => (current?.id === nextAction.id ? null : current));
      timerRef.current = null;
    }, timeoutMs);
  }, [clearTimer]);

  const triggerUndo = useCallback(() => {
    if (!action) return;
    action.onUndo();
    clearUndo();
  }, [action, clearUndo]);

  const value = useMemo<UndoContextType>(() => ({
    action,
    showUndo,
    clearUndo,
    triggerUndo,
  }), [action, showUndo, clearUndo, triggerUndo]);

  return (
    <UndoContext.Provider value={value}>
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = (): UndoContextType => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within UndoProvider');
  }
  return context;
};

