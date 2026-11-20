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
    // Autosave no meio do fade de troca de andar/câmara: o jogo captura o estado coerente
    // em beginTransitionSnapshot() e o save grava ESSE estado, nunca "andar novo + câmara antiga".
    nome: 'save_durante_transicao',
    codigo: `(async () => {
${PREPARO}
const andarAntes = dungeonLevel, mortesAntes = dungeonKills;
const camaraAntes = _storyRoom ? _storyRoom.i : null;
const transicaoAntes = (typeof _transitioning !== 'undefined') ? _transitioning : false;
if (!_storyRoom) _storyRoom = { i: 2, total: Math.max(2, CONFIG.MAP_STORY_ROOMS), cleared: false, budget: 0, spawned: 0, boss: false };
// Estado anterior: andar 3, câmara 2, 7 abates
_storyRoom.i = 2;
dungeonLevel = 3; dungeonKills = 7;
_transitioning = false;
const snapshot = SaveSystem.beginTransitionSnapshot();

// Mutação que a transição faz depois do snapshot, já com o fade em curso
_transitioning = true;
dungeonLevel = 4; dungeonKills = 0; _storyRoom.i = 3;
const estadoVivoAndar = dungeonLevel, estadoVivoCamara = _storyRoom.i;
const salvou = SaveSystem.save();
let gravado = null;
try {
  const bruto = localStorage.getItem(SaveSystem.KEY);
  gravado = bruto ? JSON.parse(bruto) : null;
} catch (e) { gravado = null; }
SaveSystem._transitionSnapshot = null;
SaveSystem._transitionSavePending = false;
_transitioning = false;
// Limpeza: o estado vivo volta ao de antes (o mapa ativo nunca trocou) e o save é regravado coerente
dungeonLevel = andarAntes; dungeonKills = mortesAntes;
if (camaraAntes === null) _storyRoom = null;
else if (_storyRoom) _storyRoom.i = camaraAntes;
_transitioning = transicaoAntes || false;
try { SaveSystem.save(); } catch (e) {}
return {
  snapshot,
  salvou,
  estadoVivoAndar,
  estadoVivoCamara,
  andar: gravado ? gravado.dungeonLevel : null,
  mortes: gravado ? gravado.dungeonKills : null,
  camara: (gravado && gravado.storyRoom) ? gravado.storyRoom.i : null,
  incoerente: !!(gravado && gravado.dungeonLevel === 4 && gravado.storyRoom && gravado.storyRoom.i === 2)
};
})()`,
    verificar(r) {
      const falhas = [];
      if (r.snapshot !== true) falhas.push('beginTransitionSnapshot não capturou o estado antes da transição');
      if (r.salvou !== true) falhas.push('SaveSystem.save() no meio da transição não gravou nada');
      if (r.estadoVivoAndar !== 4 || r.estadoVivoCamara !== 3) {
        falhas.push('a mutação da transição não chegou ao estado vivo (andar ' + r.estadoVivoAndar + ', câmara ' + r.estadoVivoCamara + ')');
      }
      if (r.andar !== 3) falhas.push('save no meio da transição gravou o andar ' + r.andar + ' (esperado o anterior, 3)');
      if (r.mortes !== 7) falhas.push('save no meio da transição gravou ' + r.mortes + ' abates (esperado o anterior, 7)');
      if (r.camara !== 2) falhas.push('save no meio da transição gravou a câmara ' + r.camara + ' (esperada a anterior, 2)');
      if (r.incoerente) falhas.push('save misturou andar novo (4) com câmara antiga (2)');
      return falhas;
    }
  },
  {
    // Duplo toque no mesmo item do acampamento: 1 item sai da lista, o ouro cai uma vez só.
    nome: 'acampamento_duplo_toque',
    codigo: `(async () => {
${PREPARO}
if (window.UIManager && UIManager.closePanel) { try { UIManager.closePanel(); } catch (e) {} }
const ouroAntes = player.currency;
CampSystem.reset();
CampSystem._lastBuyAt = 0;
CampSystem.build();
const st = CampSystem.state;
if (!st || !Array.isArray(st.offers) || !st.offers.length) return { erro: 'CampSystem.build() não montou ofertas' };
// 'chest' devolve ouro ao comprar e estragaria a conta exata do troco; a compra usa a
// primeira oferta que só cobra. O duplo toque é sobre o mesmo id, não sobre a posição.
const idPrimeiro = st.offers[0].id;
const oferta = st.offers.find(o => o && o.id !== 'chest') || st.offers[0];
const idComprado = oferta.id;
const custo = oferta.cost;
player.currency = Math.max(1000, custo * 10);
const ouro0 = player.currency;
const ofertasAntes = st.offers.length;

CampSystem.buy(idComprado);
const ouro1 = player.currency, ofertas1 = st.offers.length;
CampSystem.buy(idComprado); // segundo toque, mesmo id, dentro da janela do duplo toque
const ouro2 = player.currency, ofertas2 = st.offers.length;
const idAindaNaLista = st.offers.some(o => o && o.id === idComprado);

player.currency = ouroAntes;
CampSystem.reset();
if (window.UIManager && UIManager.closePanel) { try { UIManager.closePanel(); } catch (e) {} }
return { idPrimeiro, idComprado, custo, ouro0, ouro1, ouro2, ofertasAntes, ofertas1, ofertas2, idAindaNaLista };
})()`,
    verificar(r) {
      const falhas = [];
      if (r.idComprado === undefined || r.idComprado === null) return ['o cenário não chegou a comprar nada'];
      if (r.ouro0 - r.ouro1 !== r.custo) falhas.push('primeira compra cobrou ' + (r.ouro0 - r.ouro1) + ' (esperado ' + r.custo + ')');
      if (r.ouro2 !== r.ouro1) falhas.push('segundo toque no mesmo item cobrou de novo (' + r.ouro1 + ' -> ' + r.ouro2 + ')');
      if (r.ofertas1 !== r.ofertasAntes - 1) falhas.push('a primeira compra deixou ' + r.ofertas1 + ' ofertas (esperado ' + (r.ofertasAntes - 1) + ')');
      if (r.ofertas2 !== r.ofertas1) falhas.push('o segundo toque tirou outra oferta (' + r.ofertas1 + ' -> ' + r.ofertas2 + ')');
      if (r.idAindaNaLista) falhas.push('o item comprado continua na lista do acampamento');
      return falhas;
    }
  },
  {
    // Esquiva contra a parede: o dash para antes dela (não atravessa) e os i-frames
    // existem logo depois do dash e somem sozinhos.
    nome: 'dash_parede_e_iframes',
    codigo: `(async () => {
${PREPARO}
if (window.UIManager && UIManager.closePanel) { try { UIManager.closePanel(); } catch (e) {} }
const TS = CONFIG.TILE_SIZE;
const raio = player.radius;
const parede = (tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  const t = map.tiles[tx][ty].t;
  return t === 1 || t === 2;
};
// Varre o mapa inteiro na ordem y/x e fica com o PRIMEIRO chão com parede sólida logo
// à direita: todo mapa tem pelo menos um (o chão mais à direita de cada linha termina
// em parede ou borda), então o cenário não depende mais da semente do mapa.
let muroX = null, px = null, py = null;
for (let ty = 0; ty < map.height && px === null; ty++) {
  for (let tx = 0; tx < map.width; tx++) {
    if (parede(tx, ty) || !parede(tx + 1, ty)) continue;
    // Encostado na parede, mas com o primeiro passo do dash livre e o corpo todo no chão
    const xIni = (tx + 1) * TS - raio - 18;
    if (xIni - raio < tx * TS) continue;
    if (!_entityClear(map, xIni + 6, ty * TS + TS / 2, raio)) continue;
    px = xIni; py = ty * TS + TS / 2; muroX = (tx + 1) * TS; break;
  }
}
if (muroX === null) return { erro: 'nenhuma parede à direita com chão livre no mapa' };

${LIMPAR_MUNDO}
player.hp = player.maxHp = 1e9;
player.skills = {};
player.frozen = 0;
player.shield = 0; player.aegisTimer = 0; player.invincibleTimer = 0;
player.dodgeCooldown = 0; player._dodgeBuffer = 0;
// Teleporta para o tile livre achado; o dash tem que parar na parede
player.x = px; player.y = py;
const xAntes = player.x;
const primeiroPassoLivre = _entityClear(map, player.x + 6, player.y, raio);

const errosConsole = [];
const consoleErrorOriginal = console.error;
console.error = function () {
  try { errosConsole.push(String(arguments[0])); } catch (e) {}
  return consoleErrorOriginal.apply(console, arguments);
};
let framesDeIFrame = 0, xDepois = xAntes, ticksIFrame = 0;
try {
  Input.right.active = false;
  Input.left.active = true; Input.left.dx = 1; Input.left.dy = 0;
  player.dodge(); // dash na direção da parede
  xDepois = player.x;
  framesDeIFrame = player.invincibleTimer || 0;
  Input.left.active = false;
  // Os i-frames do dash expiram sozinhos, com a simulação rodando
  while (player.invincibleTimer > 0 && ticksIFrame < 400) {
    player.hp = player.maxHp = 1e9;
    entities = entities.filter(e => e === player);
    Input.right.active = false; Input.left.active = false;
    update();
    ticksIFrame++;
  }
} finally {
  Input.right.active = false; Input.left.active = false;
  console.error = consoleErrorOriginal;
}
return {
  raio,
  muroX,
  xAntes,
  xDepois,
  andou: xDepois - xAntes,
  distanciaMuro: muroX - player.x,
  primeiroPassoLivre,
  atravessou: !!(map.isWall(player.x, player.y) || (player.x + raio > muroX + 0.5)),
  framesDeIFrame,
  iframesConfig: CONFIG.DODGE_INVULN_FRAMES,
  iframesSumiram: !(player.invincibleTimer > 0),
  ticksIFrame,
  errosConsole: errosConsole.length,
  erroConsole: errosConsole.length ? errosConsole[0] : null
};
})()`,
    verificar(r) {
      const falhas = [];
      if (r.muroX === undefined || r.muroX === null) return ['o cenário não achou parede para testar o dash'];
      if (r.primeiroPassoLivre !== true) falhas.push('posição de teste encostada demais: o dash nem começaria');
      if (!(r.andou > 0)) falhas.push('o dash não saiu do lugar (andou ' + r.andou + ' px)');
      if (r.atravessou) falhas.push('o herói atravessou a parede (centro a ' + r.distanciaMuro + ' px do muro, raio ' + r.raio + ')');
      if (!(r.distanciaMuro >= r.raio)) falhas.push('o herói parou dentro da parede (centro a ' + r.distanciaMuro + ' px do muro, raio ' + r.raio + ')');
      if (!(r.framesDeIFrame > 0)) falhas.push('o dash não deu i-frames (invincibleTimer ' + r.framesDeIFrame + ' logo depois)');
      if (!(r.framesDeIFrame >= r.iframesConfig)) falhas.push('i-frames do dash ' + r.framesDeIFrame + ' abaixo do configurado (' + r.iframesConfig + ')');
      if (r.iframesSumiram !== true) falhas.push('os i-frames do dash não expiraram em ' + r.ticksIFrame + ' ticks');
      if (!(r.ticksIFrame <= r.framesDeIFrame + 5)) falhas.push('i-frames duraram ' + r.ticksIFrame + ' ticks para uma janela de ' + r.framesDeIFrame);
      if (r.errosConsole) falhas.push('erro no console durante o dash: ' + r.erroConsole);
      return falhas;
    }
  },
  {
    // Save + load de ida e volta: o que foi gravado é o que volta para a memória.
    nome: 'save_ida_e_volta',
    codigo: `(async () => {
${PREPARO}
if (window.UIManager && UIManager.closePanel) { try { UIManager.closePanel(); } catch (e) {} }
const ouroOriginal = player.currency;
const nivelOriginal = dungeonLevel;
const camaraViva = _storyRoom ? _storyRoom.i : null;
// Estado conhecido, para comparar depois do load
player.currency = 777; player.lvl = 5; player.xp = 123; player.kills = 42;
player.maxHp = 200; player.hp = 150; player.weaponLevel = 2;
dungeonLevel = 3; dungeonKills = 5;
const tipoVivo = player.type;
const salvou = SaveSystem.save();
let gravado = null;
try {
  const bruto = localStorage.getItem(SaveSystem.KEY);
  gravado = bruto ? JSON.parse(bruto) : null;
} catch (e) { gravado = null; }
if (!gravado) {
  player.currency = ouroOriginal; dungeonLevel = nivelOriginal;
  return { erro: 'SaveSystem.save() não deixou save no localStorage', salvou };
}
// Estraga o estado em memória e carrega de volta do disco
player.currency = 0; player.lvl = 1; player.xp = 0; player.kills = 0;
player.maxHp = 10; player.hp = 10; player.weaponLevel = 1;
const carregado = SaveSystem.load();
if (carregado) SaveSystem.applyTo(player, carregado);
const lido = carregado || {};
// Mede a memória ANTES de devolver o estado vivo do cenário
const memCurrency = player.currency, memLvl = player.lvl, memXp = player.xp, memKills = player.kills;
const memHp = player.hp, memMaxHp = player.maxHp, memArma = player.weaponLevel;
player.currency = ouroOriginal;
dungeonLevel = nivelOriginal;
try { SaveSystem.save(); } catch (e) {} // regrava o estado vivo de volta, sem apagar o save
return {
  salvou,
  carregou: !!carregado,
  versao: gravado._version,
  versaoEsperada: SaveSystem.VERSION,
  tipo: gravado.type,
  tipoVivo,
  andar: gravado.dungeonLevel,
  mortes: gravado.dungeonKills,
  camaraSave: (gravado.storyRoom && Number.isInteger(gravado.storyRoom.i)) ? gravado.storyRoom.i : null,
  camaraViva,
  ouroSave: gravado.currency,
  ouroEsperado: 777,
  lvlSave: gravado.lvl,
  xpSave: gravado.xp,
  killsSave: gravado.kills,
  hpSave: gravado.hp,
  maxHpSave: gravado.maxHp,
  armaSave: gravado.weaponLevel,
  ouroNoLido: lido.currency,
  lvlNoLido: lido.lvl,
  xpNoLido: lido.xp,
  killsNoLido: lido.kills,
  hpNoLido: lido.hp,
  maxHpNoLido: lido.maxHp,
  armaNoLido: lido.weaponLevel,
  memCurrency,
  memLvl,
  memXp,
  memKills,
  memHp,
  memMaxHp,
  memArma
};
})()`,
    verificar(r) {
      const falhas = [];
      if (r.erro) return ['erro no cenário: ' + r.erro];
      if (r.salvou !== true) falhas.push('SaveSystem.save() devolveu falso');
      if (r.versao !== r.versaoEsperada) falhas.push('save gravado na versão ' + r.versao + ' (esperado ' + r.versaoEsperada + ')');
      if (r.tipo !== r.tipoVivo || r.tipo !== 'mage') falhas.push('tipo gravado "' + r.tipo + '" não bate com o herói da run ("' + r.tipoVivo + '")');
      if (r.andar !== 3) falhas.push('andar gravado ' + r.andar + ' (esperado 3)');
      if (r.mortes !== 5) falhas.push('abates gravados ' + r.mortes + ' (esperado 5)');
      if (r.camaraSave !== r.camaraViva) falhas.push('câmara gravada ' + r.camaraSave + ' não bate com a viva ' + r.camaraViva + ' fora de transição');
      if (r.ouroSave !== r.ouroEsperado) falhas.push('ouro gravado ' + r.ouroSave + ' (esperado ' + r.ouroEsperado + ')');
      if (r.carregou !== true) falhas.push('SaveSystem.load() não devolveu o save recém-gravado');
      if (r.lvlNoLido !== r.lvlSave || r.xpNoLido !== r.xpSave || r.killsNoLido !== r.killsSave) {
        falhas.push('progressão lida (lvl ' + r.lvlNoLido + ', xp ' + r.xpNoLido + ') não bate com a gravada (lvl ' + r.lvlSave + ', xp ' + r.xpSave + ')');
      }
      if (r.hpNoLido !== r.hpSave || r.maxHpNoLido !== r.maxHpSave) {
        falhas.push('vida lida (' + r.hpNoLido + '/' + r.maxHpNoLido + ') não bate com a gravada (' + r.hpSave + '/' + r.maxHpSave + ')');
      }
      if (r.armaNoLido !== r.armaSave) falhas.push('nível de arma lido ' + r.armaNoLido + ' não bate com o gravado ' + r.armaSave);
      if (r.ouroNoLido !== r.ouroSave) falhas.push('ouro no objeto carregado ' + r.ouroNoLido + ' não bate com o gravado ' + r.ouroSave);
      if (r.memCurrency !== r.ouroSave || r.memLvl !== r.lvlSave || r.memXp !== r.xpSave || r.memKills !== r.killsSave ||
          r.memHp !== r.hpSave || r.memMaxHp !== r.maxHpSave || r.memArma !== r.armaSave) {
        falhas.push('estado em memória depois do load não bate com o gravado (ouro ' + r.memCurrency + '/' + r.ouroSave +
          ', lvl ' + r.memLvl + '/' + r.lvlSave + ', hp ' + r.memHp + '/' + r.hpSave + ')');
      }
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
