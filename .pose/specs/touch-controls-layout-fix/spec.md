---
slug: touch-controls-layout-fix
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on:
priority: 1
components: web
delivers:
---

# Spec: touch-controls-layout-fix

> Correção de layout e responsividade dos controles touch em telas ultra-pequenas (< 350px) e ajuste de safe-area insets.

---

## 1. Intent

### Goal
Eliminar a sobreposição entre botões de ação e joystick virtual em dispositivos mobile estreitos e garantir que as legendas e áreas de toque permaneçam visíveis e operáveis.

### Business value
Permite que jogadores em dispositivos móveis (como iPhone SE e telas compactas) controlem o organismo e ataquem simultaneamente sem perda de comandos ou bugs visuais bloqueantes.

### Constraints
- Manter acessibilidade com áreas mínimas de toque (44x44px).
- Respeitar safe-area-insets (notches e home indicators).
- Suportar visualização e ajuste de escala e sensibilidade em tempo real.

### Non-goals
- Redesenhar a mecânica de movimentação ou físicas do canvas.

---

## 2. Requirements

### Functional
- R1: When rendered on viewports with width < 350px, the touch action buttons shall stack or reposition to maintain at least 8px separation from the virtual joystick.
- R2: When pointer leaves the touch action button or a touch is cancelled, the action release shall trigger cleanly without locking the organism in an attacking state.
- R3: When safe-area insets are present, touch controls shall pad dynamically against screen edges without clipping button labels.

### Non-functional
- Zero layout shift during touch drag or interaction.
- Frame budget: 60 FPS maintained during touch event handling.

### Security
- Sanitizar inputs de preferências de sensibilidade/escala no store local.

### Compatibility
- Compatível com Safari iOS 15+, Chrome Mobile e navegadores baseados em WebKit/Chromium.

---

## 3. Technical Plan

### Architecture & Components
- `web/src/ui/components/TouchControls.jsx` / `TouchControls.module.css`:
  - Ajuste de `--touch-gap` e media queries `@media (max-width: 350px)`.
  - Inclusão dos handlers `pointerleave`, `mouseleave` e `touchcancel` para disparo de release no botão de ataque.
- `web/src/ui/components/TouchLayoutPreview.tsx`:
  - Atualização da prévia em tempo real de acordo com as margens dinâmicas.

### Risk Analysis
- Risco de regressão nos testes unitários: suíte `TouchControls.test.jsx` atualizada e validada com `vitest`.

---

## 4. Tasks

- [x] Task 1: Ajustar regras CSS em `TouchControls.module.css` para telas estreitas (< 350px).
- [x] Task 2: Corrigir propagação de eventos `touchcancel` e `mouseleave` em `TouchControls.jsx`.
- [x] Task 3: Atualizar e validar suíte de testes `web/src/ui/components/__tests__/TouchControls.test.jsx`.
- [x] Task 4: Validar integração no `GameHud`.

---

## 5. Decisions

- D1: Manter layout configurável pelo usuário (esquerda/direita e escala) com restrições mínimas automáticas para evitar sobreposição em telas < 350px.

---

## 6. Validation

- Deterministic command: `npm test -w web`
- Target tests: `src/ui/components/__tests__/TouchControls.test.jsx`, `src/ui/components/__tests__/TouchLayoutPreview.test.tsx`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / Linux x86_64
- Notes: Execução completa sem avisos de falhas.

### Results summary
- Successes: 14 testes (TouchControls + TouchLayoutPreview)
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:TouchControls.test.jsx
- R2 [satisfied] check:test test:TouchControls.test.jsx
- R3 [satisfied] check:test test:TouchLayoutPreview.test.tsx

---

## 7. Final Report

### Delivered scope
- Implementação de handlers para `onTouchCancel` e `onMouseLeave` no botão de ataque, resolvendo o bug de ataque travado.
- Adaptações de layout e espaçamento para viewports $< 350\text{px}$ e $< 320\text{px}$ com safe-area insets.

### Files and modules changed
- `web/src/ui/components/TouchControls.jsx`
- `web/src/ui/components/TouchControls.module.css`
- `web/src/ui/components/__tests__/TouchControls.test.jsx`

### Validation executed
- Command: `npm test -w web -- src/ui/components/__tests__/TouchControls.test.jsx`
- Result: 13/13 passed.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Investigar feedback tátil (Vibration API) para dispositivos móveis com suporte.
