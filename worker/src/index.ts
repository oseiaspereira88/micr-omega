import { RoomDO } from "./RoomDO";

export interface Env {
  ROOM: DurableObjectNamespace;
}

const ROOM_ID = "public-room";

function isWebSocketRequest(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (!isWebSocketRequest(request)) {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const id = env.ROOM.idFromName(ROOM_ID);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};

export { RoomDO };
