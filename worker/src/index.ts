import { RoomDO } from "./RoomDO";
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

    const isSupportedRoute = url.pathname === "/" || url.pathname === "/ws";

    if (isSupportedRoute) {
      if (!isWebSocketRequest(request)) {
        observability.log("warn", "ws_upgrade_missing", {
          category: "protocol_error",
          url: url.toString(),
          path: url.pathname,
        });
        return new Response("Expected WebSocket", { status: 426 });
      }

      const id = env.ROOM.idFromName(ROOM_ID);
      const stub = env.ROOM.get(id);
      observability.log("info", "ws_upgrade_forwarded", {
        roomId: ROOM_ID,
        path: url.pathname,
      });
      return stub.fetch(request);
    }

    observability.log("warn", "unexpected_route", {
      category: "protocol_error",
      path: url.pathname,
      expectedPaths: ["/", "/ws"],
    });
    return new Response("Not Found", { status: 404 });
  }
};

export { RoomDO };
