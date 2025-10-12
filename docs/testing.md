# Estratégia de testes

Este documento consolida os fluxos de testes automatizados e de carga disponíveis no projeto.

## Web (`web/`)

### Testes unitários com Vitest

- Cobertura atual: reducers da store (`gameStore`) e componentes críticos (`RankingPanel`).
- Comando padrão:

```bash
npm run test --workspace web
```

- Execução em modo watch:

```bash
npm run test:watch --workspace web
```

Os testes utilizam `jsdom`, `@testing-library/react` e `@testing-library/jest-dom` para validar renderização, acessibilidade e derivações da store.

### Testes E2E com Playwright

- Configurados em `web/playwright.config.ts`, apontando para `process.env.PREVIEW_BASE_URL` (ex.: URL do deploy de preview da Vercel/Cloudflare Pages).
- Arquivos em `web/e2e/` cobrem o fluxo de entrada na sala, submissão do nome e atualização do ranking local.
- Execução:

```bash
PREVIEW_BASE_URL=https://preview.example.com npm run test:e2e --workspace web
```

O teste é automaticamente ignorado caso `PREVIEW_BASE_URL` não esteja definida, evitando falhas locais.

## Worker (`worker/`)

### Testes de integração com Miniflare

- `worker/test/room.test.ts` contém a suíte que sobe o Durable Object em memória via Miniflare e cria múltiplos clientes WebSocket.
- Casos cobertos:
  - Validação de entrada (`join`) e mensagens de erro.
  - Sincronização de estado/Ranking entre dois clientes distintos.
  - Atualização do ranking após ações de pontuação.
- Execução:

```bash
npm run test --workspace worker
```

## Testes de carga (`tests/load/`)

Scripts k6 para validar o comportamento com 50–100 conexões simultâneas. Veja instruções em [`tests/load/README.md`](../tests/load/README.md).

### Critérios de aprovação

- Handshake WebSocket ≥ 99% de sucesso.
- `connection_latency` p95 < 1s.
- Cada conexão recebe ao menos uma mensagem (`messages_received`).
