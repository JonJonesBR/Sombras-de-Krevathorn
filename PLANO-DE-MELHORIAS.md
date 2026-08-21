# Plano de Melhorias — Sombras de Krevathorn

**Data:** 2026-08-21
**Base do diagnóstico:** `index.html` (21.289 linhas, ~1,04 MB), `README.md`
**Método:** análise por 3 scouts paralelos (arquitetura, performance, gameplay/UX), todas as evidências com número de linha.

> Números de linha referem-se ao snapshot de 2026-08-21. Após edições, podem deslocar.

---

## Status de execução (atualizado em 2026-08-21)

| Fase | Status | Commit |
|---|---|---|
| 0 — Fundação (git, LICENSE, README, metas) | ✅ Concluída | `fase 0` |
| 1 — Vazamentos (áudio, rAF, pool, dead flags) | ✅ Concluída | `fase 1` |
| 2 — Estrutura (EventBus, stubs, RunState, storage) | ✅ Concluída | `fase 2` |
| 3 — Performance (spatial hash lazy, auto-res) | ✅ Concluída | `fase 3` |
| 4 — i18n real (pt/en/es) | ✅ Concluída | `fase 4` |
| 5 — Features (daily, crafting, tutorial, README) | ✅ Concluída | `fase 5` |
| 6 — PWA (service worker) | ✅ Concluída | `fase 6` |
| Smoke test no browser | ✅ Concluído | `fix smoke test` |

**Resultados verificados no browser (headless, 420×820, servidor local):**
- Boot sem erros de console; loop a 60fps; GAME_OVER → restart funciona.
- Service worker ativo e controlando a página (offline caching funcional).
- i18n: `data-i18n` aplicado no boot; troca pt/en/es re-renderiza a UI.
- Daily challenge de 2026-08-21 (sniper): classe forçada (mage) + dmgMult 2 aplicados; one-hit mata inimigo de 5000 HP com 1 de dano; `complete()` grava score e ranking.
- Crafting: `craft('forge_weapon')` gastou 80 moedas e subiu weaponLevel; sem moedas → recusa com toast.
- Tutorial: 6 stages quick, 9 stages full, botão "Full Tutorial" presente, mode wiring correto.

**Decisões tomadas durante a execução:**
- Fonte separada + build: **não** — mantido arquivo único (opção A), conservador.
- `recycleParticles`: era código morto duplicado (o update loop já faz release); **removido**, não era bug de memória.
- EventBus: **removido** (2 publishes no vazio; relíquias usam RelicSystem direto).
- RunState: **removido inteiro** (sistema write-only — `save()` era chamado, nada nunca lia); `toggleSave` agora usa `SaveSystem`.
- Stubs: leaderboard e resources **removidos** (zero usos); crafting stub removido (Fase 5 implementa de verdade); daily modifiers **serão aplicados na Fase 5**.
- `_worldDirty`/`WORLD_REDRAW_THROTTLE`: **removidos** — análise mostrou que o cache por dirty flag congelaria o frame (player/inimigos ocupam o viewport sempre). Os caches reais são `Map.buffer` (tiles), `lightCanvas` (luz) e `_mmBuffer` (minimapa) — documentado no código.
- Chaves localStorage: centralizadas via store versionada `audio` (com import de legado) + registro `RAW` com `getRaw/setRaw/removeRaw` no StorageManager.
- Auto-res: janela de medição 500ms + degrau 0.75× em quedas < 40fps + 0.9× em < 50fps.

---

## Resumo do diagnóstico

### O que já está forte (não mexer)
- **Object pooling real** (`PoolManager` 12586): Bullet, Particle, DamageNumber, SlashEffect com acquire/release e caps (`MAX_BULLETS=45`, `PARTICLE_CAP=60`).
- **Caching real** do tile map (`Map.buffer` + `needsRedraw`) e do minimapa (`_mmDirty`/`_buildMinimapBuffer`).
- **Dynamic resolution scaling funcional** (`_autoResScale`, min 0.6) + auto-perf (desliga partículas/shake/hitstop).
- **UX mobile bem-feita**: joysticks fixo/flutuante, aim assist, haptics, safe-areas (`env(safe-area-inset-*)`), wake lock, back button, fullscreen no 1º toque.
- **Suporte desktop real** (WASD + mouse + gamepad, 20817-20841) — README subestima.
- **Conteúdo vasto**: 12 chefes, 52 skills, 25 conquistas, 13 relíquias, 4 biomas + 10 variantes, 55 fragmentos de lore, MetaLoja, prestige, Abismo.
- Zero `TODO`/`FIXME` no arquivo.

### Problemas encontrados (base do plano)
| # | Problema | Evidência | Impacto |
|---|----------|-----------|---------|
| 1 | Sem versionamento (sem `.git`) e sem `LICENSE` (README promete MIT) | pasta do projeto | editar 21k linhas é irreversível |
| 2 | **Partículas mortas nunca voltam ao pool** — `recycleParticles` nunca é chamado | 12132-12139 (0 usos) | memória cresce sem limite em runs longas |
| 3 | **Vazamento de AudioNodes**: pool morto (10 nós criados, nunca usados); cada SFX cria osc+gain+panner sem `disconnect()`; drone cria 3 nós/s | 6374-6377, 6395-6415, 6697-6718 | jank/memória em sessões longas em mobile |
| 4 | **Loop rAF órfão eterno**: start-screen particles roda 60fps fullscreen para sempre, inclusive durante a gameplay | 21157-21200 (guarda nunca dispara) | bateria/CPU desperdiçadas em mobile |
| 5 | EventBus morto (2 publishes, 0 subscribers) | 9443-9457 | acoplamento global sem contrato |
| 6 | Stubs disfarçados: crafting vazio, resources vazio, leaderboard vazio, modificadores do daily challenge nunca aplicados | 9077-9084, 9054-9070, 9462-9466, 9524-9533 | UI promete o que não existe; dica in-game manda "usar crafting" (16854) |
| 7 | i18n de fachada: dicionário ~62 chaves × 3 idiomas, mas ~150+ strings hardcoded em pt (tutorial, quests, loja, relíquias, chefes, logs) | 19599-19657, 9093-9104, 7351-7397, 17431-17443, 14194-14206 | seletor de idioma traduz ~30-40% do jogo |
| 8 | `_worldDirty`/`WORLD_REDRAW_THROTTLE` mortos — camada do mundo redesenha 100% todo frame | 1640, 2931, 5544 | promessa de cache do README não cumprida |
| 9 | SpatialHash reconstruído todo frame mesmo sem balas | 4638-4641 | alocação O(n)/frame desnecessária |
| 10 | ~12 chaves localStorage fora do StorageManager/SaveSystem (sem versão/migração) | 2866, 6337, 7089, 8924, 8984, 9020, 9354, 9490, 9680, 17720 | migração/corrupção de save sem recuperação |
| 11 | Código morto diverso: `PARTICLE_CAP=100` vs `CONFIG.PARTICLE_CAP=60`, `_lightingDirty` nunca lido, hack `startGame.toString().includes('warn')`, `tutorial-full-btn` órfão, meta tags duplicadas no head | 12115, 2928, 4994, 19577, 19763, 12-17 | custo cognitivo; tuning confuso |

---

## Decisão aberta (afeta a execução das fases)

**Restaurar código-fonte separado + build, ou continuar em arquivo único?**

O `index.html` contém marcadores `// === js/core/... ===`, `// === js/systems/... ===` etc. — vestígio de uma estrutura multi-arquivo que foi concatenada. As opções:

- **A. Continuar em arquivo único** (manter como está): edição direta, sem passo de build; risco maior em cada edição.
- **B. Restaurar a árvore `js/` + script de build simples** (concatenação com os mesmos marcadores): edição muito mais segura (arquivos pequenos, diffs claros, menos colisão de contexto), mantém `index.html` como artefato de deploy; adiciona um passo de build manual.

Recomendação: **B** — é o maior ganho de manutenibilidade para um arquivo de 21k linhas, e o build é trivial (um script de concatenação). Se escolher A, as fases 2-5 são executadas direto no `index.html`.

---

## Fase 0 — Fundação: versionamento, licença, README verdadeiro
*Razão: nada disso requer tocar no jogo; sem `.git`, qualquer fase seguinte é arriscada.*

- [ ] `git init` + `.gitignore` + commit inicial `baseline` (estado atual íntegro).
- [ ] Criar `LICENSE` (MIT — o README promete, o arquivo não existe).
- [ ] README: corrigir claims falsas:
  - Desktop "(If applicable)" → suporte real documentado (WASD/mouse/gamepad).
  - Passo 3 "para garantir que PWA service workers funcionem" → não existe service worker; reformular.
  - Adicionar conteúdo real omitido: Abismo, pets, acampamento, eventos, MetaLoja, diário, 2 modos.
- [ ] Dedupe de meta tags no head (12/16, 13/17 — `apple-mobile-web-app-capable` e `status-bar-style` duplicados).

**Verificação:** `git log` limpo; `README.md` sem afirmações falsas; abrir o jogo e confirmar que nada mudou.

---

## Fase 1 — Correção de vazamentos e loops órfãos (memória/bateria)
*Razão: são bugs reais que degradam a experiência em sessões longas em mobile — o público-alvo do jogo.*

- [ ] **Pool de partículas**: ligar `recycleParticles` (12132-12139) ao ciclo de vida das partículas (onde partículas mortas são removidas em 4685/4692) ou auto-release no `acquire`; confirmar que o pool para de crescer.
- [ ] **Áudio** (6318+):
  - Consumir `_nodePool` (10 osc+gain, 6374-6377) em `play()` (6395-6415).
  - `disconnect()` nos nós em `onended` (evitar retenção até GC).
  - `playAmbientDrone` (6697-6718): reutilizar os 3 nós em vez de recriar 1×/s.
  - `ctx.suspend()` em `visibilitychange` (background) e `resume()` ao voltar.
- [ ] **Start-screen particles** (21157-21200): parar o rAF quando `gameState !== 'START'` (guard por estado + `cancelAnimationFrame`); o elemento nunca sai do DOM hoje.
- [ ] (Verificar) `_lightingDirty` (4994/5276/5606) — setado e nunca lido; se o throttle por módulo já cobre, remover.

**Verificação:** sessão de 10+ min com combate intenso — tamanho do pool de partículas estável (console), `Performance.memory` sem crescimento monotônico, zero `AudioContext` ativo em background (devtools), FPS estável.

---

## Fase 2 — Código morto, stubs e centralização de saves
*Razão: reduz custo cognitivo e impede que a UI prometa o que não existe.*

- [ ] **EventBus** (9443-9457): ligar nas relíquias (a intenção documentada em 9441-9442) **ou** remover. Decidir com base na Fase 5 (se relíquias ganharem eventos).
- [ ] **Stubs**: crafting (9077-9084), resources (9054-9070), leaderboard (9462-9466) — implementar (Fase 5) ou remover UI/referências (ex.: dica 16854).
- [ ] **Daily challenge** (9468+): aplicar os modificadores definidos (enemySpeed, oneHit, escuridão…) ou removê-los da UI — hoje são cosméticos.
- [ ] **`_worldDirty`** (1640) + `WORLD_REDRAW_THROTTLE` (2931): honrar o dirty flag (skip de `_drawWorldLayer` quando câmera parada) ou remover e documentar a composição como intencional. *(Se optar por implementar o cache: Fase 3.)*
- [ ] Remover/limpar código morto: `PARTICLE_CAP=100` (12115), métodos mortos de `RunState` (9347-9440), hack `startGame.toString().includes('warn')` (19577), `toggleLore_original` (8665), `_originalEnemyDeath` (9748), `tutorial-full-btn` (19763), `STAGES_FULL`/modo `full` do tutorial (19604-19803).
- [ ] **Centralizar chaves localStorage** (~12 chaves diretas: lang, audio_settings, vibration, difficulty, mode, seed, run_states, daily, bestiary, settings) no StorageManager com versão — habilita migração e limpeza seguras.

**Verificação:** `grep` por cada símbolo removido retorna 0 usos; jogo roda; saves antigos continuam carregando (compatibilidade).

---

## Fase 3 — Performance (cumprir as promessas do README)
*Razão: README vende "cache de camadas estáticas" e "60FPS em mobile"; hoje a camada do mundo é 100% redesenho por frame.*

- [ ] **Cache da camada do mundo**: `_drawWorldLayer` (5084-5227) é chamado todo frame (5544); quando câmera parada e nada sujo, blitar o `worldCanvas` cacheado em vez de redesenhá-lo.
- [ ] **SpatialHash lazy** (4638-4641): rebuild só quando há projéteis vivos (o hash só é consultado por balas, 15623).
- [ ] **Auto-res mais responsivo** (6122-6134): janela de medição menor + degraus maiores na queda (ex.: 0.85/0.7/0.6); manter recuperação conservadora (15s).

**Verificação:** medir FPS com devtools em throttling de CPU 4×/6×; comparar antes/depois; sem regressão visual.

---

## Fase 4 — i18n real (pt/en/es)
*Razão: o seletor de idioma existe e traduz ~30-40%; conteúdo do jogo permanece em pt.*

- [ ] Migrar para `I18n.STRINGS`: tutorial (19599-19657), pool de quests (9093-9104), run events (7850-7875), run objectives (8014-8020), shop (7351-7397), relics (17431-17443), boons (7693-7704), achievements (7106-7130), chefes (14194-14206), NPCs (16557-16569), SettingsUI (17990-18036), ~25 pontos de `addLog`/`showToast` hardcoded (3837, 4855-4856, 4933, 4966-4980, 5858-5997, 9026-9041, 9161, 17067, 19149-19162, 19382-19432, 19841, 21069).
- [ ] Estender `data-i18n` além do painel de pausa (hoje 1251-1259).
- [ ] Decidir cobertura: HUD completo traduzido ou manter HUD em pt com conteúdo traduzido (recomendado: traduzir tudo; volume é grande, pode ser dividido em sub-etapas por sistema).

**Verificação:** mudar idioma para en/es e revisar cada tela (HUD, loja, tutorial, quests, diário, settings); dicionário sem chaves órfãs.

---

## Fase 5 — Features anunciadas (conteúdo que existe só na superfície)
*Razão: três sistemas são stubs; duas features têm UI mas não funcionam.*

- [ ] **Daily challenge funcional**: aplicar modificadores seguros primeiro (inimigos mais rápidos, escuridão, +HP chefe); validar balanceamento.
- [ ] **Crafting**: sistema mínimo com receitas a partir de drops, ou remover a dica in-game (16854) e o botão oculto (19506).
- [ ] **Tutorial completo**: definir `STAGES_FULL` (2ª sessão de estágios) ou remover a referência ao modo.
- [ ] **Leaderboard**: implementar ranking por classe (prometido no comentário 9462) ou remover.
- [ ] **README final**: documentar o estado real pós-melhorias.

**Verificação:** cada feature testada jogável de ponta a ponta (entrar na daily com modificador ativo e confirmar efeito em jogo; craftar 1 item do início ao fim).

---

## Fase 6 — PWA de verdade (opcional — decisão do usuário)
*Razão: o README promete "fully installable and playable offline"; hoje não há service worker.*

- [ ] Adicionar `sw.js` (cache-first com versão) + registro no `index.html`.
- [ ] Tradeoff: deixa de ser estritamente single-file; SW só ativa sob http(s) (abrir o arquivo direto continua funcionando sem ele).
- [ ] Alternativa: manter single-file e ajustar o README para não prometer SW.

**Verificação:** Lighthouse PWA / instalar via Chrome Android, voar offline, atualizar versão e confirmar refresh.

---

## Regras de execução

1. **Uma fase por sessão de trabalho**; cada fase termina com commit próprio e tag descritiva.
2. **Verificar após cada fase**: o jogo inicia, a fase de jogo roda, saves antigos carregam.
3. **Nunca editar o `index.html` sem o commit baseline da Fase 0.**
4. Linhas de código morto só são removidas com `grep` comprovando 0 usos.
5. Se optar pela decisão aberta (B — restaurar fonte separada), a Fase 0 inclui o script de build e as fases 2-5 passam a editar a árvore `js/` e regerar o `index.html`.

---

## Ordem sugerida de prioridade

**Fase 0 → 1 → 2 → 3 → 4 → 5**, com 6 opcional. A Fase 0 e a 1 são as de maior valor por risco: fundação + bugs reais de memória/bateria. A decisão aberta (arquivo único vs fonte separada) deve ser tomada antes da Fase 2.
