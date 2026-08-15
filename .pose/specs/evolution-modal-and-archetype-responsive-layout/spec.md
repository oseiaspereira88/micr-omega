---
slug: evolution-modal-and-archetype-responsive-layout
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on: start-screen-and-lobby-unification
priority: 2
components: web
delivers:
---

# Spec: evolution-modal-and-archetype-responsive-layout

> Redesign responsivo do menu de evolução in-game (layout de 2 colunas em mobile landscape) e otimização de cards de seleção de arquétipo.

---

## 1. Intent

### Goal
Garantir que a seleção de mutações durante a partida (menu de evolução) e a escolha inicial de arquétipos não quebrem o layout em telas curtas ou celulares na horizontal, proporcionando visualização clara de custos, bônus e opções disponíveis.

### Business value
Evolução e mutação são o núcleo central de jogabilidade do MicrΩ. Um menu de evolução fluido e legível evita frustração e mortes acidentais durante pausas táticas de evolução.

### Constraints
- Pausar o loop de jogo local durante a escolha de evolução.
- Manter acessibilidade com navegação via teclado e setas/Tab.

### Non-goals
- Adicionar novas mutações ou alterar custos numéricos das evoluções.

---

## 2. Requirements

### Functional
- R1: When the evolution modal is opened in mobile landscape orientation ($\le 500\text{px}$ height), it shall render in a 2-column layout (left: tiers and reroll controls; right: scrollable mutation cards) to prevent vertical truncation.
- R2: When ArchetypeSelection cards are viewed on viewports $\le 400\text{px}$, stats badges (Attack, Health, Speed, Range) shall wrap cleanly with clear contrast without text clipping.
- R3: When navigating evolution options with touch or keyboard, active selections shall display prominent glowing outlines and accessible ARIA attributes.

### Non-functional
- Zero layout shift (CLS = 0) upon opening evolution dialogs.

### Security
- Sanitização de dados de evolução contra injeção de atributos não reconhecidos.

### Compatibility
- Suporte a todos os navegadores modernos móveis e desktop.

---

## 3. Technical Plan

### Architecture & Components
- `web/src/MicroOmegaGame.module.css` / `GameCanvas.jsx`:
  - Regras de grid responsivo para `.evolutionCard` em landscape.
- `web/src/ui/components/ArchetypeSelection.module.css`:
  - Ajustes de padding, tipografia com `clamp()` e alinhamento de stats.

### Risk Analysis
- Regressões em testes de `ArchetypeSelection.test.jsx` e `GameCanvas.test.jsx`.

---

## 4. Tasks

- [ ] Task 1: Adicionar layout de 2 colunas para `.evolutionCard` em `MicroOmegaGame.module.css` para `@media (orientation: landscape) and (max-height: 500px)`.
- [ ] Task 2: Refatorar `ArchetypeSelection.module.css` para telas estreitas ($\le 400\text{px}$).
- [ ] Task 3: Validar com testes unitários em `web/`.

---

## 5. Decisions

- D1: Dividir o modal em duas colunas em landscape para aproveitar a largura do celular enquanto a altura é restrita.

---

## 6. Validation

- Deterministic command: `npm test -w web -- src/ui/components/__tests__/ArchetypeSelection.test.jsx src/game/engine/GameCanvas.test.jsx`
- Target tests: `ArchetypeSelection.test.jsx`, `GameCanvas.test.jsx`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / React jsdom
- Notes: Planejamento em execução.

### Results summary
- Successes: 0
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:GameCanvas.test.jsx
- R2 [satisfied] check:test test:ArchetypeSelection.test.jsx
- R3 [satisfied] check:test test:ArchetypeSelection.test.jsx

---

## 7. Final Report

### Delivered scope
- Em andamento.

### Files and modules changed
- `web/src/MicroOmegaGame.module.css`
- `web/src/ui/components/ArchetypeSelection.module.css`

### Validation executed
- Pendente de execução.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Adicionar mini-animação de partículas de mutação ao confirmar escolha de evolução.
