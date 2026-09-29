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

test('timed buffs stored as frame counters survive save and reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  const result = JSON.parse(await page.evaluate(() => {
    SHOP_ITEMS.filter(item => item.id === 'damageBoost' || item.id === 'critPotion').forEach(item => item.effect(player));
    const saved = SaveSystem.save();
    const persisted = JSON.parse(localStorage.getItem(SaveSystem.KEY));
    const reloaded = SaveSystem.load();
    return JSON.stringify({
      saved,
      damageBoost: persisted.damageBoost,
      reloadedDamageBoost: reloaded && reloaded.damageBoost
    });
  }));
  expect(result).toEqual({ saved: true, damageBoost: 1800, reloadedDamageBoost: 1800 });
  expect(errors).toEqual([]);
});


test('a stacked crit bonus above 100% still saves, reloads and is shown as 100%', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  // Full-build crit stack: skills, boons x2, achievements and gear add up past 1.
  const result = JSON.parse(await page.evaluate(() => {
    player.critChance = 1.45;
    const saved = SaveSystem.save();
    const persisted = JSON.parse(localStorage.getItem(SaveSystem.KEY));
    const reloaded = SaveSystem.load();
    return JSON.stringify({ saved, persistedCrit: persisted.critChance, reloadedCrit: reloaded && reloaded.critChance });
  }));
  expect(result).toEqual({ saved: true, persistedCrit: 1.45, reloadedCrit: 1.45 });
  // The roll saturates at 1.0, so the panel must not advertise more than 100%.
  await page.evaluate(() => window.toggleSkillTree());
  await expect(page.locator('.skills-scroll')).toBeVisible();
  const critChipValue = await page.evaluate(() => {
    // Label is "CRÍTICO" (pt) or "CRIT" (en); assert the rendered value, not the wording.
    const label = [...document.querySelectorAll('.skills-scroll div')]
      .find(el => el.children.length === 0 && /^(CRÍTICO|CRIT)$/.test(el.textContent.trim()));
    return label ? label.parentElement.children[1].textContent.trim() : null;
  });
  expect(critChipValue).toBe('100%');
  expect(errors).toEqual([]);
});

test('gamepad actions can be rebound, swap on conflict and survive a reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  // Lock the graphics tier: the auto-quality step re-renders an open settings
  // panel, which would detach the button between hit-test and click.
  await page.evaluate(() => { GameSettings.userSetQuality = true; });

  await page.evaluate(() => window.toggleSettings());
  await expect(page.locator('#settings-panel')).toBeVisible();
  // Every action is exposed as a labelled select, reachable by keyboard/screen reader.
  await expect(page.locator('#gp-ability')).toHaveValue('0');
  await expect(page.locator('#gp-dodge')).toHaveValue('1');
  await expect(page.locator('#gp-pause')).toHaveValue('9');

  // Rebinding through the select is what a keyboard player uses.
  await page.locator('#gp-ability').selectOption('5');
  await expect(page.locator('#gp-ability')).toHaveValue('5');
  await page.locator('#gp-dodge').selectOption('2');
  // Binding a button another action already holds must swap the two, never leave
  // an action unreachable.
  await page.locator('#gp-ability').selectOption('2');
  // Ability now owns 2, so Dodge inherits the 5 that Ability had: no dead action.
  await expect.poll(() => page.evaluate(() => GameSettings.gamepadMap.dodge)).toBe(5);

  // The rebound buttons must actually drive the action: poll on the new indices,
  // not on the hardcoded A/B/Start ones.
  const polled = await page.evaluate(() => {
    const oldDescriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    const oldPlayer = player;
    const oldState = gameState;
    const oldPauseToggle = PauseSystem.toggle;
    const oldButtons = Input._gamepadButtons;
    const counts = { ability: 0, dodge: 0, pause: 0 };
    const buttons = Array.from({ length: 10 }, () => ({ pressed: false, value: 0 }));
    const pad = { axes: [0, 0, 0, 0], buttons };
    try {
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
      GameSettings.controlType = 'gamepad';
      GameSettings.setGamepadAction('ability', 5);
      GameSettings.setGamepadAction('dodge', 2);
      GameSettings.setGamepadAction('pause', 7);
      Input._gamepadButtons = [];
      player = { useSkill() { counts.ability++; }, dodge() { counts.dodge++; } };
      PauseSystem.toggle = () => { counts.pause++; };
      gameState = 'PLAYING';
      // Only the rebound indices: the hardcoded A/B/Start ones must do nothing.
      [2, 5, 7].forEach(i => { buttons[i] = { pressed: true, value: 1 }; });
      Input.pollGamepad();
      const rebound = JSON.stringify(counts);
      [2, 5, 7].forEach(i => { buttons[i] = { pressed: false, value: 0 }; });
      counts.ability = 0; counts.dodge = 0; counts.pause = 0;
      Input.pollGamepad();
      // And the old default indices must now be inert.
      [0, 1, 9].forEach(i => { buttons[i] = { pressed: true, value: 1 }; });
      Input.pollGamepad();
      return rebound + '|' + JSON.stringify(counts);
    } finally {
      if (oldDescriptor) Object.defineProperty(navigator, 'getGamepads', oldDescriptor);
      else delete navigator.getGamepads;
      player = oldPlayer;
      gameState = oldState;
      PauseSystem.toggle = oldPauseToggle;
      Input._gamepadButtons = oldButtons;
    }
  });
  const [rebound, defaults] = polled.split('|').map(JSON.parse);
  expect(rebound).toEqual({ ability: 1, dodge: 1, pause: 1 });
  expect(defaults).toEqual({ ability: 0, dodge: 0, pause: 0 });

  // The stored map survives a save/load round trip.
  const roundTrip = JSON.parse(await page.evaluate(() => {
    GameSettings.save();
    const before = JSON.stringify(GameSettings.gamepadMap);
    GameSettings.gamepadMap = { ability: 0, dodge: 1, pause: 9 };
    GameSettings.load();
    return JSON.stringify({ before, after: JSON.stringify(GameSettings.gamepadMap) });
  }));
  expect(roundTrip.after).toBe(roundTrip.before);

  // Unknown indices from a corrupted blob fall back instead of breaking input.
  const guarded = await page.evaluate(() => {
    StorageManager.setRaw('settings', JSON.stringify({ controlType: 'gamepad', gamepadMap: { ability: 99, dodge: 'x' } }));
    GameSettings.load();
    return JSON.stringify(GameSettings.gamepadMap);
  });
  expect(guarded).toBe(JSON.stringify({ ability: 0, dodge: 1, pause: 9 }));

  // The tutorial must describe the buttons the player actually has, not A/B/Start.
  const tutorial = await page.evaluate(() => {
    GameSettings.setGamepadAction('ability', 5);
    GameSettings.setGamepadAction('dodge', 2);
    GameSettings.setGamepadAction('pause', 7);
    GameSettings.controlType = 'gamepad';
    return TutorialSystem._stageLines({ id: 'welcome_quick', linesKeys: ['x'], lines: ['x'] }).join(' ');
  });
  expect(tutorial).not.toContain('{');
  expect(tutorial).toMatch(/\bRB\b/);
  expect(tutorial).toMatch(/\bX\b/);
  expect(tutorial).toMatch(/\bRT\b/);

  // Capture mode: "Remap" arms the action, then the next pad press binds it. The
  // button held to reach the screen must not be captured as the new binding.
  await page.evaluate(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__gpButtons = buttons;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [{ axes: [0, 0, 0, 0], buttons: window.__gpButtons }]
    });
    window.__gpButtons[6] = { pressed: true, value: 1 };
  });
  // The auto-quality step can re-render the open panel; refresh so the click
  // lands on the live node instead of a detached one.
  const beforeCapture = await page.evaluate(() => JSON.stringify(GameSettings.gamepadMap));
  await page.locator('#gp-remap-ability').click();
  await expect.poll(() => page.evaluate(() => !!(SettingsUI._remapState && SettingsUI._remapTimer))).toBe(true);
  // The button already held when arming is the baseline, not a new binding.
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => JSON.stringify(GameSettings.gamepadMap))).toBe(beforeCapture);
  await page.evaluate(() => { window.__gpButtons[6] = { pressed: false, value: 0 }; window.__gpButtons[3] = { pressed: true, value: 1 }; });
  await expect.poll(() => page.evaluate(() => GameSettings.gamepadMap.ability)).toBe(3);
  // Capture must not leave a timer running behind the closed panel.
  await page.evaluate(() => window.SettingsUI.close());
  expect(await page.evaluate(() => JSON.stringify({ state: SettingsUI._remapState, timer: SettingsUI._remapTimer }))).toBe('{"state":null,"timer":null}');

  await page.locator('#settings-reset-btn').waitFor();
  const afterReset = await page.evaluate(() => {
    window.SettingsUI._resetGamepadMap();
    return JSON.stringify(GameSettings.gamepadMap);
  });
  expect(afterReset).toBe(JSON.stringify({ ability: 0, dodge: 1, pause: 9 }));
  expect(errors).toEqual([]);
});

test('the first settings click after leaving gamepad mode is not swallowed', async ({ page }) => {
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  // Auto-adapting from gamepad to mouse re-renders the panel on mousedown; if
  // that happens inline the control is replaced before mouseup and the click
  // never completes, so the first tap on any setting does nothing.
  await page.evaluate(() => {
    GameSettings.userSetQuality = true;
    GameSettings.controlType = 'gamepad';
    GameSettings.controlTypeAuto = true;
  });
  await page.evaluate(() => window.toggleSettings());
  await expect(page.locator('#settings-panel')).toBeVisible();
  // A real pointer click, not selectOption: this is the path that goes through
  // mousedown and therefore through adaptTo().
  await page.locator('#gp-remap-dodge').click();
  await expect.poll(() => page.evaluate(() => !!(SettingsUI._remapState && SettingsUI._remapTimer))).toBe(true);
  expect(await page.evaluate(() => GameSettings.controlType)).toBe('mouse');
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

  if (browserName === 'webkit') {
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

test('game panels announce a modal, contain keyboard focus and restore focus in every language', async ({ page }) => {
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');

  for (const [locale, closeLabel] of [['pt', 'Fechar diálogo'], ['en', 'Close dialog'], ['es', 'Cerrar diálogo']]) {
    await page.evaluate(code => I18n.setLang(code), locale);
    await page.locator('#shop-btn-bar').focus();
    await page.evaluate(() => UIManager.openPanel('shop'));

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'game-dialog-title');
    await expect(page.locator('#modal-overlay')).toHaveAttribute('aria-hidden', 'false');
    const closeButton = dialog.getByRole('button', { name: closeLabel });
    await expect(closeButton).toBeFocused();

    const focusable = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    await focusable.last().focus();
    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-overlay')).toBeHidden();
    await expect(page.locator('#modal-overlay')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#shop-btn-bar')).toBeFocused();
  }
});

test('pause settings expose modal focus, localized option states and audio labels', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => I18n.setLang('pt'));
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');

  await page.evaluate(() => {
    GameSettings.sfxEnabled = false;
    GameSettings.musicEnabled = false;
    GameSettings.save();
    PauseSystem.pause();
  });
  await page.locator('#pause-settings').focus();
  await page.keyboard.press('Enter');

  const settings = page.locator('#settings-panel');
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute('role', 'dialog');
  await expect(settings).toHaveAttribute('aria-modal', 'true');
  await expect(settings).toHaveAttribute('aria-labelledby', 'settings-dialog-title');
  await expect(settings).toHaveAttribute('aria-hidden', 'false');
  await expect(settings.locator('#settings-dialog-title')).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Som (SFX): Desligado' })).toHaveAttribute('aria-pressed', 'true');
  await expect(settings.getByRole('button', { name: 'Som (SFX): Ligado' })).toHaveAttribute('aria-pressed', 'false');
  await expect(settings.getByText('Som (SFX)', { exact: true })).toBeVisible();
  await expect(settings.getByText('Música', { exact: true })).toBeVisible();

  for (const [locale, sfxLabel, sfxOff, musicLabel, musicOff, fontLabel, fontSmall] of [
    ['pt', 'Som (SFX)', 'Desligado', 'Música', 'Desligada', 'Tamanho da Fonte', 'Pequena'],
    ['en', 'Sound (SFX)', 'Off', 'Music', 'Off', 'Font Size', 'Small'],
    ['es', 'Sonido (SFX)', 'Desactivado', 'Música', 'Desactivada', 'Tamaño de Fuente', 'Pequeña']
  ]) {
    await page.evaluate(code => I18n.setLang(code), locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(settings.getByText(sfxLabel, { exact: true })).toBeVisible();
    await expect(settings.getByText(musicLabel, { exact: true })).toBeVisible();
    await expect(settings.getByRole('button', { name: `${sfxLabel}: ${sfxOff}` })).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.getByRole('button', { name: `${musicLabel}: ${musicOff}` })).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.getByRole('button', { name: `${fontLabel}: ${fontSmall}` })).toHaveAttribute('aria-pressed', 'false');
    await expect(settings.locator('button[aria-pressed]')).not.toHaveCount(0);
  }

  const unlabeledSelections = JSON.parse(await page.evaluate(() => {
    const panel = document.getElementById('settings-panel');
    const close = panel.querySelector('.settings-box > button:last-child');
    return JSON.stringify(Array.from(panel.querySelectorAll('.settings-box button'))
      .filter(button => button !== close && button.id !== 'settings-reset-btn' && button.id !== 'settings-gp-reset-btn' && !button.hasAttribute('aria-pressed'))
      .map(button => button.textContent.trim()));
  }));
  expect(unlabeledSelections).toEqual([]);

  await page.evaluate(() => I18n.setLang('pt'));
  const sfxOn = settings.getByRole('button', { name: 'Som (SFX): Ligado' });
  await sfxOn.focus();
  await page.keyboard.press('Enter');
  await expect(sfxOn).toBeFocused();
  await expect(sfxOn).toHaveAttribute('aria-pressed', 'true');
  await expect(settings.getByRole('button', { name: 'Som (SFX): Desligado' })).toHaveAttribute('aria-pressed', 'false');

  const firstOption = settings.locator('button[aria-pressed]').first();
  const closeButton = settings.locator('.settings-box > button').last();
  await closeButton.focus();
  await page.keyboard.press('Tab');
  await expect(firstOption).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(settings).toHaveAttribute('aria-hidden', 'true');
  await expect(settings).toHaveAttribute('inert', '');
  await expect(page.locator('#pause-btn-bar')).toBeFocused();

  await page.evaluate(() => UIManager.openPanel('settings'));
  const gameDialog = page.getByRole('dialog');
  await expect(gameDialog).toHaveAttribute('aria-labelledby', 'game-dialog-title');
  await expect(gameDialog.getByRole('button', { name: 'Som (SFX): Ligado' })).toHaveAttribute('aria-pressed', 'true');
  await expect(gameDialog.getByRole('button', { name: 'Som (SFX): Desligado' })).toHaveAttribute('aria-pressed', 'false');
  await expect(gameDialog.locator('button[aria-pressed]')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});
