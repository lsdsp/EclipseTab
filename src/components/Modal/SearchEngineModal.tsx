import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SearchEngine } from '../../types';
import { GOOGLE_ENGINE } from '../../constants/searchEngines';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Modal } from './Modal';
import { useLanguage } from '../../context/LanguageContext';
import styles from './SearchEngineModal.module.css';

interface SearchEngineModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  selectedEngine: SearchEngine;
  engines: SearchEngine[];
  onClose: () => void;
  onSelect: (engine: SearchEngine) => void;
  onAddCustomEngine: (engine: Omit<SearchEngine, 'id'>) => SearchEngine;
  onDeleteEngine: (engineId: string) => void;
  anchorRect?: DOMRect | null;
}

export const SearchEngineModal: React.FC<SearchEngineModalProps> = ({
  isOpen,
  isEditMode,
  selectedEngine,
  engines,
  onClose,
  onSelect,
  onAddCustomEngine,
  onDeleteEngine,
  anchorRect,
}) => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(() => {
    const selectedIndex = engines.findIndex((engine) => engine.id === selectedEngine.id);
    if (selectedIndex >= 0) return selectedIndex;
    return engines.length > 0 ? 0 : -1;
  });
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const selectedIndex = engines.findIndex((engine) => engine.id === selectedEngine.id);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : (engines.length > 0 ? 0 : -1));
    setIsCustomFormOpen(false);
    setCustomName('');
    setCustomUrl('');
  }, [isOpen, engines, selectedEngine]);

  const handleSelect = useCallback((engine: SearchEngine) => {
    onSelect(engine);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (engines.length === 0) {
      if (e.key === 'Escape') {
        onClose();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(engines.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const engine = engines[activeIndex] ?? engines[0];
      if (engine) {
        handleSelect(engine);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [activeIndex, engines, isOpen, handleSelect, onClose]);

  const handleAddCustomEngine = useCallback(() => {
    const name = customName.trim();
    const rawUrl = customUrl.trim();
    if (!name || !rawUrl) {
      return;
    }

    const normalizedUrl = normalizeUrl(rawUrl);
    if (!isValidUrl(normalizedUrl)) {
      window.alert(t.search.invalidUrl);
      return;
    }

    onAddCustomEngine({
      name,
      url: normalizedUrl,
    });
    setCustomName('');
    setCustomUrl('');
    setIsCustomFormOpen(false);
    onClose();
  }, [customName, customUrl, onAddCustomEngine, onClose, t.search.invalidUrl]);

  const handleDeleteEngine = useCallback((engine: SearchEngine) => {
    const message = t.search.deleteConfirm.replace('{name}', engine.name);
    if (window.confirm(message)) {
      onDeleteEngine(engine.id);
    }
  }, [onDeleteEngine, t.search.deleteConfirm]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={undefined} hideHeader anchorRect={anchorRect} offset={12}>
      <div
        ref={listRef}
        className={styles.list}
        role="listbox"
        aria-activedescendant={engines[activeIndex]?.id}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.optionsContainer}>
          {engines.length === 0 && (
            <div className={styles.emptyHint}>{t.search.noEngine}</div>
          )}
          {engines.map((engine, idx) => (
            <div
              key={engine.id}
              className={styles.optionRow}
            >
              <button
                id={engine.id}
                role="option"
                aria-selected={selectedEngine.id === engine.id}
                className={`${styles.option} ${selectedEngine.id === engine.id ? styles.selected : ''}`}
                style={{ transitionDelay: `${idx * 40}ms` }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(engine)}
              >
                <span className={styles.engineName}>
                  {engine.name}
                </span>
              </button>
              {isEditMode && engine.id !== GOOGLE_ENGINE.id && (
                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label={`${t.contextMenu.delete} ${engine.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEngine(engine);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className={`${styles.option} ${styles.customToggle}`}
            onClick={() => setIsCustomFormOpen((prev) => !prev)}
          >
            <span className={styles.engineName}>{t.search.custom}</span>
          </button>

          {isCustomFormOpen && (
            <div className={styles.customForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t.search.customName}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t.search.customUrl}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="https://example.com/search?q={query}"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomEngine();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className={`${styles.option} ${styles.customSubmit}`}
                onClick={handleAddCustomEngine}
                disabled={!customName.trim() || !customUrl.trim()}
              >
                <span className={styles.engineName}>{t.search.addCustom}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

