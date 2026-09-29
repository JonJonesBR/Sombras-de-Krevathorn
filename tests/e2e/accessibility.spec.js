const { test, expect } = require('@playwright/test');

/**
 * Automated accessibility audit for the DOM interface.
 *
 * Scope limits, stated up front so the numbers are not over-read:
 *  - The gameplay surface is drawn on <canvas>, so HUD text contrast cannot be
 *    measured here. These checks cover the HTML panels and controls only.
 *  - A real screen reader still has to be tried; this verifies that names,
 *    roles and states exist, not that they are announced well.
 */

const AUDIT = (rootSel, minimumTarget = 16) => {
  const root = document.querySelector(rootSel);
  const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = value => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(p => parseFloat(p));
    return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
  };
  const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  // Flatten the element's text colour against the nearest opaque ancestor.
  const effectiveBg = el => {
    let node = el, acc = null;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) { acc = acc === null ? { rgb: c.rgb, a: c.a } : { rgb: over(acc.rgb, c.rgb, acc.a), a: 1 }; if (acc.a >= 1) return acc.rgb; }
      node = node.parentElement;
    }
    return acc ? acc.rgb : [0, 0, 0];
  };

  const isVisible = el => el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).opacity !== '0' &&
    !el.closest('[inert]') && !el.closest('[aria-hidden="true"]');

  const interactive = [...root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')].filter(isVisible);
  const nameOf = el => (el.getAttribute('aria-label') || el.textContent || el.value || '').trim();

  const nameless = interactive.filter(el => !nameOf(el)).map(el => el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 40));
  // Measure the authored layout box so the panel's entrance animation does not
  // temporarily make otherwise-compliant controls appear smaller.
  // Settings callers use 24px; other game controls retain their established 16px floor.
  const smallTargets = interactive
    .filter(el => el.offsetWidth > 0 && (el.offsetWidth < minimumTarget || el.offsetHeight < minimumTarget))
    .map(el => (el.id || el.tagName) + ' ' + el.offsetWidth + 'x' + el.offsetHeight);
  const selects = [...root.querySelectorAll('select')].filter(isVisible);
  const lowContrastControls = selects.map(el => {
    const fg = parse(getComputedStyle(el).color);
    if (!fg) return null;
    const bg = effectiveBg(el);
    const flat = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const contrast = ratio(flat, bg);
    return contrast >= 4.5 ? null : {
      id: el.id,
      foreground: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      ratio: Math.round(contrast * 100) / 100
    };
  }).filter(Boolean);
  const lowContrastOptions = selects.flatMap(select => [...select.options].map(option => {
    const fg = parse(getComputedStyle(option).color);
    const bg = parse(getComputedStyle(option).backgroundColor);
    if (!fg || !bg) return null;
    const flat = fg.a < 1 ? over(fg.rgb, bg.rgb, fg.a) : fg.rgb;
    const contrast = ratio(flat, bg.rgb);
    return contrast >= 4.5 ? null : {
      select: select.id,
      option: option.textContent,
      foreground: getComputedStyle(option).color,
      background: getComputedStyle(option).backgroundColor,
      ratio: Math.round(contrast * 100) / 100
    };
  })).filter(Boolean);

  const textNodes = [...root.querySelectorAll('*')].filter(el =>
    isVisible(el) && el.children.length === 0 && (el.textContent || '').trim().length > 0);
  const lowContrast = textNodes.map(el => {
    const fg = parse(getComputedStyle(el).color);
    if (!fg) return null;
    const bg = effectiveBg(el);
    const flat = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const r = ratio(flat, bg);
    return r >= 4.5 ? null : { text: el.textContent.trim().slice(0, 30), ratio: Math.round(r * 100) / 100 };
  }).filter(Boolean);

  return {
    interactive: interactive.length,
    selectCount: selects.length,
    textNodes: textNodes.length,
    nameless, smallTargets, lowContrast: lowContrast.slice(0, 8), lowContrastCount: lowContrast.length,
    lowContrastControls, lowContrastOptions
  };
};

// Serialised as a string on purpose: returning a plain object from evaluate
// comes back undefined in this environment.
// One string argument per evaluate: passing an array trips a broken
// deserialiser in this environment ("refs.set is not a function"), and
// returning a plain object comes back undefined. Hence the string round-trip.
const audit = async (page, root, minimumTarget = 16) => {
  await page.evaluate(sel => { window.__auditRoot = sel; }, root);
  await page.evaluate(size => { window.__auditMinimumTarget = size; }, minimumTarget);
  return JSON.parse(await page.evaluate(src => JSON.stringify(eval('(' + src + ')')(window.__auditRoot, window.__auditMinimumTarget)), AUDIT.toString()));
};

async function openPanel(page) {
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState), { timeout: 15000 }).toBe('PLAYING');
}

test('settings panel: every control has an accessible name and a 24px target', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => window.toggleSettings());
  await expect(page.locator('#settings-panel')).toBeVisible();
  for (const lang of ['pt', 'en', 'es']) {
    await page.evaluate(l => { I18n.setLang(l); SettingsUI._render(); }, lang);
    const report = (await audit(page, '#settings-panel', 24));
    // Guards against a silently empty scan passing every check below.
    expect(report.interactive, `controls scanned in ${lang}`).toBeGreaterThan(10);
    expect(report.nameless, `controls without a name in ${lang}`).toEqual([]);
    expect(report.smallTargets, `targets under 24px in ${lang}`).toEqual([]);
  }
});

test('pause menu: every control has an accessible name and a 16px target', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => window.PauseSystem.pause());
  await expect(page.locator('#pause-resume')).toBeVisible();
  const report = (await audit(page, '#pause-overlay'));
  expect(report.nameless).toEqual([]);
  expect(report.smallTargets).toEqual([]);
});

test('settings panel text meets the 4.5:1 contrast ratio in every language', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => window.toggleSettings());
  await expect(page.locator('#settings-panel')).toBeVisible();
  for (const lang of ['pt', 'en', 'es']) {
    await page.evaluate(l => { I18n.setLang(l); SettingsUI._render(); }, lang);
    const report = (await audit(page, '#settings-panel'));
    expect(report.textNodes, `text nodes scanned in ${lang}`).toBeGreaterThan(10);
    expect(report.lowContrast, `low contrast text in ${lang}`).toEqual([]);
  }
});

test('gamepad mapping dropdowns keep readable text when enabled', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => window.toggleSettings());
  await page.evaluate(() => window.SettingsUI._setControl('gamepad'));
  const report = await audit(page, '#settings-panel');
  expect(report.selectCount).toBe(3);
  expect(report.lowContrastControls).toEqual([]);
  expect(report.lowContrastOptions).toEqual([]);
});
