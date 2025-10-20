import { build } from "esbuild";
import { Miniflare } from "miniflare";

import { setRuntimeConfigOverrides, type RuntimeConfigOverrides } from "../../src/config/runtime";

let cachedScript: string | null = null;

async function bundleWorker(): Promise<string> {
  if (cachedScript) {
    return cachedScript;
  }

  const bundle = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    write: false,
    sourcemap: "inline",
  });

  cachedScript = bundle.outputFiles[0]?.text ?? "";
  return cachedScript;
}

export interface CreateMiniflareOptions {
  runtime?: RuntimeConfigOverrides;
}

export async function createMiniflare(options: CreateMiniflareOptions = {}) {
  const script = await bundleWorker();
  setRuntimeConfigOverrides(options.runtime);
  const bindings = options.runtime
    ? Object.fromEntries(
        Object.entries(options.runtime).map(([key, value]) => [key, String(value)])
      )
    : undefined;
  return new Miniflare({
    modules: true,
    script,
    compatibilityDate: "2024-10-01",
    durableObjects: {
      ROOM: { className: "RoomDO" },
    },
    bindings,
  });
}

export async function openSocket(mf: Miniflare) {
  const response = await mf.dispatchFetch("http://localhost/", {
    headers: { Upgrade: "websocket" },
  });
  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`failed to open websocket: status ${response.status}`);
  }
  const socket = response.webSocket;
  socket.accept();
  return socket;
}

export type MessagePayload = { type: string; [key: string]: unknown };

export function onceMessage<T extends MessagePayload>(
  socket: WebSocket,
  type?: string,
  timeoutMs = 1000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage as EventListener);
      reject(new Error(`Timed out waiting for ${type ?? "any"} message`));
    }, timeoutMs);

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

export function waitForRanking(
  socket: WebSocket,
  predicate: (ranking: { playerId: string; score: number }[]) => boolean,
  timeoutMs = 5000,
): Promise<{ playerId: string; score: number; name?: string }[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage as EventListener);
      reject(new Error("Timed out waiting for ranking update"));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      const parsed = JSON.parse(data) as MessagePayload;
      if (parsed.type === "ranking") {
        const ranking = (parsed as { ranking: { playerId: string; score: number; name?: string }[] }).ranking ?? [];
        if (predicate(ranking)) {
          clearTimeout(timeout);
          socket.removeEventListener("message", onMessage as EventListener);
          resolve(ranking);
        }
      }
    };

    socket.addEventListener("message", onMessage as EventListener);
  });
}
