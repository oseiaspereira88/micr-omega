---
slug: evolution-multiplier-and-validation-sync
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on:
priority: 1
components: shared, worker, web
delivers:
---

# Spec: evolution-multiplier-and-validation-sync

> Centralização da lógica de cálculo de diminishing returns no pacote `shared/` e validação estrita de requisitos de evolução no worker Durable Objects.

---

## 1. Intent

### Goal
Eliminar discrepâncias de cálculo de bônus de evolução e diminishing returns entre cliente React e servidor Cloudflare Workers, além de garantir validação server-side de recursos e requisitos para impedir exploits ou corrupção de atributos de combate.

### Business value
Garante integridade e paridade competitiva no modo multiplayer, impedindo que jogadores modifiquem localmente atributos de combate ou realizem evoluções sem atender aos custos de materiais genéticos, fragmentos e slots.

### Constraints
- Manter compatibilidade com tipos compartilhados em `@micr-omega/shared`.
- Manter execução sem atraso perceptível no WebSocket (< 5ms de processamento por ação).

### Non-goals
- Reformulação das fórmulas de scaling de XP ou introdução de novos tiers além de small/medium/large/macro.

---

## 2. Requirements

### Functional
- R1: When calculating diminishing returns for evolutions, both web client and worker server shall invoke `calculateDiminishingMultiplier` from `@micr-omega/shared`.
- R2: When a player sends an evolution action message over WebSocket, the worker shall validate level, genetic material (MG), characteristic points (PC), fragments, and available slots via `validateEvolutionRequirements` before mutating state.
- R3: When evolution requirements are not met, the worker shall reject the evolution action and log a structured warning without corrupting the player's internal state.

### Non-functional
- Pure deterministic computation with zero floating-point drift across platforms.

### Security
- Server-authoritative validation preventing client-side bypass of costs and tier limits.

### Compatibility
- Compatível com Miniflare v3 e Cloudflare Workers runtime.

---

## 3. Technical Plan

### Architecture & Components
- `shared/src/evolutionCalculations.ts`:
  - Centralização de `DIMINISHING_CONFIGS` e `calculateDiminishingMultiplier`.
- `worker/src/evolutionValidator.ts`:
  - Implementação de `validateEvolutionRequirements(player, requirements, cost, tier)`.
- `worker/src/playerManager.ts` / `RoomDO.ts`:
  - Aplicação dos modificadores de combate e sincronização de atributos calculados.

### Risk Analysis
- Dessincronia de atributos entre cliente e servidor: validado pela suíte `test/evolution-sync.test.ts`.

---

## 4. Tasks

- [x] Task 1: Centralizar `calculateDiminishingMultiplier` no pacote `@micr-omega/shared`.
- [x] Task 2: Implementar e integrar `validateEvolutionRequirements` no `RoomDO.ts`.
- [x] Task 3: Atualizar e validar testes em `worker/test/evolution-sync.test.ts`.
- [x] Task 4: Validar integração com `web/src/game/systems/progression.js`.

---

## 5. Decisions

- D1: Padronizar o cálculo de diminishing returns com fórmula exponencial `rate^purchases` com piso mínimo configurável por tier (default 0.2).

---

## 6. Validation

- Deterministic command: `npm test`
- Target tests: `worker/test/evolution-sync.test.ts`, `web/src/game/systems/progression.test.js`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / Cloudflare Workers Miniflare
- Notes: Testes de sincronização de atributos de evolução e diminishing returns 100% aprovados.

### Results summary
- Successes: 20 testes (2 worker sync + 18 web progression)
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:evolutionCalculations.ts
- R2 [satisfied] check:test test:evolution-sync.test.ts
- R3 [satisfied] check:test test:evolution-sync.test.ts

---

## 7. Final Report

### Delivered scope
- Centralização de diminishing returns em `@micr-omega/shared`.
- Validação server-side de evolução em `worker/src/evolutionValidator.ts` e `worker/src/RoomDO.ts`.

### Files and modules changed
- `shared/src/evolutionCalculations.ts`
- `worker/src/evolutionValidator.ts`
- `worker/src/playerManager.ts`
- `worker/src/RoomDO.ts`
- `web/src/game/systems/progression.js`

### Validation executed
- Command: `npm test -w worker -- test/evolution-sync.test.ts`
- Result: 2/2 passed.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Implementar cache LRU para histórico de evoluções acima de 100 itens em salas de longa duração.
