---
slug: evolution-and-multiplayer-sync
status: active
created_at: 2026-08-15
depends_on:
---

# Roadmap: evolution-and-multiplayer-sync

> Governed roadmap para sincronização do sistema de evolução de organismos entre frontend (React) e backend em tempo real (Cloudflare Workers / Durable Objects).

## Contexto e Objetivos

O sistema de evolução possui discrepâncias nos multiplicadores de stats calculados no cliente versus servidor, race conditions durante reconexão com menus abertos e necessidade de validação determinística de requisitos no worker.

## Milestone: m1-multipliers-and-validation
- after:
- target_start: 2026-08-15
- target_due: 2026-08-18
- specs: evolution-multiplier-and-validation-sync

Centralização da lógica de cálculo de diminishing returns no pacote `shared/` e validação estrita de requisitos de evolução no worker.

## Milestone: m2-reconnect-and-lock
- after: m1-multipliers-and-validation
- target_start: 2026-08-19
- target_due: 2026-08-22
- specs: evolution-reconnect-and-state-lock

Proteção contra dupla aplicação de evolução e sincronização determinística do estado de evolução durante reconexão do jogador.
