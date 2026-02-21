import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './SuggestionsList.module.css';
import { scaleFadeIn, scaleFadeOut } from '../../utils/animations';
import { SearchSuggestionGroup, SearchSuggestionItem } from './searchSuggestionsLocal';

interface SuggestionsListProps {
    suggestions: SearchSuggestionItem[];
    groupLabels: Record<SearchSuggestionGroup, string>;
    activeIndex: number;
    onSelect: (suggestion: SearchSuggestionItem) => void;
    onHover: (index: number) => void;
    isExiting?: boolean;
    anchorRect: DOMRect | null;
}

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
    suggestions,
    groupLabels,
    activeIndex,
    onSelect,
    onHover,
    isExiting = false,
    anchorRect,
}) => {
    const listRef = useRef<HTMLUListElement>(null);
    const [position, setPosition] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (anchorRect) {
            setPosition({
                position: 'fixed',
                left: `${anchorRect.left}px`,
                bottom: `${window.innerHeight - anchorRect.top}px`,
                width: `${anchorRect.width}px`,
            });
        }
    }, [anchorRect]);

    // 入场动画
    useEffect(() => {
        if (listRef.current && !isExiting) {
            scaleFadeIn(listRef.current);
        }
    }, [isExiting]);

    // 出场动画
    useEffect(() => {
        if (isExiting && listRef.current) {
            scaleFadeOut(listRef.current, 300);
        }
    }, [isExiting]);

    if (suggestions.length === 0 || !anchorRect) return null;

    return createPortal(
        <ul
            ref={listRef}
            className={styles.suggestionsList}
            data-ui-zone="search-suggestions"
            style={position}
        >
            {suggestions.map((suggestion, index) => {
                const showGroupHeader = index === 0 || suggestions[index - 1].group !== suggestion.group;
                return (
                    <React.Fragment key={suggestion.id}>
                        {showGroupHeader && (
                            <li className={styles.groupHeader}>
                                {groupLabels[suggestion.group]}
                            </li>
                        )}
                        <li
                            className={`${styles.suggestionItem} ${index === activeIndex ? styles.active : ''}`}
                            onClick={() => onSelect(suggestion)}
                            onMouseEnter={() => onHover(index)}
                        >
                            <span className={styles.suggestionText}>{suggestion.label}</span>
                            {suggestion.meta && <span className={styles.suggestionMeta}>{suggestion.meta}</span>}
                        </li>
                    </React.Fragment>
                );
            })}
        </ul>,
        document.body
    );
};
