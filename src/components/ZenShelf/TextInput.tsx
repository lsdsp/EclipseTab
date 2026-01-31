import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { scaleFadeIn, scaleFadeOut } from '../../utils/animations';
import { useThemeData } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import alignLeftIcon from '../../assets/icons/align-left.svg';
import alignCenterIcon from '../../assets/icons/align-center.svg';
import alignRightIcon from '../../assets/icons/align-right.svg';
import { TEXT_COLORS } from './FloatingToolbar';
import styles from './ZenShelf.module.css';

// ============================================================================
// 文字贴纸的主题感知颜色反转
// ============================================================================
const BLACK_COLOR = '#1C1C1E';
const WHITE_COLOR = '#FFFFFF';

/**
 * 在深色主题下反转黑/白颜色，以获得更好的可读性
 */
const getThemeAwareColor = (color: string, theme: string): string => {
    if (theme !== 'dark') return color;

    const upperColor = color.toUpperCase();
    if (upperColor === BLACK_COLOR.toUpperCase() || upperColor === '#1C1C1E') {
        return WHITE_COLOR;
    }
    if (upperColor === WHITE_COLOR.toUpperCase() || upperColor === '#FFF') {
        return BLACK_COLOR;
    }
    return color;
};

// ============================================================================
// TextInput 组件 - 带有样式选项的增强弹出窗口
// ============================================================================

interface TextInputProps {
    x: number;
    y: number;
    initialText?: string;
    initialStyle?: { color: string; textAlign: 'left' | 'center' | 'right'; fontSize?: number };
    onSubmit: (content: string, style?: { color: string; textAlign: 'left' | 'center' | 'right'; fontSize: number }) => void;
    onCancel: () => void;
    viewportScale: number;
}

export const TextInput: React.FC<TextInputProps> = ({ x, y, initialText = '', initialStyle, onSubmit, onCancel, viewportScale }) => {
    const { t } = useLanguage();
    const { theme } = useThemeData();
    const inputRef = useRef<HTMLDivElement>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState(initialText);
    const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(initialStyle?.textAlign || 'left');
    const [textColor, setTextColor] = useState(initialStyle?.color || TEXT_COLORS[0]);
    const [fontSize, setFontSize] = useState<number>(
        (initialStyle?.fontSize as number) || 40
    );
    const [isExiting, setIsExiting] = useState(false);

    // 带有翻译标签的字体大小选项（L、M、S 顺序）
    const fontSizes = [
        { label: t.textInput.l, value: 40 },
        { label: t.textInput.m, value: 32 },
        { label: t.textInput.s, value: 24 },
    ];

    // 挂载时聚焦并仅对工具栏播放入场动画
    useEffect(() => {
        if (toolbarRef.current) {
            scaleFadeIn(toolbarRef.current, 200);
        }
        if (inputWrapperRef.current) {
            // 仅在添加新文本（初始 text 为空）时播放输入框入场动画
            // 如果是编辑，文本已经显示在画布上，因此输入框本身不需要入场动画。
            if (!initialText) {
                scaleFadeIn(inputWrapperRef.current, 200);
            }
        }
        if (inputRef.current) {
            inputRef.current.focus();
            // 如果是编辑，设置初始文本
            if (initialText) {
                inputRef.current.innerText = initialText;
                // 将光标移动到末尾
                const range = document.createRange();
                range.selectNodeContents(inputRef.current);
                range.collapse(false);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        }
    }, [initialText]);

    // 字体大小更改时更新它
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.fontSize = `${fontSize * viewportScale}px`;
        }
    }, [fontSize, viewportScale]);

    // 触发工具栏和输入框的出场动画
    const triggerExit = useCallback((callback: () => void, animateInput: boolean = true) => {
        if (isExiting) return;
        setIsExiting(true);

        if (animateInput && inputWrapperRef.current) {
            scaleFadeOut(inputWrapperRef.current, 150);
        }

        if (toolbarRef.current) {
            scaleFadeOut(toolbarRef.current, 150, callback);
        } else {
            callback();
        }
    }, [isExiting]);

    // 点击外部关闭（仅当点击空白背景时）
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isExiting) return;
            const target = e.target as HTMLElement;
            // 检查是否点击了输入框或工具栏
            if (inputRef.current?.contains(target) || toolbarRef.current?.contains(target)) {
                return;
            }
            // 如果有内容则提交，否则取消
            const text = inputRef.current?.innerText?.trim() || '';
            if (text) {
                // 如果提交内容，则不播放输入框出场动画
                triggerExit(() => onSubmit(text, { color: textColor, textAlign, fontSize }), false);
            } else {
                triggerExit(onCancel);
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [textColor, textAlign, fontSize, onSubmit, onCancel, isExiting, triggerExit]);



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
        // Shift+Enter 允许换行（默认行为）
    };

    const handleInput = () => {
        if (inputRef.current) {
            setValue(inputRef.current.innerText);
        }
    };

    // 处理粘贴 - 确保仅粘贴纯文本以避免格式问题
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
        handleInput();
    };

    const handleSubmit = () => {
        const trimmed = inputRef.current?.innerText?.trim() || '';
        if (trimmed) {
            // 如果提交内容，则不播放输入框出场动画
            triggerExit(() => onSubmit(trimmed, { color: textColor, textAlign, fontSize }), false);
        } else {
            handleCancel();
        }
    };

    const handleCancel = () => {
        triggerExit(onCancel);
    };

    // 获取字体大小索引以实现高亮位置
    const fontSizeIndex = fontSizes.findIndex(fs => fs.value === fontSize);

    return createPortal(
        <div
            ref={containerRef}
            className={`${styles.stickerPreviewContainer} ${isExiting ? styles.exiting : ''}`}
            style={{ left: x, top: y }}
        >
            {/* 实时预览贴纸 - 直接在背景上显示 */}
            <div ref={inputWrapperRef}>
                <div
                    ref={inputRef}
                    className={styles.stickerPreviewInput}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                        color: getThemeAwareColor(textColor, theme),
                        textAlign: textAlign,
                        fontSize: `${fontSize * viewportScale}px`,
                    }}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onClick={(e) => e.stopPropagation()}
                    data-placeholder={t.textInput.placeholder}
                />
            </div>

            {/* 工具栏 - 跟随在输入区域下方 */}
            <div
                ref={toolbarRef}
                className={styles.stickerToolbar}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 对齐选项 */}
                <div className={styles.toolbarAlignGroup}>
                    <div
                        className={styles.toolbarHighlight}
                        style={{
                            transform: `translateX(${['left', 'center', 'right'].indexOf(textAlign) * 100}%)`,
                        }}
                    />
                    <button
                        className={styles.toolbarAlignBtn}
                        onClick={() => setTextAlign('left')}
                        title="Align Left"
                    >
                        <span className={styles.toolbarIcon} style={{ WebkitMaskImage: `url(${alignLeftIcon})`, maskImage: `url(${alignLeftIcon})` }} />
                    </button>
                    <button
                        className={styles.toolbarAlignBtn}
                        onClick={() => setTextAlign('center')}
                        title="Center"
                    >
                        <span className={styles.toolbarIcon} style={{ WebkitMaskImage: `url(${alignCenterIcon})`, maskImage: `url(${alignCenterIcon})` }} />
                    </button>
                    <button
                        className={styles.toolbarAlignBtn}
                        onClick={() => setTextAlign('right')}
                        title="Align Right"
                    >
                        <span className={styles.toolbarIcon} style={{ WebkitMaskImage: `url(${alignRightIcon})`, maskImage: `url(${alignRightIcon})` }} />
                    </button>
                </div>

                <div className={styles.toolbarDivider} />

                {/* 字体大小选项 */}
                <div className={styles.toolbarAlignGroup}>
                    <div
                        className={styles.toolbarHighlight}
                        style={{
                            transform: `translateX(${fontSizeIndex * 100}%)`,
                        }}
                    />
                    {fontSizes.map((fs) => (
                        <button
                            key={fs.value}
                            className={styles.toolbarAlignBtn}
                            onClick={() => setFontSize(fs.value)}
                            title={`Font Size: ${fs.value}px`}
                        >
                            {fs.label}
                        </button>
                    ))}
                </div>

                <div className={styles.toolbarDivider} />

                {/* 颜色选项 */}
                <div className={styles.toolbarColorGroup}>
                    {TEXT_COLORS.map((color) => (
                        <button
                            key={color}
                            className={`${styles.toolbarColorBtn} ${textColor === color ? styles.active : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setTextColor(color)}
                            title={color}
                        />
                    ))}
                </div>

                <div className={styles.toolbarDivider} />

                {/* 操作按钮 */}
                <button className={styles.toolbarCancelBtn} onClick={handleCancel}>
                    {t.textInput.cancel}
                </button>
                <button
                    className={styles.toolbarConfirmBtn}
                    onClick={handleSubmit}
                    disabled={!value.trim()}
                >
                    {t.textInput.confirm}
                </button>
            </div>
        </div>,
        document.body
    );
};

