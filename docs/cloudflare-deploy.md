# Guia de Deploy do MicrΩ no Cloudflare

Este documento descreve, passo a passo, como sair de uma conta Cloudflare vazia e publicar o MicrΩ em produção, cobrindo tanto o front-end (Pages) quanto o backend em tempo real (Worker com Durable Object). Ele assume que você está trabalhando com este repositório exatamente como está organizado (`web/` para o front, `worker/` para o realtime e `shared/` para contratos).

## Visão geral da arquitetura

- **Front-end**: Aplicação React+Vite no diretório `web/`, compilada com `npm run build` para gerar `web/dist/`. Publicamos como projeto Cloudflare Pages com variáveis `VITE_*` para apontar para o backend e habilitar monitoramento.
- **Backend realtime**: Worker em `worker/` que expõe um endpoint WebSocket (`/`) e encaminha as sessões para um Durable Object `RoomDO`. O `wrangler.toml` já declara o binding `ROOM` e o roteamento via domínio dedicado `realtime.example.com` (personalize para o seu domínio real). Durante a transição, a rota legada `/ws` continua aceita.
- **Observabilidade**: Logs estruturados via `createObservability`, suporte opcional a Logflare e métricas Sentry no front. Scripts auxiliares vivem em `scripts/observability/` e são acionados por `npm run tail:worker` e `npm run report:metrics`.

## 0. Pré-requisitos

1. Conta ativa no [Cloudflare](https://dash.cloudflare.com/) e um domínio cujo DNS possa ser delegado para a plataforma.
2. Node.js 20+, npm, Git e o Wrangler CLI 4.x instalados localmente (`npm install -g wrangler@^4`) para executar builds e comandos Wrangler.
3. Repositório clonado (`git clone ... && npm install` na raiz) para acessar scripts e configuração do projeto.
4. (Opcional) Tokens das ferramentas de observabilidade que deseja integrar (Logflare, Sentry, etc.).

## 1. Preparar a conta Cloudflare

1. Faça login em `dash.cloudflare.com` e confirme a conta (Account) que receberá o projeto.
2. Em **My Profile → API Tokens**, crie um token com permissões de:
   - `Workers KV Storage:Edit`
   - `Workers Scripts:Edit`
   - `Account Settings:Read`
   - `Pages:Edit`
   Esse token será utilizado pela CLI (Wrangler) e pela automação de CI/CD.
3. Habilite 2FA na conta e convide outros membros com papéis específicos, se necessário (Account Home → Members).

## 2. Adicionar e delegar o domínio

1. Em **Websites → Add a site**, informe o domínio (ex.: `micromega.dev`). Escolha o plano Free para começar.
2. Revise ou crie os registros DNS essenciais (A/AAAA, MX, TXT). Nenhum registro especial é necessário neste momento.
3. No registrador, troque os nameservers para os informados pelo Cloudflare e aguarde a propagação até o status *Active*.
4. Após a delegação, mantenha a nuvem laranja (proxied) nos registros que servirão o front-end (`www`, raiz) para aproveitar cache e TLS.

## 3. Configurar o Worker em tempo real

### 3.1 Autenticar e instalar dependências

1. Na máquina local, execute na raiz do repositório:
   ```bash
   npm install
   npm run dev:worker # opcional para validar localmente
   ```
2. Autentique o Wrangler na conta Cloudflare que receberá o Worker:
   ```bash
   npx wrangler login
   ```

### 3.2 Personalizar `worker/wrangler.toml`

1. Atualize o arquivo para refletir seu domínio real. Os valores que normalmente mudam:
   - `name`: identificador único do Worker (ex.: `micr-omega-worker-prod`).
   - Entrada `routes`: substitua `realtime.example.com` por `realtime.<seu-dominio>.com` ou outro subdomínio desejado.
2. Se quiser isolar ambientes (staging vs production), utilize múltiplas seções `[env.<nome>]` no `wrangler.toml`, cada uma com `routes` e variáveis próprias.

### 3.3 Criar o registro DNS para o domínio realtime

1. Em **DNS → Records**, crie um registro **CNAME** para `realtime` apontando para `workers.dev` (pode ser qualquer valor temporário; o Wrangler atualiza o binding ao publicar) com a nuvem laranja ativada.
2. Alternativamente, deixe o registro em branco: o `wrangler deploy` criará o roteamento automaticamente via *Custom Domains* quando a opção `custom_domain = true` está presente na rota.

### 3.4 Configurar variáveis e segredos do Worker

1. Para habilitar Logflare, execute (opcional):
   ```bash
   npx wrangler secret put LOGFLARE_API_TOKEN
   npx wrangler secret put LOGFLARE_SOURCE_ID
   ```
2. Acrescente outras variáveis em `[vars]` ou como `wrangler secret` conforme necessário (por exemplo, chaves de API para integrações futuras).

### 3.5 Ajustar parâmetros de runtime do RoomDO

O `RoomDO` expõe limites e intervalos configuráveis via variáveis de ambiente do Worker ou
bindings globais no Durable Object. O loader em `worker/src/config/runtime.ts` lê automaticamente
esses valores (aceita números como string ou número) e recalcula derivados como
`WAITING_START_DELAY_ENABLED`. Para ambientes Wrangler, defina-os em `[vars]` ou com
`wrangler secret/kv` caso deseje mantê-los privados.

| Variável | Descrição | Default |
| --- | --- | --- |
| `MIN_PLAYERS_TO_START` | Jogadores conectados necessários para iniciar uma rodada. | `1` |
| `WAITING_START_DELAY_MS` | Atraso entre atingir o mínimo e iniciar a partida. | `15000` |
| `ROUND_DURATION_MS` | Duração total da rodada antes do encerramento automático. | `120000` |
| `RESET_DELAY_MS` | Tempo entre o fim da rodada e o reset completo. | `10000` |
| `RECONNECT_WINDOW_MS` | Janela para o jogador reconectar mantendo progresso. | `30000` |
| `INACTIVE_TIMEOUT_MS` | Tempo máximo de inatividade antes de desconectar o socket. | `45000` |
| `MAX_PLAYERS` | Capacidade simultânea do RoomDO. | `100` |
| `MAX_CLIENT_MESSAGE_SIZE_BYTES` | Tamanho máximo de payload aceito por mensagem. | `16384` |
| `RATE_LIMIT_WINDOW_MS` | Janela dos limites de mensagens por conexão. | `60000` |
| `MAX_MESSAGES_PER_CONNECTION` | Máximo de mensagens por conexão dentro da janela. | `4200` |
| `MAX_MESSAGES_GLOBAL` | Limite global agregado de mensagens para o DO. | `12000` |
| `GLOBAL_RATE_LIMIT_HEADROOM` | Fator de folga aplicado ao limite global efetivo. | `1.25` |
| `WORLD_TICK_INTERVAL_MS` | Intervalo de processamento do mundo. | `50` |
| `SNAPSHOT_FLUSH_INTERVAL_MS` | Frequência de persistência do snapshot compartilhado. | `500` |
| `PLAYER_ATTACK_COOLDOWN_MS` | Cooldown base dos ataques de jogador. | `800` |
| `PLAYER_COLLECT_RADIUS` | Raio de coleta de recursos. | `60` |
| `CONTACT_BUFFER` | Folga aplicada a colisões e alcance de ataque. | `4` |
| `MICRO_LOW_HEALTH_THRESHOLD` | Percentual de vida para acionar fuga de micróbios. | `0.3` |
| `CLIENT_TIME_MAX_FUTURE_DRIFT_MS` | Tolerância do relógio do cliente antes de rejeitar ações. | `2000` |

Outros parâmetros detalhados (ex.: evolução, respawn, movimentação de NPCs) também podem ser
definidos; consulte o objeto `DEFAULT_RUNTIME_CONFIG` para a lista completa. Ajuste-os com cautela
e mantenha valores coerentes para evitar inconsistências na simulação.

### 3.6 Deploy inicial do Worker

1. Execute o deploy (gera automaticamente a migração `RoomDO` declarada em `wrangler.toml`):
   ```bash
   npm run deploy -w worker
   ```
   - O comando usa `wrangler deploy`, compila `worker/src/index.ts` e registra o Durable Object `RoomDO` com o tag `v1` definido no arquivo de configuração.
2. Após o deploy, verifique em **Workers & Pages → micr-omega-worker → Durable Objects** que a classe `RoomDO` está ativa.
3. Valide o WebSocket executando `wscat -c wss://realtime.<seu-dominio>.com` (a rota antiga `/ws` permanece funcional) ou outro cliente para garantir que a conexão 101 está sendo retornada.

## 4. Configurar o front-end no Cloudflare Pages

### 4.1 Criar o projeto Pages a partir do Git

1. No dashboard, vá para **Workers & Pages → Create application → Pages** e escolha **Connect to Git**.
2. Autorize o provedor (GitHub/GitLab) e selecione o repositório deste projeto.
3. Configure:
   - **Production branch**: `main`.
   - **Root directory**: `web` (importante para que o Pages execute os scripts corretos do workspace).
   - **Build command**: `npm ci && npm run build` (usa o script `web/package.json` para gerar `dist`).
   - **Build output directory**: `dist`.
4. Salve e aguarde a conclusão do primeiro build; isso criará uma URL `https://<project>.pages.dev`.

### 4.2 Variáveis de ambiente do front-end

1. Em **Pages → Settings → Environment Variables**, configure ao menos:
   - `VITE_REALTIME_URL = wss://realtime.<seu-dominio>.com` (ou use `VITE_WS_URL` se preferir). Mantenha `/ws` apenas para clientes legados.
   - `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE` conforme suas credenciais Sentry.
2. Para ambientes de preview, você pode definir variáveis específicas (por exemplo, apontando para um Worker de staging usando `wrangler environments`).
3. Caso use Playwright ou outros testes de preview, adicione também `PLAYWRIGHT_BASE_URL` e `PLAYWRIGHT_WS_URL` nas configurações de *Preview* para pipelines automatizados.

### 4.3 Conectar o domínio final

1. Em **Pages → Deployments → Custom Domains**, adicione `www.<seu-dominio>.com` e/ou a raiz.
2. Cloudflare criará os registros DNS automaticamente; garanta que a nuvem esteja laranja para servir conteúdo pela borda.
3. Ative **Always Use HTTPS** e **Automatic HTTPS Rewrites** em *SSL/TLS → Edge Certificates* para redirecionamentos e evitar conteúdo misto.

## 5. Pipeline de CI/CD recomendado

1. Utilize o workflow descrito em `docs/multiplayer-plan.md` como base para automatizar deploys do Worker e do Pages via GitHub Actions (ou plataforma equivalente). Ele executa `npm ci`, testes e usa `cloudflare/wrangler-action@v3` para publicar ambos artefatos com os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
2. Configure o token com permissões restritas mencionadas na seção 1 e armazene os segredos no provedor de CI.
3. Opcionalmente, mantenha o fluxo manual (`npm run deploy -w worker` e `wrangler pages deploy`) até que a automação esteja validada em staging.

## 6. Observabilidade e operações pós-deploy

1. Para logs estruturados em tempo real, rode:
   ```bash
   npm run tail:worker
   ```
   O script `scripts/observability/tail-pipeline.mjs` consome `wrangler tail --format json`, salva em `logs/structured/` e envia para o Logflare se os segredos estiverem definidos.
2. Gere relatórios com as principais métricas (jogadores, duração de sessão, erros) usando:
   ```bash
   npm run report:metrics
   ```
   Ele lê o último arquivo NDJSON e calcula agregados úteis para acompanhamento.
3. No dashboard Cloudflare, monitore **Workers → Metrics** para consumo de CPU, subrequests e erros do Durable Object, além de **Pages → Analytics** para tráfego estático.
4. Estabeleça um checklist de release conforme `docs/release-workflow.md` (QA, monitoramento, rollback) para cada deploy em produção.

## 7. Testes e validações finais

1. Antes de promover um deploy, execute localmente:
   ```bash
   npm run test --workspaces --if-present
   npm run build:all
   ```
   Isso garante que front e Worker compilarão em ambiente de CI.
2. Após o deploy:
   - Valide o carregamento do front em `https://www.<seu-dominio>.com` e a conexão WebSocket (inspecione o console do navegador).
   - Use `wrangler tail` ou `npm run tail:worker` para verificar que os eventos `room_initialized` e `ws_upgrade_forwarded` estão sendo emitidos.
   - Execute o teste de carga em `docs/load-testing.md` (k6) se estiver preparando um aumento de tráfego.

Seguindo estes passos você terá o MicrΩ publicado na infraestrutura Cloudflare com deploys reprodutíveis, monitoramento ativo e rota segura para o backend em tempo real.
