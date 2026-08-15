---
slug: ui-complete-revamp-and-responsiveness
status: active
created_at: 2026-08-15
depends_on: ui-responsiveness-and-visual-fixes
---

# Roadmap: ui-complete-revamp-and-responsiveness

> Reestruturação profunda e unificação de responsividade, hierarquia visual e ergonomia em todas as telas e menus do MicrΩ (StartScreen, Seleção de Arquétipos, Modal de Evolução In-Game, GameOverScreen e Ranking).

---

## 1. Visão Geral e Objetivos

Transformar a experiência visual e interativa do MicrΩ em uma interface coesa, moderna e 100% responsiva em computadores desktop (1080p, 1440p, ultra-wide) e dispositivos móveis (smartphones em portrait e landscape, tablets, telas com notch/safe-areas e resoluções estreitas de 320px a 430px).

### Critérios de Sucesso
1. **Zero Overlap & Zero Clipping**: Nenhum botão, texto, card ou toast de status sobreposto ou cortado em qualquer resolução suportada.
2. **One-Tap Action Reachability**: O botão primário de ação (ex: "Jogar", "Evoluir", "Jogar Novamente") deve estar imediatamente visível e acessível sem rolagem acidental.
3. **Ergonomia Mobile**: Alvos de toque $\ge 44 \times 44\text{px}$, suporte a safe-area insets e transições fluidas a 60 FPS sem reflows.

---

## 2. Milestones

### Milestone `m1-lobby-and-start-screen`
- **Spec**: `start-screen-and-lobby-unification`
- **Objetivo**: Unificar o fluxo de entrada (Lobby + StartScreen), adicionar sticky footer com CTA "Jogar", colapsar preview em telas curtas e otimizar formulários em mobile.

### Milestone `m2-in-game-modals-and-archetypes`
- **Spec**: `evolution-modal-and-archetype-responsive-layout`
- **Objetivo**: Redesenhar o modal de evolução in-game para layout de 2 colunas em mobile landscape e otimizar os cards de seleção de arquétipos.

### Milestone `m3-game-over-and-leaderboards`
- **Spec**: `game-over-and-ranking-responsive-polish`
- **Objetivo**: Responsividade completa do `GameOverScreen` e `RankingPanel` em telas $\le 360\text{px}$, tipografia tabular e prevenção de overflow horizontal.
