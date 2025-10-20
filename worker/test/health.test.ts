import { describe, expect, it } from "vitest";

import { HEALTH_PAYLOAD } from "../src/health";
import { createMiniflare } from "./utils/miniflare";

describe("Worker health endpoint", () => {
  it("responds with status information", async () => {
    const mf = await createMiniflare();

    try {
      const response = await mf.dispatchFetch("http://localhost/health");
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");

      const payload = await response.json();
      expect(payload).toEqual(HEALTH_PAYLOAD);
    } finally {
      await mf.dispose();
    }
  });

  it("returns 404 for unknown routes", async () => {
    const mf = await createMiniflare();

    try {
      const response = await mf.dispatchFetch("http://localhost/not-found");
      expect(response.status).toBe(404);
    } finally {
      await mf.dispose();
    }
  });
});
