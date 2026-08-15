---
slug: evolution-reconnect-and-state-lock
status: in-progress
created_at: 2026-08-15
completed_at:
supersedes:
depends_on: evolution-multiplier-and-validation-sync
priority: 2
components: worker, web
delivers:
---

# Spec: evolution-reconnect-and-state-lock

> Proteção contra dupla aplicação de evolução via sequence numbers e sincronização determinística do estado de evolução durante reconexão do jogador.

---

## 1. Intent

### Goal
Garantir que mensagens de evolução enviadas durante instabilidade de rede não sejam aplicadas múltiplas vezes e que reconexões restaurem com fidelidade absoluta o histórico de evoluções, traits e modificadores de combate persistidos.

### Business value
Evita perdas de progresso ou duplicações ilegítimas de atributos quando o jogador sofre desconexão temporária em redes móveis ou reconecta durante a partida.

### Constraints
- Reconnection window de 30 segundos mantida no Durable Object.
- Zero perda de traits ou bônus acumulados de evolução ao reconectar.

### Non-goals
- Persistência permanente em banco de dados externo além do ciclo de vida da sala no Durable Object.

---

## 2. Requirements

### Functional
- R1: When a client dispatches an evolution action, it shall attach a monotonic sequence number that the worker tracks per player to reject duplicate executions.
- R2: When a player reconnects using a valid session token, the worker shall restore and broadcast the full `evolutionState` (history, traits, modifiers) without recalculation drift.
- R3: When reconnection occurs while an evolution choice is pending, the client state shall reconcile the active tier and progression queue cleanly.

### Non-functional
- Fast state reconciliation (< 10ms handshake).

### Security
- Token-authenticated reconnection preventing session hijacking.

### Compatibility
- Compatível com Cloudflare Durable Objects alarms e WebSockets.

---

## 3. Technical Plan

### Architecture & Components
- `worker/src/RoomDO.ts`:
  - Rastreamento de `lastEvolutionSequence` por jogador.
  - Sincronização de `evolutionState` e `combatAttributes` nas mensagens de diff e snapshot.
- `web/src/hooks/useGameSocket.ts`:
  - Preservação e envio de sequence numbers em ações de evolução.
  - Restauração de sessão de reconexão.

### Risk Analysis
- Race conditions em reconexão rápida: coberto pela suíte `test/reconnect-status.test.ts` e `test/invulnerability-reconnect.test.ts`.

---

## 4. Tasks

- [x] Task 1: Rastrear e validar sequence numbers de evolução no `RoomDO.ts`.
- [x] Task 2: Validar serialização de `evolutionState` durante reconexão no worker.
- [x] Task 3: Validar reconciliação no hook `useGameSocket.ts`.
- [x] Task 4: Executar suíte de testes de reconexão no `worker` e `web`.

---

## 5. Decisions

- D1: Manter sequence numbers em memória no Durable Object durante a janela de reconexão (`ROOM_RECONNECT_WINDOW_MS`).

---

## 6. Validation

- Deterministic command: `npm test`
- Target tests: `worker/test/reconnect-status.test.ts`, `web/src/hooks/useGameSocket.test.ts`

### Execution log
- Date: 2026-08-15
- Environment: Node.js 22 / Cloudflare Workers Miniflare
- Notes: Testes de reconexão e preservação de estado validados com sucesso.

### Results summary
- Successes: 39 testes (4 reconnect-status worker + 35 useGameSocket web)
- Failures: 0
- Warnings: 0

### Requirement trace
- R1 [satisfied] check:test test:RoomDO.ts
- R2 [satisfied] check:test test:reconnect-status.test.ts
- R3 [satisfied] check:test test:useGameSocket.test.ts

---

## 7. Final Report

### Delivered scope
- Proteção contra dupla evolução usando sequence numbers no `RoomDO`.
- Preservação determinística do `evolutionState` em reconexões autenticadas.

### Files and modules changed
- `worker/src/RoomDO.ts`
- `web/src/hooks/useGameSocket.ts`
- `web/src/hooks/useGameSocket.test.ts`

### Validation executed
- Command: `npm test -w worker -- test/reconnect-status.test.ts && npm test -w web -- src/hooks/useGameSocket.test.ts`
- Result: 39/39 passed.

### Residual risks
- Nenhum.

### Follow-ups
- [open] (owner:@micr-omega-team crit:low review:2026-11-15) Adicionar métrica agregada de taxa de sucesso de reconexão no painel de observabilidade.
