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

1. Instale as dependências na raiz do repositório:
   ```bash
   npm install
   ```
2. Inicie o front-end (Vite) apontando para o workspace `web`:
   ```bash
   npm run dev:web
   ```
3. Em outra aba/terminal, suba o Worker localmente com Wrangler (requer `wrangler` autenticado):
   ```bash
   npm run dev:worker
   ```

Scripts úteis adicionais:

- `npm run build`: executa os builds de todos os workspaces.
- `npm run test`: roda os testes definidos em cada workspace (por exemplo, Playwright no front-end).
- `npm run lint`: encadeia linters configurados em cada workspace.

## Fluxo de publicação

- **Front-end (`web/`)**: execute `npm run build -w web` para gerar `web/dist/` e publique via Cloudflare Pages ou pipeline CI/CD. O README do projeto espera que a CI utilize `npm ci` na raiz seguido de `npm run build -w web`.
- **Worker (`worker/`)**: utilize `npm run deploy -w worker` (alias para `wrangler deploy`) com as credenciais da sua conta Cloudflare. O `wrangler.toml` deve residir dentro da pasta `worker/`.

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
