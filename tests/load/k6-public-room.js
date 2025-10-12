import ws from "k6/ws";
import { Trend, Counter } from "k6/metrics";
import { check, sleep } from "k6";

const WS_URL = __ENV.K6_WS_URL;
const TARGET_CONNECTIONS = Number(__ENV.K6_CONNECTIONS ?? 50);
const SESSION_MS = Number(__ENV.K6_SESSION_MS ?? 30_000);

if (!WS_URL) {
  throw new Error("Defina K6_WS_URL com o endpoint WebSocket do ambiente de preview.");
}

export const connectionLatency = new Trend("connection_latency", true);
export const messagesReceived = new Counter("messages_received");

export const options = {
  scenarios: {
    public_room: {
      executor: "constant-vus",
      vus: TARGET_CONNECTIONS,
      duration: "1m",
      gracefulStop: "10s"
    }
  },
  thresholds: {
    connection_latency: ["p(95)<1000"],
    messages_received: ["count>=" + TARGET_CONNECTIONS]
  }
};

export default function () {
  const joinName = `k6-${__VU}-${Date.now()}`;
  const start = Date.now();

  const result = ws.connect(WS_URL, {}, (socket) => {
    socket.on("open", () => {
      connectionLatency.add(Date.now() - start);
      socket.send(
        JSON.stringify({
          type: "join",
          name: joinName,
          version: __ENV.K6_PROTOCOL_VERSION ?? "1.0.0"
        })
      );
    });

    socket.on("message", (message) => {
      messagesReceived.add(1);
      try {
        const payload = JSON.parse(message);
        if (payload.type === "joined") {
          socket.setTimeout(() => {
            socket.close(1000, "load_test_complete");
          }, SESSION_MS);
        }
      } catch (err) {
        console.error("Falha ao interpretar mensagem", err);
      }
    });

    socket.on("close", () => {
      // pequena pausa para liberar recursos
      sleep(0.2);
    });
  });

  check(result, {
    "handshake bem sucedido": (res) => res && res.status === 101
  });
}
