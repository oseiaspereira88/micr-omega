export const DEFAULT_ROOM_ID = "public-room";
export const ROOM_ID_HEADER = "X-MicrOmega-Room-Id";
const ROOM_ID_MAX_LENGTH = 64;

export type RoomRouteKind = "root" | "root_ws" | "room" | "room_ws";

export interface RoomRoute {
  kind: RoomRouteKind;
  roomSegment?: string;
}

export type RoomIdSource = "path" | "query" | "default";

export interface DerivedRoomId {
  roomId: string;
  source: RoomIdSource;
}

const ROOM_PREFIX = "/rooms/";

export function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }
  let normalized = pathname.replace(/\/+/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function parseRoomRoute(pathname: string): RoomRoute | null {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") {
    return { kind: "root" };
  }
  if (normalized === "/ws") {
    return { kind: "root_ws" };
  }
  if (!normalized.startsWith(ROOM_PREFIX)) {
    return null;
  }
  const remainder = normalized.slice(ROOM_PREFIX.length);
  if (!remainder) {
    return null;
  }
  const segments = remainder.split("/");
  const [roomSegment, ...rest] = segments;
  if (!roomSegment) {
    return null;
  }
  if (rest.length === 0) {
    return { kind: "room", roomSegment };
  }
  if (rest.length === 1 && rest[0] === "ws") {
    return { kind: "room_ws", roomSegment };
  }
  return null;
}

export function sanitizeRoomId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const sanitized = trimmed.replace(/[^0-9A-Za-z_-]/g, "");
  if (!sanitized) {
    return null;
  }
  if (sanitized.length > ROOM_ID_MAX_LENGTH) {
    return sanitized.slice(0, ROOM_ID_MAX_LENGTH);
  }
  return sanitized;
}

export function deriveRoomIdFromUrl(url: URL, route: RoomRoute | null): DerivedRoomId {
  if (route?.roomSegment) {
    const fromPath = sanitizeRoomId(route.roomSegment);
    if (fromPath) {
      return { roomId: fromPath, source: "path" };
    }
  }

  const queryRoom = url.searchParams.get("room");
  const fromQuery = sanitizeRoomId(queryRoom);
  if (fromQuery) {
    return { roomId: fromQuery, source: "query" };
  }

  return { roomId: DEFAULT_ROOM_ID, source: "default" };
}

export function routeExpectsWebSocket(route: RoomRoute | null): boolean {
  if (!route) {
    return false;
  }
  switch (route.kind) {
    case "root":
    case "root_ws":
    case "room":
    case "room_ws":
      return true;
    default:
      return false;
  }
}
