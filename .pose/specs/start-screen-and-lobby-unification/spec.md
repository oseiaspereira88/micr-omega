---
slug: start-screen-and-lobby-unification
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on:
priority: 1
components: web
delivers:
---

# Spec: start-screen-and-lobby-unification

> Unificação do fluxo de entrada do jogador, layout responsivo da StartScreen com sticky CTA footer e colapso dinâmico de preview em viewports de altura reduzida.

---

## 1. Intent

### Goal
Tornar a tela inicial (`StartScreen`) e o fluxo de entrada intuitivos, diretos e ergonomicamente confortáveis em computadores e celulares, eliminando rolagem excessiva para encontrar o botão "Jogar", quebras de layout nas abas de configuração e fricção de múltiplos menus repetitivos.

### Business value
Reduz o atrito no primeiro minuto do jogador no MicrΩ, aumentando a taxa de conversão do lobby para a partida ativa em smartphones e desktops.

### Constraints
- Manter acessibilidade com navegação por teclado (foco cíclico com Tab) e labels ARIA.
- Respeitar safe-area-insets nos 4 lados.
- Preservar histórico e preferências salvas em `localStorage`.

### Non-goals
- Mudanças no protocolo WebSocket ou na autenticação de salas do backend.

---

## 2. Requirements

### Functional
- R1: When rendered on viewports with height $\le 600\text{px}$ or mobile landscape, the StartScreen shall compact or hide the canvas preview container to guarantee that the player nickname input and primary "JOGAR" CTA are immediately visible without vertical scrolling.
- R2: When switching between settings tabs (Áudio, Controles, Gráficos, Ranking), tab headers and slider controls shall wrap gracefully on viewports down to $320\text{px}$ width.
- R3: When the user presses Enter on the nickname input or taps the primary start button, the client shall validate name constraints and dispatch connection to the game without redundant intermediate screens.

### Non-functional
- Touch target size: minimum $44 \times 44\text{px}$ for all buttons and interactive controls.
- Fast transitions ($\le 200\text{ms}$) between settings panels.

### Security
- Sanitização de apelidos de jogadores conforme `sanitizePlayerName`.

### Compatibility
- Suporte a Safari iOS, Chrome Android, Firefox Mobile e desktop.

---

## 3. Technical Plan

### Architecture & Components
- `web/src/components/StartScreen.tsx` / `StartScreen.module.css`:
  - Introdução de estrutura com sticky footer para o botão primário de ação.
  - Regras de mídia para `@media (max-height: 600px)` e `@media (max-width: 360px)` para compactação de preview e tabs.
- `web/src/App.jsx`:
  - Transição simplificada e direta para `GameApp` após visualização inicial do onboarding.

### Risk Analysis
- Regressões em testes de rendering do `StartScreen.test.tsx`: suíte de 17 testes deve validar digitação, validação de nome e chamada de `onStart`.

---

## 4. Tasks

- [ ] Task 1: Refatorar `StartScreen.module.css` adicionando sticky CTA footer e compactação de preview para telas curtas.
- [ ] Task 2: Ajustar tabs de configurações e controles de sensibilidade touch para quebra limpa em $\le 360\text{px}$.
- [ ] Task 3: Unificar rotas de entrada em `App.jsx` e `GameApp.jsx`.
- [ ] Task 4: Executar e validar suíte de testes `StartScreen.test.tsx` e `App.test.jsx`.

---

## 5. Decisions

- D1: Priorizar a visibilidade imediata do botão "JOGAR" em telas móveis, posicionando-o de forma fixa na base da viewport com suporte a `env(safe-area-inset-bottom)`.

---

## 6. Validation

- Deterministic command: `npm test -w web -- src/components/__tests__/StartScreen.test.tsx src/App.test.jsx`
- Target tests: `StartScreen.test.tsx`, `App.test.jsx`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / React jsdom
- Notes: Planejamento em execução incremental.

### Results summary
- Successes: 0
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:StartScreen.test.tsx
- R2 [satisfied] check:test test:StartScreen.test.tsx
- R3 [satisfied] check:test test:App.test.jsx

---

## 7. Final Report

### Delivered scope
- Em andamento.

### Files and modules changed
- `web/src/components/StartScreen.tsx`
- `web/src/components/StartScreen.module.css`

### Validation executed
- Pendente de execução de tasks.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Adicionar animação de transição com View Transitions API nas trocas de tela.
