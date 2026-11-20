'use strict';

// Cenários de gameplay de Sombras de Krevathorn.
//
// Cada cenário é { nome, codigo, verificar }:
//   - codigo: expressão JS async (string) avaliada dentro da página por tests/rodar.js.
//     Roda em modo toque/botão, para o input do script ser respeitado pelo jogo,
//     e devolve um objeto JSON com números + o que o cenário mediu.
//   - verificar(resultado): roda no Node, recebe esse objeto e devolve a lista de
//     falhas (lista vazia = passou).
//
// O jogo será corrigido para caber nestes limites; eles não se ajustam ao jogo.

// Base comum de preparo: pula a abertura, começa a run, fecha o prólogo e força
// o controle de toque com ataque por botão (é o que faz o jogo aceitar o input).
const PREPARO = `
if (window.OpeningSystem && OpeningSystem.skip) { try { OpeningSystem.skip(); } catch (e) {} }
try { window._originalStartGame('mage'); } catch (e) { return { erro: 'start: ' + e.message }; }
await new Promise(r => setTimeout(r, 2500));
if (window.PrologueSystem && PrologueSystem.close) { try { PrologueSystem.close(); } catch (e) {} }
if (window.OpeningSystem && OpeningSystem.skip) { try { OpeningSystem.skip(); } catch (e) {} }
gameState = 'PLAYING';
GameSettings.controlType = 'touch'; GameSettings.controlTypeAuto = false;
GameSettings.attackMode = 'button'; GameSettings.attackModeChosen = true;
`;

// Canto livre do mapa, com 140 px de folga à direita: o projétil não nasce na parede.
const ACHAR_CANTO = `
const TS = CONFIG.TILE_SIZE;
let px = null, py = null;
for (let ty = 2; ty < map.height - 2 && px === null; ty++) {
  for (let tx = 2; tx < map.width - 4; tx++) {
    const x = tx * TS + TS / 2, y = ty * TS + TS / 2;
    if (!map.isWall(x, y) && !map.isWall(x + 80, y) && !map.isWall(x + 140, y)) { px = x; py = y; break; }
  }
}
if (px === null) return { erro: 'nenhum canto livre no mapa' };
`;

// Mundo limpo: só o herói e (quando houver) o alvo. Nada de projétil, perigo ou coleta antigos.
const LIMPAR_MUNDO = `
entities = [player]; bullets = []; particles = []; hazards = []; pickups = []; chests = []; guidedBullets = [];
`;

// Medição de congelamento: 600 ticks com alvo à direita, reposto a cada tick.
function cenarioCongelamento(opcoes) {
  const arma = String(opcoes.arma);
  const skills = JSON.stringify(opcoes.skills || {});
  const elite = opcoes.elite ? 'true' : 'false';
  const boss = opcoes.boss ? 'true' : 'false';

  return `(async () => {
${PREPARO}
${ACHAR_CANTO}
// Alvo parado à direita do herói: não morre, não anda e não ataca
const alvo = new Enemy(px + 80, py, ${boss}, 'melee');
alvo.maxHp = alvo.hp = 1e9; alvo.s = 0; alvo.elite = ${elite};

${LIMPAR_MUNDO}entities = [player, alvo];
player.hp = player.maxHp = 1e9;
player.x = px; player.y = py;
player.frozen = 0;
player.elementalStatuses = [];
player.skills = ${skills};
const arma = CONFIG.WEAPONS_MAGE[${arma}];
if (window.WeaponSystem && WeaponSystem.applyWeapon) { try { WeaponSystem.applyWeapon(player, arma); } catch (e) {} }
player.weaponDamageMult = arma.damageMult;
player.weaponFireRateMult = arma.fireRate;
player.weaponRangeMult = arma.range;
player.heatMaxBonus = 0;
player.attackHeat = 0;
player.overheated = false;
player.scd = 0;
player.chainStep = 0;
player.chainTimer = 0;
Input.right.active = true; Input.right.dx = 1; Input.right.dy = 0;

let congelado = 0, maiorCadeia = 0, cadeia = 0, jogadorCongelado = 0, tiros = 0;
for (let i = 0; i < 600; i++) {
  alvo.hp = alvo.maxHp = 1e9;
  alvo.s = 0;
  alvo.x = player.x + 80; alvo.y = player.y;
  player.x = px; player.y = py;
  entities = entities.filter(e => e === player || e === alvo);
  Input.right.active = true; Input.right.dx = 1; Input.right.dy = 0;
  const antes = bullets.length;
  update();
  if (bullets.length > antes) tiros += bullets.length - antes;
  if (alvo.frozen > 0) { congelado++; cadeia++; if (cadeia > maiorCadeia) maiorCadeia = cadeia; } else { cadeia = 0; }
  if (player.frozen > 0) jogadorCongelado++;
}
return { tiros, uptime: congelado / 600, maiorCadeia, jogadorCongelado };
})()`;
}

const cenarios = [
  {
    nome: 'mago_cetro_comum',
    codigo: cenarioCongelamento({ arma: 1, skills: { frostWave: true, frostTouch: true } }),
    verificar(r) {
      const falhas = [];
      if (!(r.uptime <= 0.55)) falhas.push('uptime ' + r.uptime + ' acima de 0,55');
      if (!(r.maiorCadeia <= 125)) falhas.push('maior cadeia ' + r.maiorCadeia + ' acima de 125 ticks');
      return falhas;
    }
  },
  {
    nome: 'mago_cetro_elite',
    codigo: cenarioCongelamento({ arma: 1, skills: { frostWave: true, frostTouch: true }, elite: true }),
    verificar(r) {
      const falhas = [];
      if (!(r.uptime <= 0.40)) falhas.push('uptime ' + r.uptime + ' acima de 0,40');
      if (!(r.maiorCadeia <= 65)) falhas.push('maior cadeia ' + r.maiorCadeia + ' acima de 65 ticks');
      return falhas;
    }
  },
  {
    nome: 'mago_cetro_chefe',
    codigo: cenarioCongelamento({ arma: 1, skills: { frostWave: true, frostTouch: true }, boss: true }),
    verificar(r) {
      const falhas = [];
      if (!(r.uptime <= 0.30)) falhas.push('uptime ' + r.uptime + ' acima de 0,30');
      if (!(r.maiorCadeia <= 35)) falhas.push('maior cadeia ' + r.maiorCadeia + ' acima de 35 ticks');
      return falhas;
    }
  },
  {
    nome: 'mago_cajado_sem_autocongelamento',
    codigo: cenarioCongelamento({ arma: 3, skills: {} }),
    verificar(r) {
      const falhas = [];
      if (r.jogadorCongelado !== 0) falhas.push('herói congelado em ' + r.jogadorCongelado + ' ticks (o próprio gelo não pode congelar quem lançou)');
      return falhas;
    }
  },
  {
    nome: 'gelo_status_e_lentidao',
    codigo: `(async () => {
${PREPARO}
${ACHAR_CANTO}
const alvo = new Enemy(px + 80, py, false, 'melee');
alvo.maxHp = alvo.hp = 1e9; alvo.s = 0;
${LIMPAR_MUNDO}entities = [player, alvo];
player.hp = player.maxHp = 1e9;
player.x = px; player.y = py;
player.frozen = 0;
player.elementalStatuses = [];
player.skills = {};
player.scd = 999999;
Input.right.active = false;
// Uma única aplicação de gelo: não é para congelar, é para deixar o alvo lento
ElementalSystem.applyStatus(alvo, 'ice', 1, 300);
let congeladoTicks = 0;
for (let i = 0; i < 30; i++) {
  alvo.hp = alvo.maxHp = 1e9;
  alvo.s = 0;
  alvo.x = px + 80; alvo.y = py;
  player.x = px; player.y = py;
  entities = entities.filter(e => e === player || e === alvo);
  update();
  if (alvo.frozen > 0) congeladoTicks++;
}
return {
  frozen: alvo.frozen,
  congeladoTicks,
  slowT: alvo._slowT || 0,
  slowF: alvo._slowF || 1,
  statuses: (alvo.elementalStatuses || []).map(s => s.type + ':' + (s.stacks || 0)).join(',')
};
})()`,
    verificar(r) {
      const falhas = [];
      if (r.frozen !== 0) falhas.push('1 carga de gelo congelou o alvo (frozen ' + r.frozen + ')');
      if (!(r.slowT > 0)) falhas.push('alvo não ficou lento (_slowT ' + r.slowT + ')');
      return falhas;
    }
  },
  {
    nome: 'cristal_so_com_acerto',
    codigo: `(async () => {
${PREPARO}
${ACHAR_CANTO}
const alvo = new Enemy(px + 80, py, false, 'melee');
alvo.maxHp = alvo.hp = 1e9; alvo.s = 0; alvo.frozen = 0; alvo._freezeImmuneT = 0;
${LIMPAR_MUNDO}entities = [player, alvo];
player.hp = player.maxHp = 1e9;
player.x = px; player.y = py;
player.skills = {};
player.scd = 999999;
Input.right.active = false;
// Imunidade longa: o cristal de 3 stacks é bloqueado e precisa esperar um acerto novo
alvo._freezeImmuneT = 200;
for (let i = 0; i < 3; i++) ElementalSystem.applyStatus(alvo, 'ice', 1, 400, player);
const stacksAntes = (alvo.elementalStatuses || []).filter(s => s.type === 'ice').reduce((n, s) => Math.max(n, s.stacks || 0), 0);
let congeladoSemAcerto = 0, ticks = 0;
while (ticks < 260) {
  alvo.hp = alvo.maxHp = 1e9; alvo.s = 0;
  alvo.x = px + 80; alvo.y = py;
  player.x = px; player.y = py;
  entities = entities.filter(e => e === player || e === alvo);
  update();
  if (alvo.frozen > 0) congeladoSemAcerto++;
  ticks++;
}
const imuneDepois = alvo._freezeImmuneT || 0;
ElementalSystem.applyStatus(alvo, 'ice', 1, 120, player); // um acerto novo, com a imunidade já vencida
return { stacksAntes, congeladoSemAcerto, imuneDepois, congelouNoAcerto: (alvo.frozen || 0) > 0 };
})()`,
    verificar(r) {
      const falhas = [];
      if (r.stacksAntes !== 3) falhas.push('stacks de gelo ' + r.stacksAntes + ' (esperado 3)');
      if (r.congeladoSemAcerto !== 0) falhas.push('cristal disparou sem acerto em ' + r.congeladoSemAcerto + ' ticks');
      if (r.imuneDepois !== 0) falhas.push('imunidade não expirou em 260 ticks (resta ' + r.imuneDepois + ')');
      if (r.congelouNoAcerto !== true) falhas.push('cristal não disparou no acerto depois da imunidade');
      return falhas;
    }
  },
  {
    nome: 'imunidade_pos_congelamento',
    codigo: `(async () => {
${PREPARO}
${ACHAR_CANTO}
const alvo = new Enemy(px + 80, py, false, 'melee');
alvo.maxHp = alvo.hp = 1e9; alvo.s = 0; alvo.frozen = 0; alvo._freezeImmuneT = 0;
${LIMPAR_MUNDO}entities = [player, alvo];
player.hp = player.maxHp = 1e9;
player.x = px; player.y = py;
player.frozen = 0;
player.skills = {};
Input.right.active = false;
const primeira = ElementalSystem.applyFreeze(alvo, 30, player);
const segunda = ElementalSystem.applyFreeze(alvo, 30, player);
let ticks = 0;
while (ticks < 400 && !(alvo.frozen === 0 && alvo._freezeImmuneT === 0)) {
  alvo.hp = alvo.maxHp = 1e9;
  alvo.s = 0;
  alvo.x = px + 80; alvo.y = py;
  player.x = px; player.y = py;
  entities = entities.filter(e => e === player || e === alvo);
  update();
  ticks++;
}
const terceira = ElementalSystem.applyFreeze(alvo, 30, player);
return {
  primeira,
  segunda,
  terceira,
  ticks,
  frozenFim: alvo.frozen,
  immuneFim: alvo._freezeImmuneT,
  statuses: (alvo.elementalStatuses || []).map(s => s.type + ':' + (s.stacks || 0)).join(',')
};
})()`,
    verificar(r) {
      const falhas = [];
      if (r.primeira !== true) falhas.push('primeiro congelamento não pegou');
      if (r.segunda !== false) falhas.push('segundo congelamento pegou dentro da janela de imunidade');
      if (!(r.ticks < 400)) falhas.push('congelamento/imunidade não expirou em 400 ticks (frozen ' + r.frozenFim + ', imunidade ' + r.immuneFim + ')');
      if (r.terceira !== true) falhas.push('depois da janela de imunidade o congelamento deveria pegar de novo');
      return falhas;
    }
  },
  {
    nome: 'heroi_congelado_nao_leva_dobro',
    codigo: `(async () => {
${PREPARO}
${ACHAR_CANTO}
const critOriginal = CONFIG.CRIT_CHANCE_BASE;
const multOriginal = DifficultySystem.getPlayerDamageTakenMult;
let heroiPerdeu = null, alvoPerdeu = null, erro = null;
try {
  CONFIG.CRIT_CHANCE_BASE = 0;                       // nenhum crítico pode mascarar o dano exato
  DifficultySystem.getPlayerDamageTakenMult = () => 1; // isola a regra do congelado da dificuldade salva
  ${LIMPAR_MUNDO}
  player.x = px; player.y = py;
  player.skills = {};
  player.dodgeChance = 0;
  player.shield = 0;
  player.invincibleTimer = 0;
  player.aegisTimer = 0;
  player.orbShieldReady = false;   // mago: escudo de orbe anularia o golpe
  player.orbShieldTimer = 0;
  player.damageTakenMult = 1;
  player.frozen = 60;
  player.hp = player.maxHp = 1000;
  player.takeDamage(100, map, null, true, true);
  heroiPerdeu = 1000 - player.hp;

  const alvo = new Enemy(px + 80, py, false, 'melee');
  alvo.maxHp = alvo.hp = 1000; alvo.s = 0; alvo.frozen = 60;
  entities = [player, alvo];
  alvo.takeDamage(100, map, null, true, true);
  alvoPerdeu = 1000 - alvo.hp;
} catch (e) {
  erro = String((e && e.message) || e);
} finally {
  CONFIG.CRIT_CHANCE_BASE = critOriginal;
  DifficultySystem.getPlayerDamageTakenMult = multOriginal;
}
return { erro, heroiPerdeu, alvoPerdeu };
})()`,
    verificar(r) {
      const falhas = [];
      if (r.erro) falhas.push('erro no cenário: ' + r.erro);
      if (r.heroiPerdeu !== 100) falhas.push('herói congelado perdeu ' + r.heroiPerdeu + ' de vida (esperado exatamente 100)');
      if (r.alvoPerdeu !== 200) falhas.push('inimigo congelado perdeu ' + r.alvoPerdeu + ' de vida (esperado exatamente 200, dano dobrado)');
      return falhas;
    }
  },
  {
    nome: 'smoke_600_ticks',
    codigo: `(async () => {
${PREPARO}
// Smoke: jogo normal, spawn normal, sem mexer no mundo
const inimigosInicio = entities.length;
Input.right.active = true; Input.right.dx = 1; Input.right.dy = 0;
for (let i = 0; i < 600; i++) update();
return { gameState, vivo: !!player.alive, hp: Math.round(player.hp), inimigosInicio, inimigosFim: entities.length };
})()`,
    verificar(r) {
      const falhas = [];
      if (r.gameState !== 'PLAYING') falhas.push('gameState virou "' + r.gameState + '" em 600 ticks de jogo normal');
      if (r.vivo !== true) falhas.push('herói morreu em 600 ticks de jogo normal (hp ' + r.hp + ')');
      return falhas;
    }
  }
];

module.exports = cenarios;
