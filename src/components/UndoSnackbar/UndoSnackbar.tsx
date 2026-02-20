import React from 'react';
import { useUndo } from '../../context/UndoContext';
import styles from './UndoSnackbar.module.css';

export const UndoSnackbar: React.FC = () => {
  const { action, triggerUndo, clearUndo } = useUndo();

  if (!action) return null;

  return (
    <div className={styles.container} data-ui-zone="undo-snackbar">
      <span className={styles.message}>{action.message}</span>
      <button className={styles.undoButton} onClick={triggerUndo} type="button">
        Undo
      </button>
      <button className={styles.closeButton} onClick={clearUndo} type="button" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
};

