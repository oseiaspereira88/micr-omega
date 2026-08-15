---
slug: ui-responsiveness-and-visual-fixes
status: active
created_at: 2026-08-15
depends_on:
---

# Roadmap: ui-responsiveness-and-visual-fixes

> Governed roadmap para correção de bugs visuais críticos, responsividade em dispositivos móveis e desktops, refinamento de HUD e controles touch.

## Contexto e Objetivos

O jogo apresenta bugs visuais críticos em viewports móveis e telas reduzidas (sobreposição de controles touch, quebra de layout no HUD, desalinhamento de overlays de cooldown e cortes de texto em boss fights). Este roadmap organiza a resolução metódica desses problemas.

## Milestone: m1-touch-controls
- after:
- target_start: 2026-08-15
- target_due: 2026-08-17
- specs: touch-controls-layout-fix

Correção de layout, responsividade em telas ultra-pequenas (< 350px), prevenção de sobreposição de botões e suporte a safe area insets.

## Milestone: m2-hud-and-overlays
- after: m1-touch-controls
- target_start: 2026-08-18
- target_due: 2026-08-20
- specs: game-hud-and-responsive-overlay

Tratamento de overflow horizontal no HUD bar, truncamento e posicionamento do BossHealthBar e alinhamento dos gradientes cônicos da SkillWheel.
