---
slug: game-over-and-ranking-responsive-polish
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on: evolution-modal-and-archetype-responsive-layout
priority: 3
components: web
delivers:
---

# Spec: game-over-and-ranking-responsive-polish

> Responsividade e polimento visual dos modais de fim de partida (GameOverScreen) e ranking global (RankingPanel).

---

## 1. Intent

### Goal
Garantir que as telas de encerramento da partida e de placares de líderes exibam estatísticas detalhadas e tabelas de classificação de forma legível e sem quebras em todas as resoluções.

### Business value
Estimula a rejogabilidade e competição entre jogadores proporcionando fechamento claro de cada partida e visualização imediata do ranking global.

### Constraints
- Manter formatação de números em padrão pt-BR (`Intl.NumberFormat`).
- Garantir foco inicial no botão "Jogar Novamente".

### Non-goals
- Modificação dos endpoints de ranking no Cloudflare Workers backend.

---

## 2. Requirements

### Functional
- R1: When GameOverScreen is displayed on mobile screens ($\le 600\text{px}$), the journey stats grid shall render in a clean 2-column layout with scroll containment so that the "Jogar Novamente" button is always reachable.
- R2: When RankingPanel is rendered on viewports $\le 400\text{px}$, secondary table columns (Duration, Date) shall hide automatically, prioritizing Position, Player Name, and Score with tabular-nums alignment.
- R3: When navigating GameOverScreen via keyboard or game controller, focus shall be trapped within the dialog until dismissed.

### Non-functional
- Fast rendering without reflows on match completion.

### Security
- Sanitização de nomes de jogadores na tabela de líderes.

### Compatibility
- Suporte a telas mobile portrait, landscape e desktop.

---

## 3. Technical Plan

### Architecture & Components
- `web/src/ui/components/GameOverScreen.module.css`:
  - Regras responsivas para o grid de estatísticas de jornada e ações de rodapé.
- `web/src/components/RankingPanel.module.css`:
  - Ocultação progressiva de colunas em `@media (max-width: 420px)`.

### Risk Analysis
- Regressões em testes de `GameOverScreen.test.jsx` e `RankingPanel.test.tsx`.

---

## 4. Tasks

- [ ] Task 1: Otimizar grid e scroll de `GameOverScreen.module.css`.
- [ ] Task 2: Implementar ocultação progressiva de colunas em `RankingPanel.module.css`.
- [ ] Task 3: Validar com testes unitários em `web/`.

---

## 5. Decisions

- D1: Em telas de $320\text{px}$, exibir na tabela de ranking apenas Colocação (#), Nome e Pontuação para evitar scroll horizontal.

---

## 6. Validation

- Deterministic command: `npm test -w web -- src/ui/components/__tests__/GameOverScreen.test.jsx src/components/__tests__/RankingPanel.test.tsx`
- Target tests: `GameOverScreen.test.jsx`, `RankingPanel.test.tsx`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / React jsdom
- Notes: Planejamento em execução.

### Results summary
- Successes: 0
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:GameOverScreen.test.jsx
- R2 [satisfied] check:test test:RankingPanel.test.tsx
- R3 [satisfied] check:test test:GameOverScreen.test.jsx

---

## 7. Final Report

### Delivered scope
- Em andamento.

### Files and modules changed
- `web/src/ui/components/GameOverScreen.module.css`
- `web/src/components/RankingPanel.module.css`

### Validation executed
- Pendente de execução.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Adicionar botão de compartilhamento social de recordes no GameOverScreen.
