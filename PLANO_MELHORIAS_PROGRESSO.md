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

**Verificación (browser real, harness):** clic real en `#shop-btn-bar` → `_shopOpened=true`, panel abre, tutorial avanza a 'skilltree'; clic en skills → avanza a 'equipment'; pickup → 'complete'; tutorial cierra con `completed=true` + bônus moedas. Gate táctil: `buttonPrevented=false` / `canvasPrevented=true`. `check-js` 53/53 scripts, 0 errores. `CACHE_VERSION` v8→v9. Commit `ed0626e` (pushed → Pages redeploy).
