# Rule: Backend Cloudflare Workers & Durable Objects

## When to consult

Consult this guide for Cloudflare Workers handlers, Durable Objects (`RoomDO`), WebSocket connections, session lifecycles, storage, alarms, and shared TypeScript schemas.

## Required patterns

- Keep Durable Objects state synchronized and validate all incoming WebSocket messages against shared Zod schemas in `shared/`.
- Handle player disconnections, reconnect windows, and timeouts deterministically using Durable Object alarms.
- Apply rate limiting per-connection and globally to protect worker execution and memory budgets.
- Use structured JSON logging with standard fields (`level`, `event`, `timestamp`, `component`, `service`).
- Keep game state transitions pure and testable with Vitest and Miniflare.
- Explicitly handle WebSocket error codes and close reasons.

## Blocking anti-patterns

- Storing unbounded arrays or memory leaks inside Durable Object memory across long-lived rooms.
- Allowing client messages to mutate game state without server-side validation.
- Unhandled Promise rejections or unhandled exceptions in WebSocket message handlers that crash the Durable Object.
- Hardcoding environment-specific URLs or secrets in worker code instead of reading bindings/vars.
- Blocking the event loop with heavy synchronous computations during tick processing.

## Minimum checks

- Run `npm test -w worker` (Miniflare unit/integration tests).
- Run `npm run build:all` (or `npm run build -w worker`) to verify TypeScript compilation and bundling.
- Validate structured logging and metric schemas with `npm run report:metrics` or test suite.

## Recurrence traceability

> Also apply: [.pose/rules/_base-recurrence.md](_base-recurrence.md)
