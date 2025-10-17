import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservability } from "../src/observability";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registra erro quando Logflare responde com status não OK", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("boom")
      } as unknown as Response);

    vi.stubGlobal("fetch", fetchMock);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const observability = createObservability(
      {
        LOGFLARE_API_TOKEN: "token",
        LOGFLARE_SOURCE_ID: "source"
      },
      { component: "test" }
    );

    observability.log("info", "event");

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[observability] Logflare respondeu com erro",
        expect.objectContaining({ status: 500, body: "boom" })
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
