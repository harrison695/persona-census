import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** Launch chromium, tolerating playwright<->browser version drift.
 *  Order: PW_EXE env -> playwright's own resolution -> any chromium in the ms-playwright cache. */
export async function launch() {
  const tries = [];
  if (process.env.PW_EXE) tries.push(process.env.PW_EXE);
  try {
    return await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  } catch (e) { tries.push(null); }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const alt = [];
  if (fs.existsSync(root)) {
    for (const d of fs.readdirSync(root)) {
      if (!d.startsWith('chromium-')) continue;
      for (const rel of [
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
      ]) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) alt.push(p);
      }
    }
  }
  for (const exe of [...tries.filter(Boolean), ...alt]) {
    try {
      return await chromium.launch({ headless: true, executablePath: exe,
        args: ['--disable-blink-features=AutomationControlled'] });
    } catch (e) { /* next */ }
  }
  throw new Error('no usable chromium — run: npx playwright install chromium');
}

export async function newCtx(browser) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    locale: 'en-US', timezoneId: 'America/New_York', viewport: { width: 1440, height: 900 },
  });
  return ctx;
}
