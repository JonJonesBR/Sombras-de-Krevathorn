const { test, expect } = require('@playwright/test');

/**
 * Performance budget.
 *
 * Measures update() + draw() wall time under a synthetic load and fails if the
 * frame cost grows past the budget. The budget is a regression guard, not a
 * promise: it sits well above what the game actually costs so ordinary CI
 * noise does not trip it, while a real doubling of per-frame work does.
 */

// Measured baseline on the development machine, 49 enemies alive:
// median 14.5ms, p95 23.7ms, max 44.5ms. The budgets sit at roughly 2.3x the
// median and 2.8x the p95, so ordinary CI noise cannot trip them while a real
// doubling of per-frame work does.
const MEDIAN_BUDGET_MS = 33;   // ~30fps
const P95_BUDGET_MS = 66;      // ~15fps for the 5% worst frames
const MEASURE = (frames) => {
  const times = [];
  // Fill the field well past CONFIG.MAX_ENEMIES so the frame is genuinely heavy.
  const spawn = map.getSafeSpawn(0);
  for (let i = 0; i < 45; i++) {
    const a = (i / 45) * Math.PI * 2;
    const e = new Enemy(spawn.x + Math.cos(a) * 260, spawn.y + Math.sin(a) * 260, false);
    entities.push(e);
  }
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    update();
    draw();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const at = q => times[Math.min(times.length - 1, Math.floor(times.length * q))];
  return JSON.stringify({
    enemies: entities.filter(e => e && e.alive && e !== player).length,
    median: at(0.5), p95: at(0.95), max: at(1), samples: times.length
  });
};

test.describe('performance budget', () => {
  test.describe.configure({ mode: 'serial', timeout: 5 * 60 * 1000 });

  test('a heavy frame stays inside the frame budget', async ({ page }) => {
    await page.goto('/');
    await page.locator('.class-mini-card.warrior').click();
    await page.locator('#tutorial-skip-btn').click();
    await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
    // Pin quality and disable the auto-quality step: it re-renders panels and
    // would change what is being measured halfway through.
    await page.evaluate(() => {
      GameSettings.userSetQuality = true;
      GameSettings.particlesEnabled = false;
      window.cancelAnimationFrame(window.__raf);
    });
    const stats = JSON.parse(await page.evaluate(MEASURE, '180'));
    // A measurement that did not actually load the frame proves nothing.
    expect(stats.samples).toBe(180);
    expect(stats.enemies).toBeGreaterThan(20);
    console.log(`frame ms -> median ${stats.median.toFixed(1)}, p95 ${stats.p95.toFixed(1)}, max ${stats.max.toFixed(1)} with ${stats.enemies} enemies`);
    expect(stats.median).toBeLessThan(MEDIAN_BUDGET_MS);
    expect(stats.p95).toBeLessThan(P95_BUDGET_MS);
  });
});
