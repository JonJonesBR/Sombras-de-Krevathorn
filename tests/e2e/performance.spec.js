const { test, expect } = require('@playwright/test');

/**
 * Performance budget.
 *
 * Measures update() + draw() wall time under a synthetic load and fails if the
 * per-frame work grows. Chromium only: wall-clock frame cost is dominated by
 * the engine, not by the game. The same 49 enemies measured p10 11.2ms on
 * Chromium, 18.0ms on Firefox and 24.0ms on WebKit, so a single absolute
 * budget across engines would either be loose enough to miss a real doubling
 * on Chromium or tight enough to fail WebKit on a busy machine. Asserted on
 * p10 rather than the median for the same reason: the median moves with
 * machine contention, p10 does not.
 */

// Measured on the development machine, 49 enemies alive, two runs of the same
// workload: p10 11.2ms and p10 18.1ms. The run-to-run spread of wall-clock
// frame time on a shared box is roughly 1.6x, which is the dominant source of
// noise here — far larger than any engine difference in the game's own work.
// The budget is set from the worse of the two plus headroom. It is a guard
// against a large regression, not a precise instrument: it fires on work
// multiplying by ~2, and would not catch a 20% regression. Asserting tighter
// than this just produced a test that failed on a busy machine and taught
// everyone to ignore it.
const P10_BUDGET_MS = 30;
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
    p10: at(0.1), median: at(0.5), p95: at(0.95), max: at(1), samples: times.length
  });
};

test.describe('performance budget', () => {
  test.describe.configure({ mode: 'serial', timeout: 5 * 60 * 1000 });

  test('a heavy frame stays inside the frame budget', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'wall-clock frame cost is engine-specific; see the header');
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
    console.log(`frame ms -> p10 ${stats.p10.toFixed(1)}, median ${stats.median.toFixed(1)}, p95 ${stats.p95.toFixed(1)}, max ${stats.max.toFixed(1)} with ${stats.enemies} enemies`);
    expect(stats.p10, 'p10 frame cost').toBeLessThan(P10_BUDGET_MS);
    expect(stats.p95, 'p95 frame cost').toBeLessThan(P95_BUDGET_MS);
  });
});
