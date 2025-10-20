import packageJson from "../package.json";

export const HEALTH_PAYLOAD = {
  status: "ok" as const,
  version: packageJson.version,
};

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const satisfies HeadersInit;

export const HEALTH_JSON_HEADERS = {
  ...NO_STORE_HEADERS,
  "Content-Type": "application/json; charset=utf-8",
} as const satisfies HeadersInit;

export function createHealthResponse(): Response {
  return Response.json(HEALTH_PAYLOAD, {
    status: 200,
    headers: HEALTH_JSON_HEADERS,
  });
}
