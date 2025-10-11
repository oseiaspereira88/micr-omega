import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { build } from "esbuild";

type MessagePayload = { type: string; [key: string]: unknown };

describe("RoomDO", () => {
  async function createMiniflare(): Promise<Miniflare> {
    const bundle = await build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      write: false,
      sourcemap: "inline"
    });

    const script = bundle.outputFiles[0]?.text ?? "";

    return new Miniflare({
      modules: true,
      script,
      compatibilityDate: "2024-10-01",
      durableObjects: {
        ROOM: { className: "RoomDO" }
      }
    });
  }

  async function openSocket(mf: Miniflare) {
    const response = await mf.dispatchFetch("http://localhost/ws", {
      headers: { Upgrade: "websocket" }
    });
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).toBeDefined();
    socket!.accept();
    return socket!;
  }

  function onceMessage<T extends MessagePayload>(socket: WebSocket, type?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.removeEventListener("message", onMessage as EventListener);
        reject(new Error("Timed out waiting for message"));
      }, 1000);

      const onMessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        const parsed = JSON.parse(data) as T;
        if (!type || parsed.type === type) {
          clearTimeout(timeout);
          socket.removeEventListener("message", onMessage as EventListener);
          resolve(parsed);
        }
      };

      socket.addEventListener("message", onMessage as EventListener);
    });
  }

  it("responds with joined payload when a player joins", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const joinedPromise = onceMessage<{ type: string; state: { players: string[] }; ranking: { name: string; score: number }[] }>(socket, "joined");

      socket.send(JSON.stringify({ type: "join", name: "Alice" }));

      const joined = await joinedPromise;
      expect(joined.type).toBe("joined");
      expect(joined.state.players).toContain("Alice");
      expect(joined.ranking).toEqual([
        {
          name: "Alice",
          score: 0
        }
      ]);

      socket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("rejects invalid player names", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const errorPromise = onceMessage<{ type: string; reason: string }>(socket, "error");

      socket.send(JSON.stringify({ type: "join", name: "!!" }));

      const error = await errorPromise;
      expect(error.type).toBe("error");
      expect(error.reason).toBe("invalid_name");

      await new Promise<void>((resolve) => {
        socket.addEventListener(
          "close",
          () => {
            resolve();
          },
          { once: true }
        );
      });
    } finally {
      await mf.dispose();
    }
  });
});
