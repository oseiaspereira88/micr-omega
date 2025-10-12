# Testes de carga com k6

Este diretório contém um script de carga focado na sala pública em tempo real. Ele simula entre 50 e 100 conexões WebSocket simultâneas contra o Worker hospedado no ambiente de preview.

## Pré-requisitos

- [k6](https://k6.io/) instalado localmente.
- URL do endpoint WebSocket de preview (`wss://.../ws`).

## Execução padrão (50 conexões)

```bash
K6_WS_URL=wss://preview.example.com/ws k6 run tests/load/k6-public-room.js
```

## Execução estendida (100 conexões e sessões de 45s)

```bash
K6_WS_URL=wss://preview.example.com/ws \
K6_CONNECTIONS=100 \
K6_SESSION_MS=45000 \
k6 run tests/load/k6-public-room.js
```

### Parâmetros suportados

- `K6_WS_URL` (**obrigatório**): endpoint WebSocket do ambiente.
- `K6_CONNECTIONS` (opcional, padrão 50): número de usuários virtuais simultâneos.
- `K6_SESSION_MS` (opcional, padrão 30000): tempo que cada conexão permanece aberta após receber o evento `joined`.
- `K6_PROTOCOL_VERSION` (opcional): versão do protocolo enviada no `join`.

### Critérios de sucesso

- Métrica `handshake bem sucedido` ≥ 99%.
- Percentil 95 da métrica `connection_latency` abaixo de 1 segundo.
- Contador `messages_received` ≥ número de conexões configurado (cada usuário deve receber ao menos uma mensagem).

Os resultados são impressos no final da execução do k6 e podem ser exportados para Prometheus/InfluxDB conforme necessidade.
