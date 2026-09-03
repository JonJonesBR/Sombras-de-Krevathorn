# NÃO COMMITAR / Diretrizes do Projeto — Sombras de Krevathorn

Guia de comportamento para agentes e sessões de orquestração neste repositório.
Complementa `PLANO_MELHORIAS.md` (backlog/estado) e `.omp/orchestration-state.md` (ledger técnico).

## Arquitetura (decisões registradas — não reverter sem motivo)

- **Arquivo único**: o jogo é `index.html` (~25k linhas, JS vanilla + Canvas, zero dependências) + `sw.js` (PWA offline). Decisão A do plano (fonte separada + build foi **rejeitada**): editar direto no `index.html`.
- **Sem build**. Rodar com servidor local (`python -m http.server 8123 --bind 127.0.0.1`). `file://` funciona mas sem service worker.
- **Código morto removido não volta**: EventBus, RunState, `recycleParticles`, leaderboard/resources/crafting stubs antigos, `_worldDirty`, `toggleLore_original`, `_originalEnemyDeath` — todos removidos em rodadas passadas com `grep` provando 0 usos.
- **Dano e recompensas são centralizados** em `Entity.takeDamage` (source `=== player`): damageMult/damageBoost aplicam **uma única vez** ali, e `awardKillRewards` (XP/abates/combo/loot) roda só ali. NUNCA aplicar damageMult/damageBoost de novo num call site, nem incrementar contadores de kill fora do takeDamage — duplica dano e recompensa.
- **Projéteis inimigos passam `source=null`** no `takeDamage` — dano recebido não pode inflar com damageMult/damageBoost do jogador.
- Chaves localStorage centralizadas no `StorageManager` (registro `RAW` + store versionada `audio` com import de legado). Não criar chaves soltas.
- Caches reais: `Map.buffer` (tiles), `lightCanvas` (luz), `_mmBuffer` (minimapa). Não reintroduzir dirty flags globais por módulo.

## Zonas proibidas

- `.omp/` é **ignorado pelo git** (ledger, planos de teste, referências, screenshots). Nunca force commit disso.
- Nunca commitar segredos/chaves (não existem no projeto; não criar).
- Não mudar a convenção de publicação (git push para GitHub) nem ativar GitHub Pages sem decisão do usuário.
- Melhorias de alto risco (mudança de regra de negócio, formato de save, remoção de fluxo, reforma visual ampla) só com aprovação do usuário — ver backlog no `PLANO_MELHORIAS.md`.

## Armadilhas conhecidas do ambiente

- **Pasta sincronizada (Google Drive "Meu Drive")**: scans nativos (`read`/`glob`) falham ou crasham (access violation), e git pode travar. Gate obrigatório: clonar para `%LOCALAPPDATA%\omp-workspaces\<projeto>` e operar a rodada ali; copiar `.omp/` e planos de/para a pasta original no início/fim.
- **Service worker cacheia**: `sw.js` usa stale-while-revalidate com `CACHE_VERSION` (`krevathorn-v4`). Ao publicar mudança de jogo, **bump da versão** — senão usuários recebem versão velha. Em teste local, limpar `caches` + `unregister()` antes de recarregar para ver o arquivo novo.
- **Controle 'mouse' automático no desktop**: `Input.pollMouse()` zera o joystick direito a cada frame sem `mouse.down`. Em harness programático, setar `GameSettings.controlType = 'touch'` e dirigir `Input.right`/`Input.keys`.
- **`Player.takeDamage` tem override**: `invincibleTimer` (15 ticks pós-hit) e escala por `DifficultySystem.getPlayerDamageTakenMult()`. Testes de dano direto precisam zerar `player.invincibleTimer`.
- **Desafio diário**: roda por data (`YYYYMMDD % 8` sobre a lista de desafios). Só `tank` (warrior) e `sniper` (mage) forçam classe; o desafio só vale quando o jogador escolhe exatamente a classe exigida (`_applyDailyIfEligible`).
- **Inimigos ranged fogem** do melee — testes de dano corpo-a-corpo devem usar inimigos melee ou perseguição contínua.
- **CI mínima**: `.github/workflows/ci.yml` + `.github/check-js.js` valida sintaxe dos scripts inline. Rodar `node .github/check-js.js` após qualquer edição de JS.

## Comportamento da rodada

1. Ler na ordem: regras do `.omp/AGENTS.md` (contrato do repositório) → este arquivo → `PLANO_MELHORIAS.md` → `PLANO_MELHORIAS_PROGRESSO.md` (→ ledger `.omp/orchestration-state.md`).
2. Auditoria conservadora (não mexer no que está aprovado); evolução só com orçamento explícito (3-5 baixo risco + 1 médio por rodada).
3. Verificação com evidência real (browser/console/estado), nunca "deve funcionar".
4. Commits atômicos: `fix:` para correção, `feat:`/`melhoria:` para evolução — separados. Atualizar ledger e planos a cada rodada.
5. Ao final: relatório Fase 7 com fluxos testados, pendências e itens que exigem decisão do usuário.
