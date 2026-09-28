const { test, expect } = require('@playwright/test');

test('fresh game opens with all four class choices and no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');

  await expect(page.locator('.class-mini-card')).toHaveCount(4);
  await expect(page.locator('.class-mini-card').first()).toHaveAttribute('type', 'button');
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(await page.evaluate(() => I18n.lang)).toMatch(/^(pt|en|es)$/);
  expect(errors).toEqual([]);
});

test('language changes update visible UI and the document language', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    I18n.setLang('en');
    const english = { lang: document.documentElement.lang, className: document.querySelector('.class-mini-card.warrior [data-i18n="start.classWarrior"]')?.textContent };
    I18n.setLang('es');
    const spanish = { lang: document.documentElement.lang, className: document.querySelector('.class-mini-card.warrior [data-i18n="start.classWarrior"]')?.textContent };
    I18n.setLang('pt');
    return JSON.stringify({ english, spanish, portuguese: document.documentElement.lang });
  }));
  expect(result.english.lang).toBe('en');
  expect(result.english.className).toBe('Warrior');
  expect(result.spanish.lang).toBe('es');
  expect(result.spanish.className).toBe('Guerrero');
  expect(result.portuguese).toBe('pt');
});

test('all 55 lore fragments have English and Spanish titles and text', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const missing = { en: [], es: [] };
    for (const locale of ['en', 'es']) {
      I18n.setLang(locale);
      for (const fragment of CONFIG.LORE_FRAGMENTS) {
        const detail = document.createElement('div');
        detail.innerHTML = UIManager.renderLoreDetail(fragment);
        const title = detail.querySelector('h3')?.textContent || '';
        const body = detail.querySelector('div[style*="margin-top:16px"]')?.textContent || '';
        if (!title || !body || body === fragment.text) missing[locale].push(fragment.id);
      }
    }
    I18n.setLang('en');
    const english = UIManager.renderLoreDetail(CONFIG.LORE_FRAGMENTS[0]);
    I18n.setLang('es');
    const spanish = UIManager.renderLoreDetail(CONFIG.LORE_FRAGMENTS[0]);
    return JSON.stringify({ count: CONFIG.LORE_FRAGMENTS.length, missing, englishHasTranslation: english.includes('The Fall of Krevathorn') && english.includes('A thousand years ago'), spanishHasTranslation: spanish.includes('La caída de Krevathorn') && spanish.includes('Hace mil años') });
  }));
  expect(result.count).toBe(55);
  expect(result.missing).toEqual({ en: [], es: [] });
  expect(result.englishHasTranslation).toBe(true);
  expect(result.spanishHasTranslation).toBe(true);
});

test('tutorial length and instructions match the selected controls', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const oldMode = TutorialSystem.mode;
    const oldControl = GameSettings.controlType;
    try {
      TutorialSystem.mode = 'full';
      GameSettings.controlType = 'mouse';
      const welcome = TutorialSystem._stageLines(TutorialSystem.STAGES_FULL[0])[0];
      const mouseMove = TutorialSystem._stageLines(TutorialSystem.STAGES_FULL.find(stage => stage.id === 'movement')).join(' ');
      GameSettings.controlType = 'gamepad';
      const gamepadMove = TutorialSystem._stageLines(TutorialSystem.STAGES_FULL.find(stage => stage.id === 'movement')).join(' ');
      return JSON.stringify({ quickStages: TutorialSystem.STAGES_QUICK.length, fullStages: TutorialSystem.STAGES_FULL.length, welcome, mouseMove, gamepadMove });
    } finally {
      TutorialSystem.mode = oldMode;
      GameSettings.controlType = oldControl;
    }
  }));
  expect(result.quickStages).toBe(6);
  expect(result.fullStages).toBe(9);
  expect(result.welcome).toMatch(/9 etapas|9 steps|9 pasos|9 stages/i);
  expect(result.mouseMove).toMatch(/W\s*A\s*S\s*D/i);
  expect(result.mouseMove).toMatch(/arrow|setas|flechas/i);
  expect(result.gamepadMove).toMatch(/stick|controle|palanca/i);
});

test('a new run can start from the class selection', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await expect(page.locator('#tutorial-prompt')).toBeVisible();
  await page.locator('#tutorial-skip-btn').click();

  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  expect(await page.evaluate(() => player && player.lvl)).toBe(1);
  expect(errors).toEqual([]);
});

test('a player-source enemy kill grants XP and increments the kill counter once', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  const result = JSON.parse(await page.evaluate(() => {
    const previousRandom = SeedSystem.random;
    const previousMathRandom = Math.random;
    const target = new Enemy(player.x + 80, player.y, false, 'melee');
    target.hp = 1;
    target.maxHp = 1;
    entities.push(target);
    const before = { kills: player.kills, totalKills: Statistics.data.totalKills || 0, xp: player.xp };
    try {
      SeedSystem.random = () => 1;
      Math.random = () => 1;
      target.takeDamage(2, map, player);
      return JSON.stringify({ kills: player.kills - before.kills, totalKills: (Statistics.data.totalKills || 0) - before.totalKills, xpGained: player.xp - before.xp, targetAlive: target.alive });
    } finally {
      SeedSystem.random = previousRandom;
      Math.random = previousMathRandom;
    }
  }));
  expect(result.kills).toBe(1);
  expect(result.totalKills).toBe(1);
  expect(result.xpGained).toBeGreaterThan(0);
  expect(result.targetAlive).toBe(false);
  expect(errors).toEqual([]);
});

test('save migration and validation preserve compatible data and reject future schemas', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const migrated = SaveSystem.prepare({ _version: 2, type: 'warrior', lvl: 4, xp: 12, equipment: {} });
    const futureRaw = JSON.stringify({ _version: SaveSystem.VERSION + 1, type: 'warrior' });
    localStorage.setItem(SaveSystem.KEY, futureRaw);
    const rejected = SaveSystem.load() === null;
    const futurePreserved = localStorage.getItem(SaveSystem.KEY) === futureRaw;
    const corruptRaw = '{not valid json';
    localStorage.setItem(SaveSystem.KEY, corruptRaw);
    const corruptRejected = SaveSystem.load() === null;
    const corruptPreserved = localStorage.getItem(SaveSystem.KEY) === corruptRaw;
    return JSON.stringify({ migratedVersion: migrated._version, migratedLevel: migrated.lvl, rejected, futurePreserved, corruptRejected, corruptPreserved });
  }));
  expect(result).toEqual({ migratedVersion: 3, migratedLevel: 4, rejected: true, futurePreserved: true, corruptRejected: true, corruptPreserved: true });
});

test('continuation restores equipment and relic sources when changing weapons', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const oldPlayer = player;
    const oldGameState = gameState;
    try {
      gameState = 'PLAYING';
      const source = new Player(100, 100, 'warrior');
      player = source;
      source.relics.add('vampiro');
      source.relics.add('trovao');
      source.relicChainLightning = true;
      source.lifestealBonus = 0.25;
      const drainingWeapon = CONFIG.WEAPONS_WARRIOR.find(weapon => weapon.lifesteal > 0);
      WeaponSystem.applyWeapon(source, drainingWeapon);
      EquipmentSystem.applyEquipment(source, {
        type: 'equipment', slot: 'ring', rarity: 'Lendario', name: 'Anel de Teste', color: '#ff8800',
        stats: { critChance: 0.1, speedMult: 0.1, equipLifesteal: 0.09 }
      });
      const before = { speed: source.speed, maxHp: source.maxHp, equipment: Object.keys(source.equipment).length };
      const saved = SaveSystem.prepare(SaveSystem._serialize());
      const restored = new Player(100, 100, 'warrior');
      SaveSystem.applyTo(restored, saved);
      const restoredState = {
        speed: restored.speed, maxHp: restored.maxHp, equipment: Object.keys(restored.equipment).length,
        relics: Array.from(restored.relics).sort(), lifesteal: restored.weaponLifesteal,
        equipLifesteal: restored.equipLifesteal, chainLightning: restored.chainLightning
      };
      WeaponSystem.applyWeapon(restored, { name: 'Arma Simples', tier: 0, damageMult: 1, fireRate: 1, range: 1 });
      return JSON.stringify({ before, restoredState, afterSwap: { lifesteal: restored.weaponLifesteal, chainLightning: restored.chainLightning } });
    } finally {
      player = oldPlayer;
      gameState = oldGameState;
    }
  }));
  expect(result.before.equipment).toBe(1);
  expect(result.restoredState.speed).toBeCloseTo(result.before.speed, 5);
  expect(result.restoredState.maxHp).toBe(result.before.maxHp);
  expect(result.restoredState.equipment).toBe(1);
  expect(result.restoredState.relics).toEqual(['trovao', 'vampiro']);
  expect(result.restoredState.lifesteal).toBeCloseTo(0.35, 5);
  expect(result.restoredState.equipLifesteal).toBeCloseTo(0.09, 5);
  expect(result.restoredState.chainLightning).toBe(true);
  expect(result.afterSwap.lifesteal).toBeCloseTo(0.25, 5);
  expect(result.afterSwap.chainLightning).toBe(true);
});

test('gamepad actions fire once per button press', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const oldDescriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    const oldPlayer = player;
    const oldState = gameState;
    const oldControl = GameSettings.controlType;
    const oldPauseToggle = PauseSystem.toggle;
    const oldButtons = Input._gamepadButtons;
    const counts = { ability: 0, dodge: 0, pause: 0 };
    const buttons = Array.from({ length: 10 }, () => ({ pressed: false, value: 0 }));
    const pad = { axes: [0, 0, 0, 0], buttons };
    try {
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
      GameSettings.controlType = 'gamepad';
      Input._gamepadButtons = [];
      player = { useSkill() { counts.ability++; }, dodge() { counts.dodge++; } };
      PauseSystem.toggle = () => { counts.pause++; };
      gameState = 'PLAYING';
      buttons[0] = { pressed: true, value: 1 };
      buttons[1] = { pressed: true, value: 1 };
      buttons[9] = { pressed: true, value: 1 };
      Input.pollGamepad();
      Input.pollGamepad();
      buttons[0] = { pressed: false, value: 0 };
      buttons[1] = { pressed: false, value: 0 };
      buttons[9] = { pressed: false, value: 0 };
      Input.pollGamepad();
      buttons[0] = { pressed: true, value: 1 };
      buttons[1] = { pressed: true, value: 1 };
      buttons[9] = { pressed: true, value: 1 };
      Input.pollGamepad();
      return JSON.stringify(counts);
    } finally {
      if (oldDescriptor) Object.defineProperty(navigator, 'getGamepads', oldDescriptor);
      else delete navigator.getGamepads;
      player = oldPlayer;
      gameState = oldState;
      GameSettings.controlType = oldControl;
      PauseSystem.toggle = oldPauseToggle;
      Input._gamepadButtons = oldButtons;
    }
  }));
  expect(result).toEqual({ ability: 2, dodge: 2, pause: 2 });
});

test('XP multipliers apply and one reward can grant multiple levels', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const oldPlayer = player;
    const oldMaxLevel = Statistics.data.maxLevel;
    const oldPlayLevelUp = SND.playLevelUp;
    const oldParticles = spawnParticles;
    const oldLog = addLog;
    const oldDamageNumbers = DamageNumbers.add;
    const oldLevelUpEffect = ScreenEffects.onLevelUp;
    try {
      player = new Player(100, 100, 'warrior');
      player.xpMult = 2;
      player.gainXP(1);
      const gainedXp = player.xp;
      player.xp = 0;
      player.gainXP(CONFIG.XP_LEVEL_MULTIPLIER * 3);
      return JSON.stringify({ gainedXp, finalLevel: player.lvl, overflowXp: player.xp });
    } finally {
      player = oldPlayer;
      Statistics.data.maxLevel = oldMaxLevel;
      SND.playLevelUp = oldPlayLevelUp;
      spawnParticles = oldParticles;
      addLog = oldLog;
      DamageNumbers.add = oldDamageNumbers;
      ScreenEffects.onLevelUp = oldLevelUpEffect;
    }
  }));
  expect(result.gainedXp).toBe(2);
  expect(result.finalLevel).toBeGreaterThan(2);
  expect(result.overflowXp).toBeGreaterThanOrEqual(0);
});

test('kill objective completes only when its target is reached', async ({ page }) => {
  await page.goto('/');
  const completed = JSON.parse(await page.evaluate(() => {
    const oldPlayer = player;
    const oldObjective = RunObjectiveSystem.current;
    const oldTarget = RunObjectiveSystem.target;
    const oldComplete = RunObjectiveSystem.completed;
    const oldCheck = RunObjectiveSystem._complete;
    try {
      player = { kills: 2 };
      RunObjectiveSystem.current = { id: 'test-kills', metric: 'kills', target: 3 };
      RunObjectiveSystem.target = 3;
      RunObjectiveSystem.completed = false;
      RunObjectiveSystem._complete = function() { this.completed = true; };
      RunObjectiveSystem.onKill();
      const afterTwo = RunObjectiveSystem.completed;
      player.kills = 3;
      RunObjectiveSystem.onKill();
      return JSON.stringify({ afterTwo, afterThree: RunObjectiveSystem.completed });
    } finally {
      player = oldPlayer;
      RunObjectiveSystem.current = oldObjective;
      RunObjectiveSystem.target = oldTarget;
      RunObjectiveSystem.completed = oldComplete;
      RunObjectiveSystem._complete = oldCheck;
    }
  }));
  expect(completed).toEqual({ afterTwo: false, afterThree: true });
});

test('fixed simulation advances at the same rate for 30, 60 and 120 Hz schedules', async ({ page }) => {
  await page.goto('/');
  const counts = JSON.parse(await page.evaluate(() => {
    const originalUpdate = update;
    const originalAccumulator = _simulationAccumulator;
    const result = [];
    for (const hz of [30, 60, 120]) {
      let steps = 0;
      update = () => { steps++; };
      _simulationAccumulator = 0;
      for (let frame = 0; frame < hz; frame++) _advanceSimulation(1000 / hz);
      result.push(steps);
    }
    update = originalUpdate;
    _simulationAccumulator = originalAccumulator;
    return JSON.stringify(result);
  }));
  expect(counts).toEqual([60, 60, 60]);
});

test('daily score uses seconds and early DDA uses only elapsed simulation time', async ({ page }) => {
  await page.goto('/');
  const result = JSON.parse(await page.evaluate(() => {
    const savedTime = gameTime;
    const savedHistory = DifficultySystem.killHistory;
    const savedDailyState = [DailyChallenge._lastPlayedDate, DailyChallenge._completedToday];
    try {
      gameTime = 60;
      DifficultySystem.killHistory = [30];
      const earlyKillsPerSecond = DifficultySystem.getDDAInfo().killsPerSecond;

      const date = DailyChallenge.getTodayChallenge();
      window._currentDailyChallenge = date;
      DailyChallenge._lastPlayedDate = null;
      DailyChallenge._completedToday = false;
      localStorage.removeItem('daily_' + DailyChallenge._todayDate);
      const score = DailyChallenge.complete(2, 120);
      const record = DailyChallenge.getTodayStats();
      return JSON.stringify({ earlyKillsPerSecond, score, timeSeconds: record.timeSeconds, scoreVersion: record.scoreVersion });
    } finally {
      gameTime = savedTime;
      DifficultySystem.killHistory = savedHistory;
      DailyChallenge._lastPlayedDate = savedDailyState[0];
      DailyChallenge._completedToday = savedDailyState[1];
    }
  }));
  expect(result).toEqual({ earlyKillsPerSecond: '1.0', score: 988, timeSeconds: 120, scoreVersion: 2 });
});

test('small viewports keep the start screen within the screen width', async ({ page }) => {
  await page.goto('/');
  const sizes = [];
  for (const viewport of [{ width: 360, height: 640 }, { width: 420, height: 820 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    sizes.push(JSON.parse(await page.evaluate(() => JSON.stringify({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }))));
  }
  expect(sizes.every(size => size.content <= size.viewport)).toBe(true);
});

test('service worker installs the game shell for offline fallback', async ({ page, context, browserName }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  if (browserName === 'webkit' && process.platform === 'win32') {
    const cachedShell = JSON.parse(await page.evaluate(async () => {
      const response = await caches.match('/index.html');
      const html = response ? await response.text() : '';
      return JSON.stringify({ cached: !!response, hasStartScreen: html.includes('class-mini-card') });
    }));
    expect(cachedShell).toEqual({ cached: true, hasStartScreen: true });
    return;
  }

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page.locator('.class-mini-card')).toHaveCount(4);
  } finally {
    await context.setOffline(false);
  }
});
