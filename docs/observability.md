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

### Monitoramento de rate limit

- O `RoomDO` agora permite até **4.200 mensagens por conexão** em uma janela deslizante de 60 segundos (≈70 msg/s),
  o bastante para joystick analógico contínuo sem acionar `rate_limited`.
- Cada vez que uma conexão ou o limite global ultrapassa 70% de utilização, o Worker publica a métrica `rate_limit_utilization`
  com `scope` (`connection` ou `global`), `limit` efetivo e `bucket` (percentual arredondado).
- Dashboards devem acompanhar tanto `rate_limit_utilization` quanto `rate_limit_hits` para verificar se os falsos positivos
  cessaram e se não houve aumento de abuso. Uma sequência crescente de buckets próximos de 100 para um mesmo jogador indica que
  ele está saturando o orçamento; investigue o caso antes de ajustar os limites novamente.
