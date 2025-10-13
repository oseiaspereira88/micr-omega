import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const ROOM_WS_URL = __ENV.WS_URL ?? "ws://localhost:8787";
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS ?? "60");
const VUS = Number(__ENV.VUS ?? "50");

export const options = {
  scenarios: {
    room_load: {
      executor: "constant-vus",
      vus: VUS,
      duration: `${HOLD_SECONDS}s`,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    room_join_time: ["p(95)<2500"],
    room_ranking_updates: ["rate>0.5"],
    room_join_failures: ["count==0"],
  },
};

const joinLatency = new Trend("room_join_time");
const rankingUpdates = new Rate("room_ranking_updates");
const joinFailures = new Counter("room_join_failures");

export default function roomScenario() {
  const playerName = `k6-${__VU}-${Date.now()}`;

  const response = ws.connect(ROOM_WS_URL, {}, (socket) => {
    const startedAt = Date.now();
    let playerId = "";

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "join", name: playerName }));
    });

    socket.on("message", (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        return;
      }

      if (payload.type === "joined") {
        playerId = payload.playerId;
        joinLatency.add(Date.now() - startedAt);
        socket.setInterval(() => {
          if (!playerId) {
            return;
          }
          const action = {
            type: "action",
            playerId,
            action: { type: "score", amount: 10, comboMultiplier: 2 },
          };
          socket.send(JSON.stringify(action));
        }, 2000);
      } else if (payload.type === "ranking") {
        rankingUpdates.add(1);
      } else if (payload.type === "error") {
        joinFailures.add(1);
        socket.close();
      }
    });

    socket.setTimeout(() => {
      if (!playerId) {
        joinFailures.add(1);
        socket.close();
      }
    }, 5000);

    socket.setTimeout(() => {
      socket.close();
    }, HOLD_SECONDS * 1000);

    socket.on("close", () => {
      sleep(1);
    });
  });

  check(response, {
    "resposta de upgrade": (res) => res && res.status === 101,
  });
}
