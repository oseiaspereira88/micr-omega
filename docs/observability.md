# Observabilidade

Este guia descreve como coletar logs estruturados do Worker, encaminhá-los para provedores externos e gerar relatórios com
métricas-chave do MicrΩ.

## Pipeline de logs com `wrangler tail`

1. Autentique o Wrangler com a conta Cloudflare que hospeda o Worker.
2. Exporte, se desejar, as credenciais do Logflare para envio automático (opcional):
   ```bash
   export LOGFLARE_API_TOKEN="seu_token"
   export LOGFLARE_SOURCE_ID="seu_source"
   ```
3. Inicie o pipeline local na raiz do repositório:
   ```bash
   npm run tail:worker
   ```
   O script `scripts/observability/tail-pipeline.mjs` executa `wrangler tail --format json`, persiste os registros em
   `logs/structured/<data>.ndjson` e, quando configurado, encaminha cada evento para o Logflare via API.

Os logs produzidos pelo Worker já são estruturados (JSON) e contêm chaves como `event`, `level`, `timestamp`,
`connectedPlayers` e `category`. Esses dados são adequados para ingestão em um data warehouse ou pipeline de streaming.

## Integração com Logflare / Sentry

### Worker

- Defina as variáveis `LOGFLARE_API_TOKEN` e `LOGFLARE_SOURCE_ID` no ambiente do Worker (via `wrangler secret put` ou painel).
- Cada chamada a `createObservability` registra eventos no console *e* envia o payload para o Logflare, mantendo o formato
  estruturado.
- Eventos de erro e de protocolo adicionam `category: "protocol_error"`, facilitando filtros.

### Front-end (React)

- Configure o DSN do Sentry em `web/.env` ou nas variáveis da Pages: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`,
  `VITE_SENTRY_TRACES_SAMPLE_RATE` (ex.: `0.1`).
- O bootstrap (`web/src/main.jsx`) inicializa o Sentry com tracing e replay opcionais e anexa a URL do Worker como *tag*.
- O hook de WebSocket utiliza `reportRealtimeLatency` para enviar distribuições de latência (`realtime.latency`) via
  `Sentry.metrics`. Esses dados podem ser visualizados em dashboards ou monitoramentos baseados em métricas.

## Relatórios e métricas

Após coletar os logs estruturados, gere um resumo com:

```bash
npm run report:metrics
```

O script `scripts/observability/generate-metrics-report.mjs` lê o arquivo mais recente em `logs/structured/` (ou um arquivo
informado via `--file`) e calcula:

- jogadores atualmente conectados e pico do período;
- distribuição de duração das sessões (média, mediana e p95);
- contagem e detalhamento de erros de protocolo (`category: protocol_error`).

Esses dados podem ser exportados para um dashboard interno ou utilizados para relatórios semanais. Combine com o Logflare
para visualizações em tempo real ou conecte o arquivo NDJSON a pipelines de BI.
