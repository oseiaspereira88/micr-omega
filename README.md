# MicrΩ

MicrΩ é um jogo de exploração microscópica renderizado em um único canvas com React. Você controla um organismo bioluminescente em evolução contínua, enfrentando ondas de inimigos, coletando matéria orgânica e ativando habilidades especiais enquanto o cenário reage dinamicamente à sua jornada.

## Destaques

- Mundo aquático profundo com múltiplas camadas de partículas, nebulosas dinâmicas, minimapa e trilhas de movimento orgânicas.
- Sistema de evolução com escolhas entre novas formas e traços que liberam habilidades ativas exclusivas.
- Combate com combos, inimigos variados e encontros com mega-organismos (chefes) acompanhados de HUD dedicado.
- Power-ups temporários, notificações in-game e painel de habilidades que mostram custo, recarga e estado atual.
- Suporte simultâneo a teclado, mouse e controles touch (joystick virtual e botões no overlay).

## Estrutura do monorepo

```
/
├─ web/           # Front-end React + Vite
│  ├─ src/
│  ├─ index.html
│  ├─ package.json
│  └─ tsconfig.json
├─ worker/        # Cloudflare Worker (Durable Objects em preparação)
│  ├─ src/
│  ├─ package.json
│  └─ tsconfig.json
├─ docs/
├─ package.json   # Dependências compartilhadas e scripts de orquestração
├─ tsconfig.json  # Referências de projeto (web + worker)
└─ tsconfig.base.json
```

O arquivo `package.json` na raiz declara os workspaces `web/` e `worker/` e concentra dependências compartilhadas, como validações com Zod e o TypeScript usado para ambos módulos.

## Configuração e desenvolvimento local

1. Certifique-se de ter o [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) na versão 4.x (recomendamos `^4.42.0`). Se preferir instalar globalmente, execute:
   ```bash
   npm install -g wrangler@^4
   ```
2. Instale as dependências na raiz do repositório:
   ```bash
   npm install
   ```
3. Crie um arquivo `web/.env.local` apontando para o Worker local (Wrangler expõe o WebSocket na raiz `http://127.0.0.1:8787`):
   ```bash
   echo "VITE_REALTIME_URL=ws://127.0.0.1:8787" > web/.env.local
   ```
4. Em uma aba/terminal, suba o Worker localmente com Wrangler (requer `wrangler` 4.x autenticado). O comando habilita WebSocket sobre HTTPS em produção, mas no modo dev responde via `ws://`:
   ```bash
   npm run dev:worker
   ```
5. Em outra aba/terminal, inicie o front-end (Vite) apontando para o workspace `web`. O Vite recarrega automaticamente e usa a URL em `VITE_REALTIME_URL` para conectar ao Worker:
   ```bash
   npm run dev:web
   ```

Scripts úteis adicionais:

- `npm run build`: build apenas do front-end (para Cloudflare Pages).
- `npm run build:all`: executa os builds de todos os workspaces.
- `npm run test`: roda os testes definidos em cada workspace (Vitest no front-end e suíte Miniflare no worker).
- `npm run test:e2e -w web`: executa a suíte de ponta a ponta com Playwright (requer variáveis `PLAYWRIGHT_BASE_URL` e `PLAYWRIGHT_WS_URL`).
- `npm run test -w worker`: roda somente os testes de integração do Durable Object com Miniflare.
- `npm run test -w web`: executa apenas os testes unitários de componentes e store com Vitest.
- `npm run lint`: encadeia linters configurados em cada workspace.
- `npm run tail:worker`: inicia o pipeline de tail estruturado (`wrangler tail` + arquivo NDJSON/Logflare).
- `npm run report:metrics`: consolida métricas de sessões e erros a partir do último arquivo de log estruturado.

Consulte `docs/load-testing.md` para instruções de execução do teste de carga com k6 (50–100 conexões simultâneas).

## Critério de ordenação do ranking

O Worker e o cliente web compartilham a configuração de ordenação definida em `@micr-omega/shared` por meio das constantes
`RANKING_SORT_LOCALE` e `RANKING_SORT_OPTIONS`. Atualmente adotamos a locale `pt-BR` com `sensitivity: "base"`, o que garante
que nomes com e sem acentuação sejam considerados equivalentes e que empates sejam desempatados pelo `playerId`. Ajuste essas
constantes caso seja necessário mudar o critério — ambos os lados consumirão automaticamente a nova configuração.

## Fluxo de publicação

- **Front-end (`web/`)**: execute `npm run build` (ou `npm run build:web`) para gerar `web/dist/` e publique via Cloudflare Pages ou pipeline CI/CD. O README do projeto espera que a CI utilize `npm ci` na raiz seguido de `npm run build`.
- **Worker (`worker/`)**: utilize `npm run deploy -w worker` (alias para `wrangler deploy`) com as credenciais da sua conta Cloudflare. O `wrangler.toml` deve residir dentro da pasta `worker/`.

### Cloudflare Pages + Worker Realtime

- O Worker está configurado para responder no caminho `/`, com roteamento HTTPS/WSS via domínio dedicado `realtime.<seu-dominio>.com` (a rota legada `/ws` continua aceita para clientes antigos).
- O projeto Cloudflare Pages utiliza o diretório `web/`, com build `npm ci && npm run build` (script do workspace `web`). A configuração em `web/wrangler.toml` define `VITE_REALTIME_URL` como `wss://realtime.example.com`; ajuste o host conforme o domínio real no painel de variáveis da Pages se preferir.
- Para ambientes locais, `VITE_REALTIME_URL` deve apontar para `ws://127.0.0.1:8787`, permitindo que o `vite dev` se conecte ao `wrangler dev` simultaneamente.

## Controles

### Desktop

- **Mover**: `WASD` ou setas direcionais.
- **Atacar**: `Barra de espaço`.
- **Dash**: `Shift` (consome carga de dash).
- **Usar habilidade ativa**: `Q` (ou botão de habilidade).
- **Alternar habilidade equipada**: `R` ou `Tab` (quando mais de uma estiver disponível).
- **Abrir evolução (quando disponível)**: `E`.

### Mobile / Touch

- Joystick virtual no canto inferior esquerdo para movimentação.
- Botão `⚔️` para ataque, `💨` para dash, `🧬` para abrir o menu de evolução.
- Botão circular adicional para ativar habilidades, com indicação visual de recarga e custo.
