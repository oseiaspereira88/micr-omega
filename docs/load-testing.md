# Testes de carga para o Room Durable Object

Este diretório contém o roteiro de carga `scripts/load-testing/k6-room.js`, preparado para validar o comportamento do Durable Object com 50 a 100 conexões WebSocket simultâneas.

## Pré-requisitos

* [k6](https://k6.io/) instalado localmente (`brew install k6`, `choco install k6` ou download manual).
* Um endpoint WebSocket acessível do computador local. Para ambientes de preview (Cloudflare Workers), utilize a URL `wss://<seu-preview>/`. Em desenvolvimento local com o Worker rodando via `wrangler dev`, use `ws://127.0.0.1:8787`.

## Execução sugerida

```bash
# Executa por 60 segundos com 50 usuários virtuais (padrão)
k6 run scripts/load-testing/k6-room.js \
  --env WS_URL="wss://preview.example.com/"

# Escala para 100 conexões durante 90 segundos
k6 run scripts/load-testing/k6-room.js \
  --env WS_URL="wss://preview.example.com/" \
  --env VUS=100 \
  --env HOLD_SECONDS=90
```

Variáveis suportadas:

| Variável | Descrição | Valor padrão |
| --- | --- | --- |
| `WS_URL` | Endpoint WebSocket do Room DO. | `ws://localhost:8787` |
| `VUS` | Quantidade de conexões simultâneas (50-100 recomendadas). | `50` |
| `HOLD_SECONDS` | Duração do teste (segundos). | `60` |

## Fluxo exercitado

Cada usuário virtual:

1. Abre uma conexão WebSocket com o Room DO.
2. Envia uma mensagem `join` com um nome único.
3. Aguarda a resposta `joined` e registra a latência.
4. A cada 2 segundos, envia uma ação de pontuação (`type: "score"`) para estimular atualizações de ranking.
5. Observa mensagens `ranking` e contabiliza recebimentos.
6. Fecha a sessão ao final da duração configurada.

## Critérios de sucesso

O teste é considerado bem-sucedido quando:

* 95% das conexões completam o fluxo de entrada (`join`) em menos de 2,5 segundos (`room_join_time`).
* O Worker continua emitindo atualizações de ranking — a métrica `room_ranking_updates` deve manter taxa acima de 0,5 (pelo menos uma atualização a cada dois segundos por VU).
* O número de falhas de entrada (`room_join_failures`) permanece em zero. Valores acima de 1 indicam saturação ou problemas de validação de nomes.

Registre os resultados (saída do k6) junto ao relatório de execução para comparações futuras.
