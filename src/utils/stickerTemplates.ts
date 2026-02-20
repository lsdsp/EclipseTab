import { DEFAULT_TEXT_STYLE, StickerInput } from '../types';

export type StickerTemplateType = 'todo' | 'meeting' | 'idea';
export type StickerTemplateLanguage = 'en' | 'zh';

interface StickerTemplateDefinition {
  en: string;
  zh: string;
}

const STICKER_TEMPLATE_MAP: Record<StickerTemplateType, StickerTemplateDefinition> = {
  todo: {
    en: `TODO
□ Task 1
□ Task 2
□ Task 3`,
    zh: `待办清单
□ 事项 1
□ 事项 2
□ 事项 3`,
  },
  meeting: {
    en: `Meeting Notes
Topic:
Decision:
Action:
- [ ]`,
    zh: `会议纪要
主题：
结论：
待办：
- [ ]`,
  },
  idea: {
    en: `Idea Card
Title:
Idea:
Next Step:`,
    zh: `灵感卡片
标题：
想法：
下一步：`,
  },
};

export interface BuildStickerTemplateInput {
  template: StickerTemplateType;
  language: StickerTemplateLanguage;
  x: number;
  y: number;
}

export const buildStickerTemplate = (input: BuildStickerTemplateInput): StickerInput => {
  const localized = STICKER_TEMPLATE_MAP[input.template];
  const content = input.language === 'zh' ? localized.zh : localized.en;

  return {
    type: 'text',
    content,
    x: input.x,
    y: input.y,
    style: {
      ...DEFAULT_TEXT_STYLE,
    },
  };
};

