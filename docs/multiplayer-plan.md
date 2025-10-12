# Plano de Adequação para Multiplayer Online e Deploy no Cloudflare

## 1. Visão Geral
- **Objetivo**: Evoluir o game existente para suportar multiplayer online em uma única sala pública e fornecer ranking em tempo real durante a partida.
- **Pilares**:
  1. Adequações de gameplay e UX para entrada de jogador e ranking.
  2. Arquitetura cliente-servidor usando Cloudflare Workers + Durable Objects.
  3. Fluxo de deploy contínuo (CI/CD) integrado ao Cloudflare Pages e Workers.
  4. Monitoramento, segurança e plano de testes.

## 2. Evoluções de Gameplay e UX
### 2.1 Fluxo de Entrada do Jogador
- Exibir modal inicial solicitando **nome do jogador** (mínimo 3 e máximo 16 caracteres, apenas letras/números).
- Persistir o nome em `localStorage` para reutilização em visitas futuras.
- Validar duplicidade no servidor: DO rejeita nomes em uso e envia mensagem de erro; cliente exibe feedback e solicita novo nome.

### 2.2 Modelo de Estado Compartilhado
- Definir formato de mensagem JSON com campos: `type`, `payload`, `playerId`, `timestamp`, `version`.
- Fluxos principais:
  - `join`: cliente envia nome; servidor confirma com `joined` contendo lista de jogadores e estado atual.
  - `state`: broadcast periódico (diferenças ou estado completo) para manter sincronização.
  - `action`: ações de jogo (movimento, escolha, etc.) validadas no servidor antes de broadcast.
  - `ranking`: mensagem dedicada com array ordenado de jogadores (nome, score, status).
  - `ping/pong`: latência e detecção de desconexão.

### 2.3 Ranking em Tempo Real
- Ranking exibido em painel lateral ou overlay durante a partida.
- Atualização ocorre via mensagem `ranking` do servidor; cliente aplica com atualização otimista opcional.
- Definir critérios de pontuação (ex.: pontos por objetivo, tempo sobrevivido, etc.).
- Implementar indicadores: top 3 destacados, jogador local realçado, ícone de desconectado.

### 2.4 Tratamento de Estados de Sala
- Estados possíveis: `waiting` (aguardando jogadores), `active`, `ended`.
- Regras para iniciar partida (ex.: mínimo de 2 jogadores ou timer).
- Comandos de administração: servidor pode reiniciar partida ao término; enviar mensagem `reset` para clientes.
- Reingresso após desconexão: DO preserva `playerId` por tempo configurável (ex.: 2 minutos) para reconexão.

### 2.5 Compatibilidade de Versão
- Incluir campo `version` nas mensagens; o servidor rejeita clientes desatualizados enviando `upgrade_required` com link de atualização.

## 3. Arquitetura Técnica
### 3.1 Componentes
- **Front-end (React/Vite)**: hospedado no Cloudflare Pages, responsável por renderização, captura de input e exibição do ranking.
- **Back-end tempo real**: Cloudflare Worker com Durable Object `RoomDO` gerenciando a única sala (`public-room`).
- **Persistência leve**: `RoomDO` usa `state.storage` para snapshots opcionais (ex.: ranking final, histórico). Persistência não crítica.

### 3.2 Fluxo de Comunicação
1. Cliente requisita nome → envia `join` ao endpoint WebSocket `/` do Worker (rota antiga `/ws` permanece aceita durante a transição).
2. Worker encaminha conexão ao `RoomDO` (ID fixo `public-room`).
3. `RoomDO` valida nome, cria registro e transmite estado inicial.
4. Eventos de jogo são processados no `RoomDO`, que atualiza o estado e publica ranking atualizado.
5. Desconexão: `RoomDO` remove jogador após timeout; broadcast `player_left`.

### 3.3 Estrutura de Código
```
/
├─ web/
│  ├─ src/
│  │  ├─ hooks/useGameSocket.ts
│  │  ├─ store/gameStore.ts
│  │  ├─ components/PlayerNameModal.tsx
│  │  ├─ components/RankingPanel.tsx
│  │  └─ utils/messageTypes.ts
│  ├─ package.json
│  └─ tsconfig.json
├─ worker/
│  ├─ src/index.ts
│  ├─ src/RoomDO.ts
│  ├─ src/types.ts
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ wrangler.toml
├─ package.json
├─ tsconfig.json
└─ docs/
   └─ multiplayer-plan.md
```

> **Comandos base**: `npm run dev:web` sobe o Vite no workspace `web/`, enquanto `npm run dev:worker` usa o Wrangler localmente. Para builds, `npm run build -w web` gera o front-end e `npm run deploy -w worker` publica o Worker.

### 3.4 Mensagens WebSocket (exemplo)
```ts
// Cliente → Servidor
{
  type: "join",
  payload: { name: "Alice" },
  version: 1
}
{
  type: "action",
  payload: { actionType: "move", direction: "left" },
  playerId: "uuid",
  version: 1
}

// Servidor → Clientes
{
  type: "joined",
  payload: {
    playerId: "uuid",
    players: [{ id: "uuid", name: "Alice", score: 0 }],
    state: { ... }
  }
}
{
  type: "ranking",
  payload: [
    { id: "uuid", name: "Alice", score: 10 },
    { id: "uuid2", name: "Bob", score: 5 }
  ]
}
```

## 4. Planejamento de Desenvolvimento
### 4.1 Backlog de Tarefas (Fases)
1. **Fundação Backend**
   - [ ] Criar projeto `worker` com Wrangler e DO `RoomDO`.
   - [ ] Implementar handshake WebSocket e fluxo `join`/`joined` com validação de nome.
   - [ ] Implementar armazenamento e broadcast de ranking.
   - [ ] Adicionar testes unitários (ex.: simulação de eventos com Miniflare).

2. **Integração Front-end**
   - [ ] Implementar modal de nome com persistência local.
   - [ ] Criar hook `useGameSocket` e conectar ao Worker.
   - [ ] Atualizar store do jogo para estado compartilhado.
   - [ ] Implementar `RankingPanel` responsivo.

3. **Sincronização e Regras de Jogo**
   - [ ] Migrar lógica de autoridade para o DO (validação de ações, cálculo de pontuação).
   - [ ] Definir mensagens de estado incremental (diff ou eventos).
   - [ ] Lidar com reconexão e expulsão por inatividade.

4. **UX e Feedback**
   - [ ] Exibir indicadores de status da conexão (latência, reconexão).
   - [ ] Mostrar mensagens de erro (nome duplicado, servidor cheio).
   - [ ] Ajustar HUD para ranking sempre visível sem poluir gameplay.

5. **Hardening**
   - [ ] Rate limiting por conexão no DO (máx. ações/minuto).
   - [ ] Validação de schema com Zod (front e back) compartilhando tipos via pacote comum.
   - [ ] Logs estruturados (`console.log(JSON.stringify(...))`) para monitorar no Cloudflare.

### 4.2 Cronograma Indicativo
- Semana 1: Configurar repositório modular, criar Worker/DO e fluxo de entrada básico.
- Semana 2: Integração front-end com ranking em tempo real; testes locais.
- Semana 3: Ajustes de gameplay e UX, cobertura de testes, monitoramento e métricas.
- Semana 4: Ensaios de deploy, revisão de segurança, preparação para beta.

## 5. Estratégia de Deploy e Infraestrutura Cloudflare
### 5.1 Cloudflare Pages (Front-end)
- Configuração inicial via **Git Integration** apontando para branch `main` (build: `npm ci && npm run build`, output: `dist`).
- Para ambientes de preview, utilizar branches feature → Cloudflare gera preview URL automaticamente.
- Se precisar de build custom (monorepo), usar `wrangler pages deploy` com artefatos gerados na CI.

### 5.2 Cloudflare Workers + Durable Objects
- `wrangler.toml` com binding `ROOM` apontando para classe `RoomDO`.
- Definir `compatibility_date` atual e `compatibility_flags = ["nodejs_compat"]` se necessário.
- Configurar roteamento via subdomínio (ex.: `realtime.<domínio>.com`).
- Habilitar logs em `wrangler tail` para debug.
- Planejar limites: monitorar consumo de CPU/memória do DO, ajustar `durable_objects.storage` para snapshots.

### 5.3 Integração Front ↔ Back
- Variáveis de ambiente no front (`VITE_REALTIME_URL`) definidas via Settings do Pages.
- Em produção usar WSS; em desenvolvimento local usar `wrangler dev` com `--local` e `vite dev`.

### 5.4 Monitoramento e Observabilidade
- Usar **Cloudflare Logs** (Workers) e `console.log` estruturado.
- Integrar com Sentry/Logflare (opcional) via fetch no Worker ou front.
- Métricas importantes: jogadores conectados, tempo médio de sessão, erros de protocolo.

## 6. Fluxo de CI/CD
### 6.1 Workflow GitHub Actions (`.github/workflows/deploy.yml`)
```yaml
name: Deploy Front + Worker

on:
  push:
    branches: ["main"]
  workflow_dispatch:

jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: worker
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint --if-present
      - name: Publish Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: publish

  deploy-pages:
    needs: deploy-worker
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test --if-present -- --watch=false
      - run: npm run build
      - name: Publish Pages Artifact
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name="nome-do-projeto"
```

### 6.2 Segredos Necessários
- `CLOUDFLARE_API_TOKEN`: token com permissões para Pages e Workers.
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta.
- (Opcional) `CLOUDFLARE_PROJECT_NAME` se quiser parametrizar.

### 6.3 Pipelines de Pré-visualização
- Workflow adicional disparado por `pull_request` executando testes (`npm run lint`, `npm run test`) e `wrangler publish --dry-run`.
- Utilizar Cloudflare Pages Preview para validar front-end.

## 7. Estratégia de Testes
- **Testes unitários**: lógica de ranking e reducers (Jest/Vitest) e funções do DO (Miniflare).
- **Testes de integração**: simular múltiplos clientes conectados usando Miniflare + WS mocks.
- **Testes end-to-end**: Playwright apontando para preview (verifica fluxo de entrada, ranking dinâmico).
- **Testes de carga**: script k6 ou Artillery para 50-100 conexões verificando estabilidade.

## 8. Considerações de Segurança e Performance
- Sanitização de inputs (limite de tamanho, caracteres).
- Rate limiting por conexão e global (ex.: máx. 20 mensagens/5s).
- Aplicar `Subrequests` contados: preferir lógica em memória no DO.
- Usar `Durable Object Alarms` para realizar reset de ranking diário ou persistência periódica.
- Configurar HTTPS obrigatório no Pages/Worker.
- Monitorar latência com `ping` e aplicar suavização (ex.: interpolação no front).

## 9. Próximos Passos
1. Criar branches dedicadas (`feature/realtime-backend`, `feature/ranking-ui`).
2. Implementar MVP do DO e conectar via WebSocket local (Vite + Wrangler).
3. Configurar conta Cloudflare, criar projeto Pages e Worker, testar deploy manual.
4. Ajustar pipeline de CI/CD e validar com deploy em ambiente de staging.
5. Coletar feedback interno/QA, ajustar gameplay e ranking.
6. Preparar comunicação de lançamento e monitoramento pós-go-live.

---

Este planejamento cobre as adaptações necessárias para multiplayer de sala única, ranking em tempo real e o ecossistema de deploy contínuo usando Cloudflare Pages, Workers e Durable Objects.
