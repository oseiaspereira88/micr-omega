import { RoomDO } from "./RoomDO";
import { createHealthResponse, NO_STORE_HEADERS } from "./health";
import { createObservability, type ObservabilityBindings } from "./observability";

export interface Env extends ObservabilityBindings {
  ROOM: DurableObjectNamespace;
}

const ROOM_ID = "public-room";

function isWebSocketRequest(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const observability = createObservability(env, { component: "Worker" });
    const url = new URL(request.url);

    const pathname = url.pathname === "" ? "/" : url.pathname;

    if (pathname === "/health") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405, headers: NO_STORE_HEADERS });
      }

      observability.log("debug", "health_check", { path: pathname });
      return createHealthResponse();
    }

    const isSupportedRoute = pathname === "/" || pathname === "/ws";

    if (isSupportedRoute) {
      if (!isWebSocketRequest(request)) {
        observability.log("warn", "ws_upgrade_missing", {
          category: "protocol_error",
          url: url.toString(),
          path: url.pathname
        });
        return new Response("Expected WebSocket", { status: 426 });
      }

      const id = env.ROOM.idFromName(ROOM_ID);
      const stub = env.ROOM.get(id);
      observability.log("info", "ws_upgrade_forwarded", {
        roomId: ROOM_ID,
        path: url.pathname
      });
      try {
        return await stub.fetch(request);
      } catch (error) {
        observability.logError("ws_upgrade_forward_failed", error, {
          roomId: ROOM_ID,
          path: url.pathname
        });

        if (isWebSocketRequest(request)) {
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

          try {
            server.accept();
            server.close(1011, "internal_error");
          } catch (closeError) {
            observability.logError("ws_upgrade_cleanup_failed", closeError, {
              roomId: ROOM_ID,
              path: url.pathname
            });
          }

          return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("Internal Server Error", { status: 500 });
      }
    }

    observability.log("warn", "unexpected_route", {
      category: "protocol_error",
      path: pathname,
      expectedPaths: ["/", "/ws", "/health"]
    });
    return new Response("Not Found", { status: 404, headers: NO_STORE_HEADERS });
  }
};

export { RoomDO };
