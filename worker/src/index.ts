import { RoomDO } from "./RoomDO";
import { createObservability, type ObservabilityBindings } from "./observability";
import {
  ROOM_ID_HEADER,
  deriveRoomIdFromUrl,
  parseRoomRoute,
  routeExpectsWebSocket,
  normalizePathname,
} from "./room-routing";

export interface Env extends ObservabilityBindings {
  ROOM: DurableObjectNamespace;
}

function isWebSocketRequest(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const observability = createObservability(env, { component: "Worker" });
    const url = new URL(request.url);

    const route = parseRoomRoute(url.pathname);
    const expectsWebSocket = routeExpectsWebSocket(route);
    const derivedRoom = deriveRoomIdFromUrl(url, route);
    const roomId = derivedRoom.roomId;

    if (route && expectsWebSocket) {
      if (!isWebSocketRequest(request)) {
        observability.log("warn", "ws_upgrade_missing", {
          category: "protocol_error",
          url: url.toString(),
          path: url.pathname,
          roomId,
          route: route.kind,
          derivedFrom: derivedRoom.source,
        });
        return new Response("Expected WebSocket", { status: 426 });
      }

      const id = env.ROOM.idFromName(roomId);
      const stub = env.ROOM.get(id);
      const headers = new Headers(request.headers);
      headers.set(ROOM_ID_HEADER, roomId);
      const forwardRequest = new Request(request, { headers });

      observability.log("info", "ws_upgrade_forwarded", {
        roomId,
        path: url.pathname,
        route: route.kind,
        derivedFrom: derivedRoom.source,
      });
      try {
        return await stub.fetch(forwardRequest);
      } catch (error) {
        observability.logError("ws_upgrade_forward_failed", error, {
          roomId,
          path: url.pathname,
          route: route.kind,
          derivedFrom: derivedRoom.source,
        });

        if (isWebSocketRequest(request)) {
          const pair = new WebSocketPair();
          const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

          try {
            server.accept();
            server.close(1011, "internal_error");
          } catch (closeError) {
            observability.logError("ws_upgrade_cleanup_failed", closeError, {
              roomId,
              path: url.pathname,
              route: route.kind,
            });
          }

          return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("Internal Server Error", { status: 500 });
      }
    }

    const normalizedPath = normalizePathname(url.pathname);
    observability.log("warn", "unexpected_route", {
      category: "protocol_error",
      path: url.pathname,
      normalizedPath,
    });
    return new Response("Not Found", { status: 404 });
  }
};

export { RoomDO };
