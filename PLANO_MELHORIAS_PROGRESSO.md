# Progresso — Sombras de Krevathorn

Histórico consolidado das rodadas de orquestração. Detalhes técnicos e notas de gate: `.omp/orchestration-state.md`; backlog e diagnóstico original: `PLANO_MELHORIAS.md`.

## Fases do plano original (concluídas)
| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação (git, LICENSE, README, metas, dedupe meta tags) | ✅ |
| 1 | Vazamentos (pool de partículas ligado, áudio com `disconnect()`, drone reutilizado, rAF da start screen parado por estado, `ctx.suspend()` em background) | ✅ |
| 2 | Código morto/stubs removidos (EventBus, RunState, stubs de leaderboard/resources/crafting), saves centralizados no StorageManager | ✅ |
| 3 | Performance (SpatialHash lazy, auto-res 500ms + degraus 0.75/0.9) | ✅ |
| 4 | i18n pt/en/es real (dicionários + data-i18n + `_L` em conteúdo) | ✅ (parcialmente estendido em rodadas seguintes) |
| 5 | Features (daily funcional, crafting real, tutorial quick/full, leaderboard) | ✅ |
| 6 | PWA (`sw.js` com CACHE_VERSION, cache-first + stale-while-revalidate) | ✅ |

## Rodada 2026-08-30 (auditoria E2E + refinamento)
Nota do Juiz: **91/100**. Comparação cega vs Brogue: superior para a categoria mobile.
Correções: barra de HP do chefe ligada ao UIManager; i18n de loja/acampamento/histórico; settings do menu com seletor de idioma; ~30 strings com mojibake corrigidas; badge do desafio diário na start screen; crash `s is not defined` no minimapa (Oráculo); crash fatal `ElementalSystem.applyStatus is not a function` — método implementado (pilha cap 3, refresh de timer, guarda de morto).

## Rodada 2026-08-30 (2ª, auditoria estática "not defined")
Análise com parser acorn + validação runtime de painéis/chefes/pets/NPCs/eventos — zero erros.
Correções: `toggleLore` (tecla L) abria painel inexistente; `ScreenEffects.onCriticalHit` nunca definido (→ `onCrit`); `WeaponSystem.getSpeedMult` chamado mas não implementado — implementado + stat `speed` nas 4 armas.

## Rodada 2026-09-01 (auditoria E2E completa; Gate A 96/100 APROVADO)
Método: harness de aceleração + autopilot; comparação cega vs Shattered Pixel Dungeon (perdeu UX 65×75, UI 50×80, Gráficos 60×70 → backlog visual).
Correções: kill rewards centralizados em `Entity.takeDamage` (skills davam zero XP/abates/loot); santuário com bênçãos esgotadas agora avisa "BÊNÇÃO ESGOTADA (máx. 2)"; contraste de textos secundários da start screen; totalKills sem duplicação (finding P3).
Melhoria: start screen com seed/build colapsáveis (visão 45→85/100).
Infra: CI mínima (`.github/workflows/ci.yml` + `check-js.js`); `.gitignore` com `.omp/`; rodada passa a operar em clonagem fora do drive.
Gate B segue **abaixo da régua (90)**: UX 72, UI 62, Gráficos 68, Diversão ~80 (indicativo). Lacunas: escala tipográfica, ícones SVG no lugar de emojis, canto do minimapa.

## Fixes pós-ledger (2026-09-01 → 2026-09-03, commits individuais)
- Projéteis do jogador sem dano base (regressão): `e.takeDamage(this.dmg…)` restaurado no `Bullet.update`; mults duplicados removidos do melee/arrow storm/vento da elfa; projéteis inimigos com `source=null`.
- `CACHE_VERSION` → `krevathorn-v3`/`v4` (refresh de versão pré-fix servida pelo SW).
- Ladino rebalanceado: speed 6→4.6, fireRate 8→10, bulletSpeed 14→12.
- Daily com classe forçada não sobrescreve a escolha: `_applyDailyIfEligible` — desafio só vale na classe exigida; outra classe inicia run normal.

## Rodada 2026-09-03 (auditoria geral + melhorias) — esta rodada
Auditoria: 4 commits pós-ledger re-verificados em runtime (dano 22→44 com damageMult 2 = 1× aplicação central; boost 1×1.25; projétil inimigo não infla com damageMult 5 do jogador; kill rewards +1 exato sem duplicação; daily tank: mage→run normal, warrior→hpMult 2/360 HP, re-apply em continue correto). Regressão E2E ampla (fluxos F01-F34) — ver relatório da rodada.
Melhorias (Gate B): labels de seed/build da start screen fora do i18n (misturavam idiomas) — chaves pt/en/es + `data-i18n`; badges de dificuldade/nível sobrepunham o minimapa (canto superior direito) — chips deslocados com margem dinâmica + retorno ao ocultar minimapa (`body.mm-hidden`); contraste dos botões utilitários centrais elevado.
Docs criados: `NÃO COMMITAR.md`, `PLANO_MELHORIAS_PROGRESSO.md` (exigidos pelo AGENTS.md).

## Rodada 2026-09-09 (branch `graficos-melhores`) — pulido de sprites hi-bit 24×24

Tras las folhas nativas 24×24 (warrior/rogue/mage/elf, 7 poses cada; commits `3408d65`+`374f81b`), ronda de pulido de pixel-art por clase. **Solo el LADINO** quedó pulido y verificado con loop visual propio (commit `181dbb2`, pushed): máscara como banda nasal (fila `777777`+`734437` separada de los ojos por sombra oscura), highlight `9` en el capuchón superior-izquierdo, adagas redibujadas como hojas de acero verticales limpias (grips `65000`/`05000`) con brillo, consistente en las 7 poses. Su resultado por visión: ladino 8/10.
**warrior (6/10), mage (7/10), elf (6.5/10):** los agentes de pulido expiraron sin escribir (`index.html` intacto). El crítico visual por visión agotó su presupuesto de créditos esta ronda (65536 tokens máx vs 39195 disponibles, fijado por la herramienta `read`), así que NO se hicieron ediciones ciegas de arte (riesgo de regresión). Estructura validada por script: 28 arrays (4 clases × 7 poses) todos 24×24, charset `[0-9]`; `check-js` 53 scripts 0 errores. Sheet de revisión renderizada: `.omp/sheet-heroes-review.png` + celdas 16× en `.omp/cell-*`; muestras sincronizadas a `drive/.omp/referencias/sprites-pulido-2026-09-09/`.
**Pendiente:** pulido de warrior/mage/elf en próxima ronda con presupuesto de visión disponible (defectos de QA por visón previo: warrior — simetría de escudo interno/contorno de espada/dirección de luz; mage — orbe completo/núcleo blanco; elf — contraste capucha/capa, arco más grueso con cuerda, contorno derecho).

## Rodada 2026-09-09 (2ª, branch `graficos-melhores`) — pulido estrutural dos sprites hi-bit de Guerreiro/Mago/Elfa

Sem visão disponível (cota do key `?q=` estourou esta sessão), pulido dirigido por **análise estrutural determinística pixel-exata** (render ASCII 24x24 replicando o `SpriteManager` + contagem de componentes conexos por BFS). Defeitos objetivos medidos e corrigidos, preservando as silhuetas aprovadas no Gate B 95:
- **Mago (todas as 7 poses):** orbe/cajado era um **componente desconexo** flutuando à direita da cabeça (26 células isoladas no idle, 20 no cast) — haste em col18 com gap col17 vs corpo col16. Fix: ponte em col17 ligando a haste ao corpo; attack/cast unem o orbe às mãos. Resultado: 7/7 poses = 1 componente conexo (antes 2 e 9).
- **Elfa (7 poses):** **arco era um graveto de 1px desconexo** (curva de colunas W à esquerda, gap col5 na parte baixa). Fix: bridge `5` conectando o arco ao corpo; attack/cast unindo faíscas. Resultado: 7/7 poses = 1 componente (antes 3–19).
- **Guerreiro (7 poses):** espada fundida ao corpo e **sem escudo** (classe tanque; direção de arte e commit `3408d65` pedem "escudo redondo"). Fix: escudo redondo aço `#466e8e` + anel dourado `#c9a227` + rebite highlight no antebraço direito (centro por pose; (16,14) idle/walk, (15,15) attack/cast). Resultado: 7/7 poses = 1 componente.

Verificação: `check-js` 53 scripts, **0 erros**; no `SpriteManager` ao vivo (browser), **56/56 células** (7 poses × 8 direções) de cada uma das 3 classes = **1 componente conexo**; smoke test runtime: `_originalStartGame('warrior'|'mage'|'elf')` ⇒ `gameState=PLAYING`, `player` presente, **0 erros de console**. Diff do `index.html` tocado apenas nas 21 linhas de padrão dos sprites (nenhuma regressão fora do bloco). `CACHE_VERSION` bumpeado `v6→v7` (SW stale). Evidências: `.omp/referencias/hero3_baseline.png` (antes) e `hero3_final.png` (depois).

## Rodada 2026-09-10 — merge em main + enemigos comuns a 24x24 nativos

**(A) Merge:** `graficos-melhores` mergeado en `main` (fast-forward `6e77398..b6977e9`, sin conflicto — main no había avanzado desde el punto de ramificación). Push a GitHub → GitHub Pages redeploy automático. Los 5 commits visuales de la branch (R1/R2/R3 + sheets heroes + Gate B 95) ahora están en producción.

**(B) Enemigos a 24x24:** los heróis ya eran 24x24 nativos (sprites hi-bit); los enemigos comunes estaban en 16x16 upscaled (cada pixel estirado → se veían "gordos"/borrosos vs heróis nítidos). Elevados a 24x24 nativos con paletas ricas, preservando identidad y 1 componente conexo por pose:
- **melee** (soldado robado del esqueleto): 6 poses (idle/walk1-4/attack), máscara roja + hoja azul-acero.
- **ranged** (arquero): capucha + arco curvo CONECTADO al brazo (antes era un graveto de 1px suelto). 6 poses.
- **swarm** (enjambre): criatura pequeña ~mitad de alto, cuerpo azul-oscuro, 4 ojos rojos. 6 poses.
- **skeleton**: reusa la forma numérica del nuevo melee_* (el motor aplica su paleta hueso); se agregan skeleton_walk3/4 inexistentes (copias de melee_walk3/4).

Autorado por subagente con validación estructural (24 filas × 24 chars, charset [0-9], 1 componente BFS en TODAS las poses). Verificado: `check-js` 0 errores; smoke warrior ⇒ PLAYING, melee/ranged spawnean sin error de console; `SpriteManager.draw` de los 6 tipos en 8 direcciones × 3 estados = 0 errores. `CACHE_VERSION` v7→v8. Commit `bfece12`. Evidencias: `.omp/referencias/enemies_baseline.png` / `enemies_after.png`.

**Pendiente (próxima ronda):** jefes (12 formas únicas) y enemigos esporádicos (shielder/healer/mimic/trap/merchant) siguen en 16x16 upscaled. Elevar chefes a 24x24 nativos daría el mayor impacto visual restante.

## Rodada 2026-09-10 (2ª) — corrección: tutorial completo destrabado (etapa "abrir la loja")

Usuario reportó tutorial roto, en especial la etapa de abrir la tienda. Reproducido en browser real (harness CDP main-world): tutorial quedaba **atascado en la etapa 7 'shop'** — clic/toque en el botón de tienda no abría la tienda ni avanzaba. Dos causas encadenadas en `index.html`:

1. **`UIManager.setupButtons()` (DOMContentLoaded) sobrescribía el `onclick` de loja/habilidades/status** con `() => this.openPanel(...)`, en lugar del inline `if(window.toggleShop) toggleShop()`. Como `TutorialSystem.init()` hookea exactamente `window.toggleShop`/`window.toggleSkillTree` (para marcar `_shopOpened`/`_skillTreeOpened`), el bypass hacía que la misión objetivo **nunca se registrara** → la etapa no avanzaba aunque la tienda se abriera. Raíz: `setupButtons` corre después del hook y reasigna el handler saltándose los wrappers.
2. **En táctil, `Input` `touchstart` llamaba `e.preventDefault()` siempre que `_allControlsHidden()` fuera true** (etapas sin acción: shop/skilltree). Eso ocurría **antes** del check `e.target.closest('button')` (que ya existe para dejar pasar botones) → en mobile el toque en loja/habilidades era engullido por completo → botón muerto.

**Fix:** (1) botones de loja/habilidades/status rutados por los wrappers (`window.toggleShop/toggleSkillTree/toggleStats`, con fallback a `openPanel`); (2) el gate de tutorial en `touchstart` ahora solo bloquea canvas/joystick — si el target es un `button`, el toque pasa (que es lo que el `return` posterior ya pretendía). Comportamiento original preservado: toque en el mundo sigue bloqueado en etapas info (`canvasPrevented=true` verificado).

**Verificação (browser real, harness):** clic real em `#shop-btn-bar` → `_shopOpened=true`, panel abre, tutorial avança a 'skilltree'; clic em skills → avança a 'equipment'; pickup → 'complete'; tutorial cierra con `completed=true` + bônus moedas. Gate táctil: `buttonPrevented=false` / `canvasPrevented=true`. `check-js` 53/53 scripts, 0 errores. `CACHE_VERSION` v8→v9. Commit `ed0626e` (pushed → Pages redeploy).

## Rodada 2026-09-10 (3ª) — atualizações automáticas + log de versões ("Novidades")

Pedido do usuário: navegadores dos jogadores do GitHub Pages estavam servindo versões velhas (cache do SW stale-while-revalidate), exigindo limpeza manual; e mesmo com versão nova eles não ficavam sabendo. Implementado dois mecanismos complementares:

**(A) Painel "Novidades" (update log, 1× por versão):** `window.UPDATE_LOG` (changelog embutido: `current` + `entries` com título/data/linhas) + `window.UpdateNotifier.check()` que roda no DOMContentLoaded. Persistência em localStorage via nova chave RAW `updateLog` (`aethelgard_updateLog`, registrada no `StorageManager.RAW`). Lógica: usuário novo (sem `updateLog`) é registrado **silenciosamente** (nada a anunciar); usuário de volta com versão mais velha vê um painel modal estilizado listando as entradas mais recentes (até 6, ordem decrescente, `pt/en/es` via chaves `update.*`), e ao fechar ("Entendi") registra `current`. Exibido exatamente uma vez por versão: rejeita comparando `lastSeen` com `current`.

**(B) Cache automático sem perder saves:**
1. `index.html` registra o SW com `{ updateViaCache: 'none' }` → o navegador revalida `sw.js` na rede a cada load (novas versões são detectadas rápido, sem esperar o refresh mensal do HTTP cache).
2. `skipWaiting` (instalação) + `clients.claim` (ativação) já existentes → o worker novo assume; a página escuta `controllerchange` e **recarrega uma vez** (guard `sessionStorage 'krev-sw-refresh'` impede loop).
3. `sw.js` vira **network-first para navegação** (`./`, `index.html`): com o worker novo ativo, o HTML recém-deployado chega imediatamente; cache vira só fallback offline. Demais GETs continuam stale-while-revalidate.
4. Limpeza: `activate` do worker apaga caches `krevathorn-*` antigos; defensivamente a página apaga caches **estritamente mais velhos** que `UPDATE_LOG.current` (nunca mais novos — um worker recém-ativado pode depender do próprio cache). Saves ficam em localStorage e **nunca são tocados**.
5. Procedimento de release documentado no `NÃO COMMITAR.md`: bump sincronizado `CACHE_VERSION` (sw.js) + `UPDATE_LOG.current` (index.html) + entrada no changelog (3 dicionários).

**Verificação (browser real, harness CDP main-world):** (A) usuário novo → sem painel, `updateLog='v10'`, SW registrado; (B) usuário em `v8` → painel com entrada v10 (+v9), fecha → `v10`, reload não re-exibe (1×); (C) caches semeados `krevathorn-v1`/`v9` → varridos no load (só `v10` e cache não-krevathorn permanecem); (D) deploy simulado v11 → `controllerchange` dispara auto-reload (`refreshFlag='1'`), worker v11 ativo, cache v10 varrido, save (`aethelgard_meta`) intacto, painel exibiu entrada correta e registro atualizado. `check-js` 54 scripts, 0 erros; `node --check sw.js` OK. `CACHE_VERSION` v9→v10. Commit pendente nesta rodada.

## Rodada 2026-09-10 (4ª) — textos nítidos sob resolução dinâmica

Usuário reportou que, com a redução dinâmica de resolução (auto-res), os textos do jogo ficavam "quadriculados". Causa raiz: o **canvas principal** (que recebe todos os `fillText` do HUD/canvas — joystick, dano, tutorial, chefes, nomes, HUD) era redimensionado junto com o mundo pelo `_autoResScale` (ex.: 315×675 → 189×405 a 0.6), e o navegador fazia upscale nearest-neighbor (`imageRendering: 'pixelated'`) até o tamanho CSS cheio — cada glifo virava blocos.

**Fix (arquitetura em 2 camadas):** o canvas principal agora roda **sempre em resolução cheia** — tamanho da janela × `devicePixelRatio` (cap 2×; antes DPR era forçado a 1 e o buffer era 0.75× da janela). A escala lógica→física virou `_cssScale` (antes reutilizava `_autoResScale`). Os buffers de **mundo/luz continuam seguindo o `_autoResScale`** (a proteção de performance permanece intacta: é lá que mora o custo de render — mapa, luz, entidades). PostFX (vignette/flash/chroma) operam no canvas principal em resolução cheia, mas o chroma (único op com custo real — 3 cópias full-screen) já se desliga sozinho em qualidade baixa (`GFX.chroma === false`), contendo o custo em devices fracos.

**Verificação (browser real):** com `_setResScale(0.6)` durante uma run: canvas principal = **525×1125** (420×900 CSS × DPR 1.25 — resolução nativa cheia); world/light = **189×405** (low-res, perf preservado). Amostragem de pixels do texto desenhado: **15 níveis de luminância** (antialiasing suave) + 370 transições de borda — vs. o caminho antigo (texto rasterizado a 315×675 e upscaled 1.67× → blocos, poucos níveis). 0 erros de console durante gameplay em autoRes 0.6. `check-js` 54 scripts, 0 erros; `node --check sw.js` OK. `CACHE_VERSION` v10→v11 (commit pendente nesta rodada).

## Rodada 2026-09-10 (5ª) — cenário com volume (paredes/chão)

Pedido do usuário: melhorar o **cenário** como fizemos com personagens e inimigos. Sem visão disponível (cota do key `?q=` estourou, como nas rodadas de sprites), diagnóstico dirigido por **análise determinística pixel-exata do `Map.buffer`** vivo.

**Gap medido:** as paredes eram placas planas de cor chapada com luz **INVERTIDA** — a base mais clara que o topo (`vertDir` médio **−3.1**; o oposto de volume), sem direção de luz consistente; o chão tinha grade quase invisível (cross alpha 0.02). Isso destoava dos sprites 24×24 detalhados de personagens/inimigos.

**Implementado (tudo baked no `Map.buffer`, custo zero por frame, alphas baixos):**
1. **Paredes:** gradiente linear vertical **top-lit** (branco 0.11 no topo → preto 0.14 na base) substituindo as faixas chapadas de cima/baixo; curso de alvenaria **running-bond** com head-joint horizontal deslocado por tile (a alvenaria lê como cursos deslocados, não argamassa alinhada).
2. **Chão:** juntas de laje **2×2 recessed** (seams nas bordas pares, alpha 0.05) + sheen top-lit leve, no lugar do cross invisível — as lajes leem como placas de pedra com a mesma direção de luz das paredes.

**Verificação (pixel-exata):** `vertDir` corrigido para **+16 a +22 nos 4 biomas** (antes −3.1, topo consistentemente claro = volume correto); **contraste parede/chão preservado** (Δ mediana 24–31 antes e depois, chão sempre mais escuro — legibilidade intocada); render ASCII confirmou volume top-lit da parede e juntas de laje do chão. Smoke: run warrior ⇒ PLAYING, todos os 4 biomas re-bakeiam, **0 erros de console**; `check-js` 54/54; `node --check sw.js` OK; notifier v12 validado (usuário v8 → `#update-overlay` com "v12 — Scenery with depth" + "Got it", visível). `CACHE_VERSION` v11→v12. Commit `1405adc`. Screenshots: `.omp/cenario_baseline/` (antes) e `.omp/cenario_depois/` (depois).

## Rodada 2026-09-11 — correção: jogador podia ficar sem tomar dano (HP preso no máximo)

Usuário relatou HP do jogador fixo no máximo (409) mesmo recebendo dano parado. Reprodução em browser real (harness CDP main-world, v12): combate vanilla saudável em todos os cenários (melee + ranged + veneno: 409→205 em ~6s). Mecanismos reais de trava encontrados e **provados em runtime**:

1. **Invencibilidade presa no `draw()`**: `Player.invincibleTimer--` rodava apenas no `Player.draw` — qualquer frame em que o draw não roda (hitch de render, throttling de rAF, painel aberto) congela o timer em 15 ticks → player para de receber dano. Prova: pump só de `update()` (sem draw) → `inv` preso em 15, HP congelado (170) com dezenas de hits.
2. **Dano NaN → HP pregado no máximo**: `takeDamage(NaN)` → `player.hp` vira NaN → a guarda defensiva `if (isNaN(player.hp)) player.hp = player.maxHp` (update) religa o HP no máximo todo frame (409 no caso do usuário) → imortal enquanto a fonte NaN existir. Prova: após hit NaN, `hp=NaN`; após 5 frames de `update()`, `hp=409`.

**Fix (v13):** (1) tick de `invincibleTimer--` movido para `Player.update` (draw só usa o valor no blink); (2) `takeDamage` (base `Entity` + `Player`) descarta dano não-finito (`!Number.isFinite(a)`) antes de qualquer matemática — NaN/undefined nunca mais vira HP NaN nem consome invencibilidade.

**Verificação (browser real, v13):** pump update-only → HP 409→283 em 240 ticks (inv expira sem render — antes congelava); `takeDamage(NaN)` → HP 409 intacto, `inv` 0, dano real subsequente aplica (10→399); smoke completo (update+draw) 1.5s, 0 erros de console, combate saudável. `check-js` 54/54, 0 erros. `CACHE_VERSION` v12→v13 + `UPDATE_LOG.current` + changelog pt/en/es.
