import { describe, expect, it } from "vitest";
import { createMiniflare } from "./utils/miniflare";

describe("health check", () => {
  it("returns ok status for /health", async () => {
    const mf = await createMiniflare();

    try {
      const response = await mf.dispatchFetch("http://localhost/health");
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await mf.dispose();
    }
  });

  it("continues to reject non-health routes", async () => {
    const mf = await createMiniflare();

    try {
      const notFound = await mf.dispatchFetch("http://localhost/unknown");
      expect(notFound.status).toBe(404);

      const upgradeRequired = await mf.dispatchFetch("http://localhost/");
      expect(upgradeRequired.status).toBe(426);
    } finally {
      await mf.dispose();
    }
  });
});
