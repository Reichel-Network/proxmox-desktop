import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import { _electron } from 'playwright-core';

let electronApp: ElectronApplication | undefined;
let page: Page | undefined;

test.beforeAll(async () => {
  const electronPath = path.resolve(
    __dirname,
    '../../node_modules/electron/dist/electron.exe'
  );

  electronApp = await _electron.launch({
    executablePath: electronPath,
    args: [path.resolve(__dirname, '../../')],
  });

  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp?.close();
});

test('launches the Electron app and opens a window', async () => {
  expect(page).toBeDefined();

  await page!.waitForLoadState('domcontentloaded');

  const title = await page!.title();
  expect(title).toContain('ProxTop');
});
