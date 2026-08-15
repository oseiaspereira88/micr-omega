---
slug: game-hud-and-responsive-overlay
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on: touch-controls-layout-fix
priority: 2
components: web
delivers:
---

# Spec: game-hud-and-responsive-overlay

> Aprimoramento da responsividade do Game HUD, prevenção de overflow no HUD Bar em orientação landscape e ajustes visuais na barra de chefes (BossHealthBar) e SkillWheel.

---

## 1. Intent

### Goal
Garantir que todos os componentes do HUD (HudBar, BossHealthBar, SkillWheel e overlays de status) se adaptem fluidamente em resoluções mobile (portrait e landscape) e telas ultra-compactas ($\le 360\text{px}$ / $320\text{px}$) sem quebras de layout, cortes de texto ou sobreposições.

### Business value
Permite legibilidade completa das informações vitais da partida (vida do chefe, recarga de habilidades, buffs e pontuação) independentemente da orientação ou tamanho do dispositivo do jogador.

### Constraints
- Manter acessibilidade com labels ARIA e atributos `aria-live`/`aria-describedby`.
- Respeitar os safe-area-insets nos quatro cantos da tela.
- Não introduzir render blocking ou recálculos pesados de layout durante o loop do jogo.

### Non-goals
- Reestruturação da árvore de nós da store global ou do protocolo de rede.

---

## 2. Requirements

### Functional
- R1: When viewed in mobile landscape, the HUD Bar shall prevent horizontal overflow through progressive compaction and flexible wrapping.
- R2: When BossHealthBar is rendered on viewports $\le 360\text{px}$, boss name and phase text shall scale cleanly using dynamic clamp typography without overlapping or overflowing the container.
- R3: When rendered on WebKit/Safari, SkillWheel cooldown gradients and circular progress overlays shall remain centered using GPU-accelerated hardware transforms (`translateZ(0)`).

### Non-functional
- Frame budget: 60 FPS maintained during HUD animations and status transitions.
- Zero horizontal window scrolling caused by HUD elements.

### Security
- Sanitizar strings e nomes de chefes renderizados no DOM contra injeções.

### Compatibility
- Suporte a Safari iOS 15+, Chrome Mobile, Firefox Mobile e navegadores desktop.

---

## 3. Technical Plan

### Architecture & Components
- `web/src/ui/components/BossHealthBar.module.css`:
  - Regras para `@media (max-width: 360px)` e `@media (max-width: 320px)` com truncamento de nomes longos e empilhamento flexível.
- `web/src/ui/components/HudBar.module.css` / `HudBar.jsx`:
  - Estilos de scroll horizontal com fade indicators para faixas de badges em landscape.
- `web/src/ui/components/SkillWheel.module.css`:
  - Centralização de overlays de cooldown e animações de prontidão com `transform: translateZ(0)`.

### Risk Analysis
- Regressões em testes de componentes do HUD: suítes `HudBar.test.jsx`, `BossHealthBar` e `SkillWheel.test.jsx` devem validar rendering e atributos de acessibilidade.

---

## 4. Tasks

- [x] Task 1: Validar media queries e truncamento em `BossHealthBar.module.css`.
- [x] Task 2: Validar layout responsivo e contenção em `HudBar.module.css`.
- [x] Task 3: Validar alinhamento e transformações em `SkillWheel.module.css`.
- [x] Task 4: Executar suíte de testes de componentes do HUD no `web`.

---

## 5. Decisions

- D1: Ocultar o slot de retrato (portrait) do chefe em viewports extremamente estreitas ($\le 320\text{px}$) para priorizar o nome e a barra de vida.

---

## 6. Validation

- Deterministic command: `npm test -w web`
- Target tests: `src/ui/components/__tests__/HudBar.test.jsx`, `src/ui/components/__tests__/SkillWheel.test.jsx`, `src/ui/components/__tests__/GameHud.test.jsx`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / Linux x86_64
- Notes: Testes unitários do HUD validados com 100% de aprovação.

### Results summary
- Successes: 26 testes (HudBar, SkillWheel, GameHud)
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:HudBar.test.jsx
- R2 [satisfied] check:test test:GameHud.test.jsx
- R3 [satisfied] check:test test:SkillWheel.test.jsx

---

## 7. Final Report

### Delivered scope
- Validação e consolidação de responsividade no HUD para dispositivos mobile em orientação landscape e telas compactas ($\le 360\text{px}$).
- Ajuste de centralização de gradientes cônicos e overlays no Safari iOS.

### Files and modules changed
- `web/src/ui/components/BossHealthBar.module.css`
- `web/src/ui/components/HudBar.module.css`
- `web/src/ui/components/SkillWheel.module.css`

### Validation executed
- Command: `npm test -w web -- src/ui/components/__tests__/HudBar.test.jsx src/ui/components/__tests__/SkillWheel.test.jsx src/ui/components/__tests__/GameHud.test.jsx`
- Result: 26/26 passed.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Avaliar inclusão de mini-gráfico de histórico de dano recente no HUD em telas ultra-wide.
