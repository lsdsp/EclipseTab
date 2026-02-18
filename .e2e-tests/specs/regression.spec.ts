import { expect, test, type Page } from '@playwright/test';

const BACKGROUND_POINT = { x: 320, y: 220 };

const normalizeFontFamily = (value: string): string =>
  value.replace(/["'\s]/g, '').toLowerCase();

const expectOrderedFonts = (value: string, orderedFontNames: string[]) => {
  const normalized = normalizeFontFamily(value);
  let lastIndex = -1;

  for (const fontName of orderedFontNames) {
    const index = normalized.indexOf(fontName.replace(/\s/g, '').toLowerCase());
    expect(index).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }
};

const getSearchInput = (page: Page) =>
  page.locator('[class*="searcher"] input[type="text"]').first();

async function waitForAppReady(page: Page) {
  await page.goto('/');
  await expect(page.locator('[class*="searchEngine"]').first()).toBeVisible();
}

async function openBackgroundContextMenu(page: Page, point = BACKGROUND_POINT) {
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.locator('[class*="contextMenu"]')).toBeVisible();
}

async function toggleGlobalEditMode(page: Page, shouldEnable: boolean) {
  await openBackgroundContextMenu(page);
  const toggle = page.getByRole('button', { name: /Edit Mode|Exit Edit Mode/ });
  const currentLabel = (await toggle.textContent())?.trim();

  if (
    (shouldEnable && currentLabel === 'Edit Mode') ||
    (!shouldEnable && currentLabel === 'Exit Edit Mode')
  ) {
    await toggle.click();
    return;
  }

  await page.mouse.click(8, 8);
}

async function openSettingsModal(page: Page) {
  await openBackgroundContextMenu(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[class*="layoutSection"]')).toBeVisible();
}

async function closeSettingsModal(page: Page) {
  await page.mouse.click(8, 8);
  await expect(page.locator('[class*="layoutSection"]')).toHaveCount(0);
}

async function setSearchOpenInNewTab(page: Page, enabled: boolean) {
  await openSettingsModal(page);
  const row = page.locator('[class*="layoutRow"]', {
    has: page.locator('[class*="layoutLabel"]', { hasText: 'New Tab' }),
  });

  const toggleButton = row.getByRole('button', { name: enabled ? 'On' : 'Off' });
  await toggleButton.scrollIntoViewIfNeeded();
  await expect(toggleButton).toBeVisible();
  await toggleButton.click();
  await closeSettingsModal(page);
}

async function openSearchEngineModal(page: Page) {
  await page.locator('[class*="searchEngine"]').first().click();
  await expect(page.locator('[role="listbox"]')).toBeVisible();
}

async function closeSearchEngineModal(page: Page) {
  await page.mouse.click(8, 8);
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
}

async function addCustomSearchEngine(page: Page, name: string, url: string) {
  await openSearchEngineModal(page);
  await page.getByRole('button', { name: 'Custom' }).click();

  const form = page.locator('[class*="customForm"]');
  await expect(form).toBeVisible();
  await form.locator('input').nth(0).fill(name);
  await form.locator('input').nth(1).fill(url);
  await form.getByRole('button', { name: 'Add Custom Engine' }).click();

  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
}

async function installWindowOpenSpy(page: Page) {
  await page.evaluate(() => {
    (window as any).__openCalls = [];
    window.open = ((url?: string | URL, target?: string) => {
      (window as any).__openCalls.push({
        url: String(url ?? ''),
        target: target ?? '',
      });
      return null;
    }) as Window['open'];
  });
}

async function getWindowOpenCalls(page: Page): Promise<Array<{ url: string; target: string }>> {
  return page.evaluate(() => (window as any).__openCalls || []);
}

async function runSearch(page: Page, query: string) {
  const input = getSearchInput(page);
  await input.click();
  await input.fill(query);
  await input.press('Enter');
}

test.describe('Cross-browser Regression', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('README core exposure and settings structure', async ({ page }) => {
    await expect(page.locator('[class*="searcher"]')).not.toContainText('Search by');

    const dockItems = page.locator('[class*="dockItemWrapper"]');
    expect(await dockItems.count()).toBeGreaterThan(0);

    await openSettingsModal(page);

    await expect(page.getByTitle('Follow System')).toBeVisible();
    await expect(page.getByTitle('Light Theme')).toBeVisible();
    await expect(page.getByTitle('Dark Theme')).toBeVisible();
    await expect(page.getByTitle('Default Theme')).toBeVisible();

    const labels = await page
      .locator('[class*="layoutRow"] [class*="layoutLabel"]')
      .allInnerTexts();
    const suggestionsIndex = labels.indexOf('Suggestions');
    const newTabIndex = labels.indexOf('New Tab');

    expect(suggestionsIndex).toBeGreaterThanOrEqual(0);
    expect(newTabIndex).toBeGreaterThan(suggestionsIndex);

    await closeSettingsModal(page);
  });

  test('Search engine management, placeholder search, and edit-mode safety', async ({ page }) => {
    await addCustomSearchEngine(page, 'QueryEngine', 'https://example.com/find?q={query}');
    await addCustomSearchEngine(page, 'PercentEngine', 'https://example.net/search/%s/?src=test');

    await openSearchEngineModal(page);
    await expect(page.getByRole('option', { name: 'QueryEngine' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'PercentEngine' })).toBeVisible();
    await expect(page.locator('[role="listbox"]')).not.toContainText('System Default');
    await closeSearchEngineModal(page);

    await setSearchOpenInNewTab(page, true);
    const config = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('EclipseTab_config') || '{}')
    );
    expect(config.openInNewTab).toBe(true);

    await installWindowOpenSpy(page);

    await openSearchEngineModal(page);
    await page.getByRole('option', { name: 'QueryEngine' }).click();
    await runSearch(page, 'hello world');

    let openCalls = await getWindowOpenCalls(page);
    expect(openCalls.at(-1)?.url).toBe('https://example.com/find?q=hello%20world');

    await openSearchEngineModal(page);
    await page.getByRole('option', { name: 'PercentEngine' }).click();
    await runSearch(page, 'hello world');

    openCalls = await getWindowOpenCalls(page);
    expect(openCalls.at(-1)?.url).toBe('https://example.net/search/hello%20world/?src=test');

    await toggleGlobalEditMode(page, true);
    await openSearchEngineModal(page);
    const modalDeleteButtons = page.locator('[role="listbox"] [class*="deleteButton"]');
    expect(await modalDeleteButtons.count()).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await closeSearchEngineModal(page);

    await openSearchEngineModal(page);
    await expect(page.locator('[role="listbox"] [class*="deleteButton"]')).toHaveCount(0);
    await closeSearchEngineModal(page);

    await toggleGlobalEditMode(page, true);
    await openSearchEngineModal(page);

    const googleRow = page.locator('[class*="optionRow"]', {
      has: page.getByRole('option', { name: 'Google' }),
    });
    await expect(googleRow.locator('[class*="deleteButton"]')).toHaveCount(0);

    const acceptDialog = (dialog: { accept: () => Promise<void> }) => dialog.accept();
    page.on('dialog', acceptDialog);

    for (let i = 0; i < 20; i += 1) {
      const deleteButtons = page.locator('[role="listbox"] [class*="deleteButton"]');
      if ((await deleteButtons.count()) === 0) {
        break;
      }
      await deleteButtons.first().click();
    }

    page.off('dialog', acceptDialog);

    const options = page.getByRole('option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveText('Google');
  });

  test('Sticker quick-edit in global edit mode with font presets', async ({ page }) => {
    const stickerText = 'E2E Sticker Font';

    await page.mouse.dblclick(460, 260);
    const textEditor = page.locator('[contenteditable="true"]');
    await expect(textEditor).toBeVisible();

    await textEditor.click();
    await page.keyboard.type(stickerText);

    const handwriteButton = page.getByRole('button', { name: /Handwrite|手写/ });
    const normalButton = page.getByRole('button', { name: /Normal|普通/ });
    const codeButton = page.getByRole('button', { name: /Code|代码/ });

    await expect(handwriteButton).toBeVisible();
    await expect(normalButton).toBeVisible();
    await expect(codeButton).toBeVisible();

    await codeButton.click();
    const codeStyle = await textEditor.evaluate((el) => (el as HTMLElement).style.fontFamily);
    expectOrderedFonts(codeStyle, ['Cascadia', 'Segoe UI Emoji']);

    await page.getByRole('button', { name: /Confirm|确认/ }).click();

    const sticker = page
      .locator('[data-sticker-id] [class*="textSticker"]')
      .filter({ hasText: stickerText })
      .first();
    await expect(sticker).toBeVisible();

    await toggleGlobalEditMode(page, true);
    await sticker.click();
    await expect(textEditor).toBeVisible();
    await expect(textEditor).toContainText(stickerText);

    await handwriteButton.click();
    const handwrittenStyle = await textEditor.evaluate((el) => (el as HTMLElement).style.fontFamily);
    expectOrderedFonts(handwrittenStyle, [
      'Virgil',
      'HanziPen SC',
      'Cangnanshoujiti',
      'KaiTi',
      'Segoe UI Emoji',
    ]);

    await normalButton.click();
    const normalStyle = await textEditor.evaluate((el) => (el as HTMLElement).style.fontFamily);
    expectOrderedFonts(normalStyle, ['Helvetica', 'Segoe UI Emoji']);

    await codeButton.click();
    const updatedCodeStyle = await textEditor.evaluate((el) => (el as HTMLElement).style.fontFamily);
    expectOrderedFonts(updatedCodeStyle, ['Cascadia', 'Segoe UI Emoji']);

    await page.getByRole('button', { name: /Confirm|确认/ }).click();

    const stickerFontFamily = await sticker.evaluate((el) => (el as HTMLElement).style.fontFamily);
    expect(stickerFontFamily).toContain('Cascadia');
  });

  test('Dock quick access and Focus Spaces add/switch flow', async ({ page }) => {
    await installWindowOpenSpy(page);

    const bilibiliItem = page
      .locator('[class*="dockItem"]')
      .filter({ has: page.locator('img[alt="Bilibili"]') })
      .first();
    await expect(bilibiliItem).toBeVisible();
    await bilibiliItem.click({ force: true });

    const calls = await getWindowOpenCalls(page);
    expect(calls.some((call) => call.url.includes('bilibili.com'))).toBeTruthy();

    const navigator = page.locator('[class*="navigator"]').first();
    const currentNameBefore = (await navigator.locator('[class*="spaceName"]').textContent())?.trim();

    await navigator.click({ button: 'right' });
    await page.getByRole('button', { name: 'Add space' }).click();

    const currentNameAfterAdd = (await navigator.locator('[class*="spaceName"]').textContent())?.trim();
    expect(currentNameAfterAdd).toMatch(/^Space \d+$/);

    await navigator.click();

    await expect
      .poll(async () => (await navigator.locator('[class*="spaceName"]').textContent())?.trim())
      .not.toBe(currentNameAfterAdd);

    expect(currentNameBefore).toBeTruthy();
  });
});
