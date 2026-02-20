import { describe, expect, it } from 'vitest';
import { buildStickerTemplate } from './stickerTemplates';

describe('sticker template builder', () => {
  it('builds zh todo template at the provided position', () => {
    const sticker = buildStickerTemplate({
      template: 'todo',
      language: 'zh',
      x: 120,
      y: 260,
    });

    expect(sticker.type).toBe('text');
    expect(sticker.x).toBe(120);
    expect(sticker.y).toBe(260);
    expect(sticker.content).toContain('待办清单');
    expect(sticker.content).toContain('□ 事项 1');
  });

  it('builds en meeting template with expected sections', () => {
    const sticker = buildStickerTemplate({
      template: 'meeting',
      language: 'en',
      x: 0,
      y: 0,
    });

    expect(sticker.content).toContain('Meeting Notes');
    expect(sticker.content).toContain('Topic:');
    expect(sticker.content).toContain('Action:');
  });

  it('returns isolated style objects across calls', () => {
    const first = buildStickerTemplate({
      template: 'idea',
      language: 'zh',
      x: 10,
      y: 10,
    });
    const second = buildStickerTemplate({
      template: 'idea',
      language: 'zh',
      x: 20,
      y: 20,
    });

    expect(first.style).not.toBe(second.style);
    expect(first.style?.fontSize).toBe(second.style?.fontSize);
  });
});

