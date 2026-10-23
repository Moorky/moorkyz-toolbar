'use strict';

const { test, expect } = require('@playwright/test');

test('desktop navigation, prerequisites, and original-only controls', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#submit-button')).toBeEnabled();
  await expect(page.locator('#engine-status')).toHaveText('ALL SYSTEMS READY');
  await expect(page.locator('.empty-state').first()).toBeVisible();
  await page.locator('#skip-compression').check();
  await expect(page.getByRole('radio', { name: /Balanced/ })).toBeDisabled();
  await expect(page.locator('#compression-options')).toHaveJSProperty('disabled', true);
  await expect(page.locator('#submit-button')).toHaveText(/Download original/);
  await page.locator('#skip-compression').uncheck();
  await page.getByRole('link', { name: /Export history/ }).click();
  await expect(page.locator('#history-view')).toBeVisible();
  await page.getByRole('link', { name: /How it works/ }).click();
  await expect(page.getByRole('heading', { name: 'First-time setup' })).toBeVisible();
  await page.getByRole('link', { name: /Overview/ }).click();
  await expect(page.locator('#workspace-view')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop-workspace.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('a real browser export produces a playable MP4, original download, and persistent history', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#submit-button')).toBeEnabled();
  await page.locator('#video-url').fill('http://127.0.0.1:8877/sample.mp4');
  await page.getByRole('radio', { name: /Extreme/ }).check();
  const accepted = page.waitForResponse((response) => response.url().endsWith('/api/jobs') && response.request().method() === 'POST');
  await page.locator('#submit-button').click();
  expect((await accepted).status()).toBe(202);
  await expect(page.locator('#active-job .job-status')).toHaveText('Ready to watch', { timeout: 60000 });
  await expect(page.locator('#active-job .job-directory')).toContainText('Saved to');
  await page.locator('#active-job summary').click();
  await expect(page.locator('#active-job .log-content')).toContainText('Compressing video');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#active-job').getByRole('link', { name: 'Original', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('source.mp4');
  expect(await download.failure()).toBeNull();
  const popupEvent = page.waitForEvent('popup');
  await page.locator('#active-job').getByRole('link', { name: /Watch offline/ }).click();
  const player = await popupEvent;
  await expect(player.locator('video')).toBeVisible();
  await expect.poll(() => player.locator('video').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  await player.locator('video').evaluate((video) => { video.muted = true; return video.play(); });
  await expect(player.locator('video')).toHaveJSProperty('paused', false);
  await player.close();
  await page.reload();
  await expect(page.locator('#history-count')).toHaveText('1');
  await expect(page.locator('#active-job .job-status')).toHaveText('Ready to watch');
  await page.screenshot({ path: testInfo.outputPath('completed-export.png'), fullPage: true });
});

test('mobile layout stays within the viewport and exposes navigation and form errors', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#submit-button')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#video-url').fill('file:///C:/not-a-web-video.mp4');
  await page.locator('#submit-button').click();
  await expect(page.locator('#form-error')).toHaveText(/HTTP or HTTPS/);
  await page.getByRole('link', { name: /Export history/ }).click();
  await expect(page.locator('#history-view')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Overview/ }).click();
  await page.screenshot({ path: testInfo.outputPath('mobile-workspace.png'), fullPage: true });
});

test('failed downloads display an explicit error instead of a completed export', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#submit-button')).toBeEnabled();
  await page.locator('#video-url').fill('http://127.0.0.1:8877/missing');
  await page.locator('#submit-button').click();
  await expect(page.locator('#active-job .job-status')).toHaveText('Export failed', { timeout: 60000 });
  await expect(page.locator('#active-job .job-error')).toHaveText(/download attempts failed/);
  await expect(page.locator('#active-job').getByRole('link', { name: /Watch offline/ })).toHaveCount(0);
  await expect(page.locator('#submit-button')).toBeEnabled();
});
