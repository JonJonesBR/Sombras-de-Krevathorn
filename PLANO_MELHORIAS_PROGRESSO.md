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
