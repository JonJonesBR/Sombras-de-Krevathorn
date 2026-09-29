const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Balance data harness.
 *
 * Drives complete runs with a scripted bot and reports what actually happened.
 * It changes no balance value: it exists to produce the numbers the design
 * decisions are missing, so a human can decide.
 *
 * Environment knobs (defaults are a smoke-sized matrix):
 *   BALANCE_SEEDS=1,2,3        seeds to run per cell
 *   BALANCE_CLASSES=warrior   comma separated
 *   BALANCE_DIFFS=normal       comma separated
 *   BALANCE_FRAMES=60000      per-run frame cap before truncation
 *
 * Run: npx playwright test tests/e2e/balance.spec.js --project=chromium
 */

const CLASSES = (process.env.BALANCE_CLASSES || 'warrior').split(',').filter(Boolean);
const DIFFS = (process.env.BALANCE_DIFFS || 'normal').split(',').filter(Boolean);
const SEEDS = (process.env.BALANCE_SEEDS || '1').split(',').filter(Boolean);
const MAX_FRAMES = parseInt(process.env.BALANCE_FRAMES || '60000', 10);
const REPORT = path.join(__dirname, '..', 'balance', 'report.md');

/**
 * One run, entirely inside the page. Takes its options as a JSON string
 * because passing an object into evaluate trips this environment's
 * deserialiser ("refs.set is not a function").
 */
const RUN = (optsJson) => {
  const { cls, diff, seed, maxFrames } = JSON.parse(optsJson);
  // The game calls Math.random() in ~128 places outside SeedSystem (NPC spawns,
  // ambient particles, log lines), so seeding SeedSystem alone does not make a
  // run reproducible. Replace Math.random with a seeded PRNG for the run.
  Math.random = (() => { let a = 0; for (const ch of String(seed)) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0; a = (a ^ 0x9e3779b9) | 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  // A run must not inherit the previous run's saved state: the mid-run
  // autosave would otherwise leak maxHp, gold and unlocks into the next sample.
  try { localStorage.clear(); } catch (e) { /* private mode */ }

  // Only the warrior is available on a fresh save: MetaSystem.isClassUnlocked
  // gates the rest behind meta purchases, and start() returns without creating
  // a player. Unlock them through the game's own model so the matrix can
  // compare classes and no cell silently reports a failed start.
  if (window.MetaSystem) {
    MetaSystem._ensure();
    MetaSystem.data = MetaSystem.data || {};
    MetaSystem.data.unlocked = { class_rogue: true, class_mage: true, class_elf: true };
  }
  GameSettings.hitstopEnabled = false;   // hitstop burns frames without simulating
  GameSettings.aimAssist = false;        // the bot aims explicitly
  GameSettings.controlType = 'touch';    // pollMouse zeroes Input.right otherwise
  GameSettings.controlTypeAuto = false;
  GameSettings.particlesEnabled = false;
  window.setDifficulty(diff);
  window.SeedSystem.setSeedString('balance-' + seed);

  window.GameBootstrap.start(cls);
  if (!window.player) return JSON.stringify({ error: 'start failed', cls, diff, seed });
  // The continue screen runs on a 1s setInterval, not on frames, so a
  // frame-driven run would stall on it. One life per run: the useful signal
  // is which floor the run ends on.
  window.continuesLeft = 0;

  // The game keeps no per-run counter for ability use, so count it here.
  // Both methods early-return when their cooldown is still running, so the
  // only honest signal is whether the cooldown actually got set.
  let skills = 0, dodges = 0;
  const rawUse = player.useSkill.bind(player);
  const rawDodge = player.dodge.bind(player);
  player.useSkill = function () { const before = this.skillCooldown; const r = rawUse(); if (this.skillCooldown > before) skills++; return r; };
  player.dodge = function () { const before = this.dodgeCooldown; const r = rawDodge(); if (this.dodgeCooldown > before) dodges++; return r; };

  const m = {
    cls, diff, seed, outcome: 'truncated', floor: 1, kills: 0, frames: 0,
    seconds: 0, skills: 0, dodges: 0, damageTaken: 0, gold: 0, level: 1,
    deathFloor: 0, firstPurchaseFrame: null, firstBossFrame: null,
    maxHp: 0, finalHp: 0, truncated: false
  };
  let lastHp = player.hp;
  // Stuck detection: the bot has no pathfinding, so a wall between it and the
  // target makes it grind against the same tile. Track movement and bias
  // sideways when it stops making progress.
  let prevX = player.x, prevY = player.y, stillFrames = 0, slide = 0, slideX = 0, slideY = 0;

  for (let f = 0; f < maxFrames; f++) {
    // The camp panel auto-opens at the portal and pauses update(). Buy while it
    // is open, then descend, so a run never stalls waiting for input.
    if (window.CampSystem && CampSystem.state) {
      const items = ShopSystem.getActiveItems(dungeonLevel) || [];
      const affordable = items.filter(i => player.currency >= i.cost);
      if (affordable.length) UIManager.buyItem(affordable[0].id, 1);
      CampSystem.descend();
    }
    // A boss kill opens a boon picker and parks the game in REWARD. Always
    // take the first option: the harness measures progression, and a choice
    // needs a rule to be comparable across cells.
    if (gameState === 'REWARD') { if (window.BossRewardSystem) BossRewardSystem.choose(0); else { m.outcome = 'stalled'; m.stallState = 'REWARD'; break; } }
    if (gameState === 'GAME_OVER') { m.outcome = 'died'; m.deathFloor = dungeonLevel; break; }
    if (gameState === 'WIN') { m.outcome = 'won'; break; }
    // A state other than PLAYING that is neither death nor victory means the
    // run stopped on something the harness does not drive (a cutscene, a reward
    // screen, a panel). That is a stalled run, not a run that used its frames.
    if (gameState !== 'PLAYING') { m.outcome = 'stalled'; m.stallState = gameState; break; }

    m.frames = f;
    m.floor = dungeonLevel;
    if (bossActive && m.firstBossFrame === null) m.firstBossFrame = f;
    if (ShopSystem.purchaseHistory.length > 0 && m.firstPurchaseFrame === null) m.firstPurchaseFrame = f;

    if (player.hp < lastHp) m.damageTaken += lastHp - player.hp;
    lastHp = player.hp;

    // --- bot policy -------------------------------------------------------
    // entities[] holds the player as well as the enemies, so the player has to
    // be excluded or it is always its own nearest target and never moves.
    let best = null, bestD = Infinity, enemyCount = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (!e || !e.alive || e === player) continue;
      enemyCount++;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    const portal = window.dungeonPortal;
    let mx = 0, my = 0;
    if (best) {
      // An enemy standing exactly on the player gives no direction to follow.
      const dx = bestD < 2 ? 1 : (best.x - player.x) / bestD;
      const dy = bestD < 2 ? 0 : (best.y - player.y) / bestD;
      // Warrior has to close inside its 80px melee; the ranged classes are
      // better at distance. Melee range is CONFIG.WARRIOR_MELEE_RANGE.
      const want = player.type === 'warrior' ? 45 : 190;
      const closing = bestD > want;
      mx = dx * (closing ? 1 : -0.9);
      my = dy * (closing ? 1 : -0.9);
      Input.right.active = true;
      Input.right.dx = dx; Input.right.dy = dy;
      // Dodge is a 120px teleport on a 60 frame cooldown. Spamming it every
      // frame the threat is near just flings the bot around the room, so it
      // only dodges when it is actually cornered and the cooldown is ready.
      if (bestD < 45 && player.dodgeCooldown <= 0) player.dodge();
      if (enemyCount >= 3 || best.isBoss) player.useSkill();
    } else if (portal) {
      const d = Math.hypot(portal.x - player.x, portal.y - player.y) || 1;
      mx = (portal.x - player.x) / d;
      my = (portal.y - player.y) / d;
      Input.right.active = false;
    } else {
      mx = 0.5; my = 0.5;
      Input.right.active = false;
    }

    // Grinding against a wall: step sideways for a while, alternating which
    // way, so the bot eventually gets around the obstacle.
    if (slide > 0) { slide--; mx += slideX; my += slideY; }
    Input.left.active = true;
    Input.left.dx = mx; Input.left.dy = my;

    const wasX = player.x, wasY = player.y;
    update();
    if (Math.hypot(player.x - wasX, player.y - wasY) < 0.5) stillFrames++; else stillFrames = 0;
    if (stillFrames === 40) {
      const a = Math.atan2(my, mx) + (Math.random() < 0.5 ? 1.2 : -1.2);
      slideX = Math.cos(a); slideY = Math.sin(a); slide = 60; stillFrames = 0;
    }
    prevX = wasX; prevY = wasY;

    // The floor rebuild (new Map, respawn, dungeonsCompleted++) lives in the
    // fade branch of draw(), and _transitioning is only cleared there. Drawing
    // only while transitioning keeps the run correct and skips the expensive
    // per-frame canvas work.
    if (window._transitioning) draw();
  }
  if (m.outcome === 'truncated') m.truncated = true;

  m.kills = player.kills || 0;
  m.seconds = Math.round(m.frames / 60);
  m.skills = skills; m.dodges = dodges;
  m.gold = player.currency || 0;
  m.level = player.lvl || 1;
  m.maxHp = Math.round(player.maxHp || 0);
  m.finalHp = Math.round(player.hp || 0);
  player.useSkill = rawUse; player.dodge = rawDodge;
  return JSON.stringify(m);
};

async function runOnce(page, cell) {
  // Clear before the game boots, not during the run: page boot loads the
  // previous run's autosave into memory, and clearing storage afterwards
  // would leave that state in place for this run to inherit.
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* private mode */ } });
  await page.goto('/');
  return JSON.parse(await page.evaluate(RUN, JSON.stringify(cell)));
}

test.describe('balance data harness', () => {
  test.describe.configure({ mode: 'serial', timeout: 20 * 60 * 1000 });

  test('the same seed replays identically', async ({ page }) => {
    const cell = { cls: CLASSES[0], diff: DIFFS[0], seed: SEEDS[0], maxFrames: 4000 };
    const a = await runOnce(page, cell);
    const b = await runOnce(page, cell);
    expect(a.error, `run failed: ${JSON.stringify(a)}`).toBeUndefined();
    // The seed governs map, spawns and loot; frame counts must match exactly.
    expect({ ...b, seed: null }).toEqual({ ...a, seed: null });
  });

  test('every cell terminates and reports a result', async ({ page }) => {
    const rows = [];
    for (const cls of CLASSES) {
      for (const diff of DIFFS) {
        for (const seed of SEEDS) {
          rows.push(await runOnce(page, { cls, diff, seed, maxFrames: MAX_FRAMES }));
        }
      }
    }
    for (const r of rows) {
      expect(r.error, `${r.cls}/${r.diff}/${r.seed}`).toBeUndefined();
      expect(typeof r.frames, `${r.cls}/${r.diff}/${r.seed}`).toBe('number');
      expect(r.floor, `${r.cls}/${r.diff}/${r.seed}`).toBeGreaterThanOrEqual(1);
    }
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    const md = render(rows);
    fs.writeFileSync(REPORT, md);
    console.log('\n' + md);
  });
});

function render(rows) {
  const mean = (rs, f) => {
    const v = rs.map(f).filter(n => typeof n === 'number' && !Number.isNaN(n));
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–';
  };
  const pct = (rs, f) => {
    const v = rs.map(f);
    return v.length ? Math.round(v.filter(Boolean).length / v.length * 100) + '%' : '–';
  };
  const secs = f => (f === null || f === undefined ? '–' : Math.round(f / 60) + 's');

  const lines = [];
  lines.push('# Balance data harness — report');
  lines.push('');
  lines.push('Generated by `tests/e2e/balance.spec.js`. No balance value was changed to produce this.');
  lines.push(`Seeds per cell: ${SEEDS.join(', ')}. Frame cap: ${MAX_FRAMES} (~${Math.round(MAX_FRAMES / 60)}s of game time).`);
  lines.push('');
  lines.push('Bot policy, identical for every class: close to 45px (warrior, melee range is 80px) or hold 190px (ranged), back off when nearer than that, always aim at the nearest enemy, dodge only when cornered inside 45px and off cooldown, use the ability when 3+ enemies are up or a boss is present, walk to the portal when the floor is clear, buy the first affordable shop item whenever camp opens, and step sideways for a second whenever movement stalls against a wall.');
  lines.push('');
  lines.push('| class | diff | seed | outcome | floor | kills | time s | skills | dodges | dmg taken | lvl | first shop | first boss |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${r.cls} | ${r.diff} | ${r.seed} | ${r.outcome}${r.truncated ? ' (cap)' : ''}${r.stallState ? ' [' + r.stallState + ']' : ''} | ${r.floor} | ${r.kills} | ${r.seconds} | ${r.skills} | ${r.dodges} | ${r.damageTaken} | ${r.level} | ${secs(r.firstPurchaseFrame)} | ${secs(r.firstBossFrame)} |`);
  }
  lines.push('');
  lines.push('## Averages per cell');
  lines.push('');
  lines.push('| class | diff | runs | floor | kills | time s | skills | dodges | dmg taken | won |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const c of CLASSES) for (const d of DIFFS) {
    const rs = rows.filter(r => r.cls === c && r.diff === d);
    if (!rs.length) continue;
    lines.push(`| ${c} | ${d} | ${rs.length} | ${mean(rs, r => r.floor)} | ${mean(rs, r => r.kills)} | ${mean(rs, r => r.seconds)} | ${mean(rs, r => r.skills)} | ${mean(rs, r => r.dodges)} | ${mean(rs, r => r.damageTaken)} | ${pct(rs, r => r.outcome === 'won')} |`);
  }
  lines.push('');
  lines.push('## How to read this');
  lines.push('');
  lines.push('- `truncated` means the run used the whole frame cap, so its numbers are a floor on progress, not a finish. Raise `BALANCE_FRAMES` to look closer.');
  lines.push('- `stalled` means the run stopped on a state the harness does not drive (a cutscene, a reward screen). That is a harness limitation, not a game freeze.');
  lines.push('- A cell that never reaches a shop is not a balance bug: the bot only spends at camp, and camp opens when a floor is cleared.');
  lines.push('- Ability use is counted by the harness because the game keeps no per-run counter for it.');
  lines.push('- The bot has no pathfinding. It beelines at the nearest enemy, so a wall between them means no damage that frame. Its numbers compare cells against each other; they do not predict how a human plays.');
  return lines.join('\n') + '\n';
}
