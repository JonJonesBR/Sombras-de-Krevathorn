const { test, expect } = require('@playwright/test');

async function startRun(page, mode = 'dungeon') {
  await page.goto('/');
  if (mode !== 'dungeon') await page.locator(`.mode-tab[data-mode="${mode}"]`).click();
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
}

test('plan F02-F04 and F28: start options, locked classes, build codes and empty seed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.class-mini-card')).toHaveCount(4);
  await expect(page.locator('.mode-tab')).toHaveCount(2);
  await expect(page.locator('.diff-btn')).toHaveCount(4);

  await page.locator('.diff-btn[data-diff="pesadelo"]').click();
  expect(await page.evaluate(() => DifficultySystem.preset)).toBe('pesadelo');
  await page.locator('.diff-btn[data-diff="normal"]').click();
  await page.locator('.class-mini-card.rogue').click();
  expect(await page.evaluate(() => gameState)).toBe('START');
  await page.locator('#modal-overlay button').first().click();
  await expect(page.locator('#modal-overlay')).toHaveClass(/hidden/);

  await page.locator('#start-options-build summary').click();
  const code = await page.evaluate(() => BuildSystem.encode('warrior', ['tank1']));
  await page.locator('#build-code-input').fill(code);
  await page.locator('#build-apply-btn').click();
  expect(await page.evaluate(() => JSON.stringify(window._pendingBuild))).toBe(JSON.stringify({ c: 'warrior', s: ['tank1'] }));
  await page.locator('#build-code-input').fill('not-a-build');
  await page.locator('#build-apply-btn').click();
  expect(await page.evaluate(() => BuildSystem.decode('not-a-build'))).toBeNull();

  await page.locator('#start-options-seed summary').click();
  await page.locator('#seed-input').fill('');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  expect(await page.evaluate(() => SeedSystem.isSeeded())).toBe(false);
  expect(errors).toEqual([]);
});

test('plan F05-F06: quick and full tutorials advance through their real stage lists', async ({ page }) => {
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').click();
  await page.locator('#tutorial-full-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');

  const result = JSON.parse(await page.evaluate(() => {
    const stageCount = TutorialSystem.STAGES_FULL.length;
    let advances = 0;
    while (TutorialSystem.active && advances < stageCount + 2) {
      TutorialSystem._advanceStage();
      advances++;
    }
    return JSON.stringify({
      stageCount,
      advances,
      active: TutorialSystem.active,
      completed: StorageManager.get('tutorial')?.completed === true
    });
  }));
  expect(result.stageCount).toBe(9);
  expect(result.active).toBe(false);
  expect(result.completed).toBe(true);
  expect(result.advances).toBeLessThanOrEqual(11);
});

test('plan F08-F09 and F12: keyboard movement updates the player and every main panel renders', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startRun(page);
  const movement = JSON.parse(await page.evaluate(() => {
    const directions = [
      { key: 'ArrowRight', dx: 1, dy: 0 },
      { key: 'ArrowLeft', dx: -1, dy: 0 },
      { key: 'ArrowDown', dx: 0, dy: 1 },
      { key: 'ArrowUp', dx: 0, dy: -1 }
    ].map(direction => {
      let clearance = 0;
      for (let distance = 12; distance <= 96 && !map.isWall(player.x + direction.dx * distance, player.y + direction.dy * distance); distance += 12) {
        clearance = distance;
      }
      return { ...direction, clearance };
    }).sort((a, b) => b.clearance - a.clearance);
    return JSON.stringify({ x: player.x, y: player.y, direction: directions[0] });
  }));
  expect(movement.direction.clearance).toBeGreaterThan(24);
  await page.locator('#gameCanvas').focus();
  await page.keyboard.down(movement.direction.key);
  await expect.poll(() => page.evaluate(key => Input.keys[key.toLowerCase()], movement.direction.key)).toBe(true);
  await page.waitForTimeout(350);
  await page.keyboard.up(movement.direction.key);
  const endPosition = JSON.parse(await page.evaluate(() => JSON.stringify({ x: player.x, y: player.y })));
  expect(endPosition.x !== movement.x || endPosition.y !== movement.y).toBe(true);

  const aim = JSON.parse(await page.evaluate(() => {
    const rect = canvas.getBoundingClientRect();
    return JSON.stringify({
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      logicalWidth: width, logicalHeight: height,
      playerX: player.x - camX, playerY: player.y - camY
    });
  }));
  await page.mouse.move(
    aim.left + aim.width * (aim.playerX + 120) / aim.logicalWidth,
    aim.top + aim.height * aim.playerY / aim.logicalHeight
  );
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.up();
  expect(await page.evaluate(() => player.shootAnim)).toBeGreaterThan(0);
  await page.keyboard.down('Shift');
  await page.waitForTimeout(80);
  await page.keyboard.up('Shift');
  expect(await page.evaluate(() => player.dodgeCooldown)).toBeGreaterThan(0);

  const panels = JSON.parse(await page.evaluate(() => {
    const ids = ['shop', 'camp', 'skills', 'stats', 'settings', 'achievements', 'lore', 'daily', 'meta'];
    return JSON.stringify(ids.map(id => {
      UIManager.openPanel(id);
      return {
        id,
        current: UIManager.currentPanel,
        title: document.querySelector('#modal-overlay h2')?.textContent.trim() || '',
        visible: !document.getElementById('modal-overlay').classList.contains('hidden')
      };
    }));
  }));
  expect(panels).toHaveLength(9);
  expect(panels.every(panel => panel.id === panel.current && panel.title && panel.visible)).toBe(true);
  expect(await page.locator('#hp-text').count()).toBe(1);
  expect(await page.locator('#level-badge').count()).toBe(1);
  expect(await page.locator('#dungeon-progress').count()).toBe(1);
  expect(await page.locator('#minimapCanvas').count()).toBe(1);
  expect(errors).toEqual([]);
});

test('plan F30: rapid repeated start input leaves one playable run without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.class-mini-card.warrior').dblclick();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('START');
  await expect(page.locator('#tutorial-prompt')).toBeVisible();
  await page.locator('#tutorial-skip-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  expect(await page.evaluate(() => player.type)).toBe('warrior');
  expect(errors).toEqual([]);
});

test('plan F13-F14: shop purchases, crafting and skill unlocks change run state', async ({ page }) => {
  await startRun(page);
  const result = JSON.parse(await page.evaluate(() => {
    player.currency = 10000;
    ShopSystem.reset();
    const offer = ShopSystem.getActiveItems(dungeonLevel).find(item => item.stock > 0);
    const goldBeforeShop = player.currency;
    UIManager.buyItem(offer.id, 1, false);
    const goldAfterShop = player.currency;
    const weaponBefore = player.weaponLevel;
    const craftSucceeded = CraftSystem.craft('forge_weapon');
    const weaponAfter = player.weaponLevel;
    player.currency = 10000;
    const skillSucceeded = SkillTree.unlock(player, 'tank1');
    return JSON.stringify({
      offerId: offer.id,
      shopSpent: goldBeforeShop - goldAfterShop,
      craftSucceeded,
      weaponBefore,
      weaponAfter,
      skillSucceeded,
      skillUnlocked: player.unlockedSkills.includes('tank1')
    });
  }));
  expect(result.offerId).toBeTruthy();
  expect(result.shopSpent).toBeGreaterThan(0);
  expect(result.craftSucceeded).toBe(true);
  expect(result.weaponAfter).toBe(result.weaponBefore + 1);
  expect(result.skillSucceeded).toBe(true);
  expect(result.skillUnlocked).toBe(true);
});

test('plan F15-F17 and F26: camp, event choice, NPC dialog and bestiary discovery', async ({ page }) => {
  await startRun(page);
  const result = JSON.parse(await page.evaluate(() => {
    player.currency = 10000;
    const beforeHp = player.maxHp - 60;
    player.hp = beforeHp;
    CampSystem.build();
    CampSystem.rest();
    const rested = player.hp > beforeHp && CampSystem.state.restUsed;
    const boon = CampSystem.state.boons[0];
    CampSystem.shrine(0);
    const boonApplied = player.runBoons.includes(boon.id);
    CampSystem.state.eventId = RUN_EVENTS[0].id;
    CampSystem.state.eventResolved = false;
    CampSystem.chooseEvent(0);
    const eventResolved = CampSystem.state.eventResolved;
    CampSystem.descend();

    const npc = new NPC(player.x, player.y, 'oracle');
    NPCSystem.npcs.push(npc);
    npc.update();
    const dialogOpened = NPCInteractionPanel.visible && NPCInteractionPanel.buttons.length > 0;
    if (NPCInteractionPanel.buttons[0]) NPCInteractionPanel.buttons[0].action();
    const oracleAction = npc._oracleUsed === true;
    NPCInteractionPanel.hide();
    Bestiary.discover('melee');
    return JSON.stringify({ rested, boonApplied, eventResolved, dialogOpened, oracleAction, bestiaryKills: Bestiary.getKills('melee') });
  }));
  expect(result.rested).toBe(true);
  expect(result.boonApplied).toBe(true);
  expect(result.eventResolved).toBe(true);
  expect(result.dialogOpened).toBe(true);
  expect(result.oracleAction).toBe(true);
  expect(result.bestiaryKills).toBeGreaterThan(0);
});

test('plan F23-F25 and F33-F34: daily, Abyss, meta progression, mutations, boons and relics', async ({ page }) => {
  await startRun(page, 'abyss');
  const result = JSON.parse(await page.evaluate(() => {
    const challenge = DailyChallenge.getTodayChallenge();
    const dailyCanStart = DailyChallenge.canPlay();
    MetaSystem.data.essence = 1000;
    const unlock = MetaSystem.unlock('class_rogue');
    const purchase = MetaSystem.buy('xp');
    player.addMutation('vampiric');
    const mutationActive = !!player.mutations.vampiric && player.mutations.vampiric.timeLeft > 0;
    const boonApplied = RunBoons.apply(player, 'iron_heart');
    RelicSystem.apply(player, 'trovao');
    dungeonLevel = 20;
    const boss = new Boss(player.x + 100, player.y);
    boss.applyFloorBlueprint(BiomeSystem.getBossBlueprintIndex(dungeonLevel, 'abyss'));
    boss._applyAbyssEvolution(dungeonLevel);
    return JSON.stringify({
      mode: gameMode,
      challenge: !!challenge,
      dailyCanStart,
      unlock: unlock.ok,
      rogueUnlocked: MetaSystem.isClassUnlocked('rogue'),
      purchase: purchase.ok,
      xpTier: MetaSystem.purchases('xp'),
      mutationActive,
      boonApplied,
      relicChainLightning: player.relicChainLightning && player.chainLightning,
      abyssBossPhase: boss.phase
    });
  }));
  expect(result.mode).toBe('abyss');
  expect(result.challenge).toBe(true);
  expect(result.dailyCanStart).toBe(true);
  expect(result.unlock).toBe(true);
  expect(result.rogueUnlocked).toBe(true);
  expect(result.purchase).toBe(true);
  expect(result.xpTier).toBe(1);
  expect(result.mutationActive).toBe(true);
  expect(result.boonApplied).toBe(true);
  expect(result.relicChainLightning).toBe(true);
  expect(result.abyssBossPhase).toBeGreaterThanOrEqual(1);
});

test('plan F18-F21: boss reward, win screen, death continue and saved-run continuation', async ({ page }) => {
  await startRun(page);
  const bossResult = JSON.parse(await page.evaluate(() => {
    dungeonLevel = 10;
    dungeonKills = dungeonKillTarget - 2;
    gameTime = 60;
    _cachedAliveEnemies = 0;
    bossActive = false;
    dungeonPortal = null;
    _transitioning = false;
    _updateEnemySpawning();
    const boss = entities.find(entity => entity.isBoss && entity.alive);
    if (!boss) return JSON.stringify({ spawned: false });
    BossRewardSystem.trigger(boss);
    const shown = BossRewardSystem.active && !document.getElementById('boss-reward-overlay').classList.contains('hidden');
    BossRewardSystem.choose(0);
    const chosen = !BossRewardSystem.active;
    return JSON.stringify({ spawned: true, shown, chosen, bossXpReward: boss.xpReward, expectedBossXpReward: CONFIG.XP_BOSS_REWARD + CONFIG.BOSS_XP_BONUS });
  }));
  expect(bossResult.spawned).toBe(true);
  expect(bossResult.shown).toBe(true);
  expect(bossResult.chosen).toBe(true);
  expect(bossResult.bossXpReward).toBe(bossResult.expectedBossXpReward);

  const death = await page.evaluate(() => {
    continuesLeft = 3;
    player.hp = 0;
    _handlePlayerDeath();
    return JSON.stringify({ state: gameState, continueVisible: !document.getElementById('continue-screen').classList.contains('hidden') });
  });
  expect(JSON.parse(death)).toEqual({ state: 'CONTINUE', continueVisible: true });
  await page.locator('#continue-btn').click();
  await expect.poll(() => page.evaluate(() => gameState)).toBe('PLAYING');
  expect(await page.evaluate(() => player.hp > 0 && continuesLeft === 2)).toBe(true);

  const savedRun = JSON.parse(await page.evaluate(() => {
    SaveSystem.save();
    const hasSave = SaveSystem.hasSave();
    GameBootstrap.continueGame();
    return JSON.stringify({ hasSave, state: gameState, playerExists: !!player, version: SaveSystem.load()?._version });
  }));
  expect(savedRun.hasSave).toBe(true);
  expect(savedRun.state).toBe('PLAYING');
  expect(savedRun.playerExists).toBe(true);
  expect(savedRun.version).toBe(3);
});

test('plan F19: floor transitions, camps and final win complete from a fresh run', async ({ page }) => {
  test.setTimeout(180000);
  await startRun(page);
  const transitions = [];

  for (let i = 0; i < 10; i++) {
    const transition = JSON.parse(await page.evaluate(() => {
      dungeonKills = dungeonKillTarget;
      dungeonPortal = { x: player.x, y: player.y, timer: 0, update() {} };
      _updatePortalAndFloor();
      const campOpened = !!CampSystem.state;
      if (campOpened) {
        CampSystem.descend();
        _updatePortalAndFloor();
      }
      return JSON.stringify({ floor: dungeonLevel, campOpened, transitioning: _transitioning, state: gameState });
    }));
    transitions.push(transition);

    try {
      await expect.poll(() => page.evaluate(() => gameState === 'WIN' || (!_transitioning && gameState === 'PLAYING')), { timeout: 15000 }).toBe(true);
    } catch (error) {
      const state = await page.evaluate(() => JSON.stringify({
        floor: dungeonLevel,
        gameState,
        transitioning: _transitioning,
        fade: _fadeState && { ..._fadeState },
        panel: UIManager.currentPanel,
        camp: !!CampSystem.state,
        descending: CampSystem._descend
      }));
      throw new Error(`${error.message}\nTransition attempt: ${JSON.stringify(transition)}\nLast state: ${state}`);
    }
    if (await page.evaluate(() => gameState === 'WIN')) break;
  }

  const result = JSON.parse(await page.evaluate(() => JSON.stringify({
    state: gameState,
    floor: dungeonLevel,
    winScreen: !document.getElementById('win-screen').classList.contains('hidden'),
    saveCleared: !SaveSystem.hasSave(),
    completedFloors: Statistics.data.dungeonsCompleted
  })));

  expect(transitions.length).toBe(10);
  expect(result).toMatchObject({ state: 'WIN', floor: 11, winScreen: true, saveCleared: true });
  expect(result.completedFloors).toBeGreaterThanOrEqual(9);
  expect(transitions.slice(0, 9).every(floor => floor.campOpened)).toBe(true);
});
