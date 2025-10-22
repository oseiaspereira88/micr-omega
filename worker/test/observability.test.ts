import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservability } from "../src/observability";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
        LOGFLARE_API_TOKEN: "token-error",
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

  it("aborta envio ao Logflare quando a requisição expira", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const observability = createObservability(
      {
        LOGFLARE_API_TOKEN: "token-timeout",
        LOGFLARE_SOURCE_ID: "source"
      },
      { component: "test" }
    );

    observability.log("info", "event");

    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[observability] Logflare request timed out",
        expect.objectContaining({ timeoutMs: 5_000 })
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("abre e fecha circuito do Logflare durante falhas e sucessos", async () => {
    vi.useFakeTimers();

    const failingResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("boom")
    } as unknown as Response;

    const successResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("")
    } as unknown as Response;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failingResponse)
      .mockResolvedValue(successResponse);

    vi.stubGlobal("fetch", fetchMock);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const observability = createObservability(
      {
        LOGFLARE_API_TOKEN: "token-circuit",
        LOGFLARE_SOURCE_ID: "source",
        LOGFLARE_BACKOFF_MS: 1_000
      },
      { component: "test" }
    );

    observability.log("info", "primeiro_evento");

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[observability] Logflare respondeu com erro",
        expect.objectContaining({ status: 500 })
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    observability.log("info", "segundo_evento");

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[observability] Circuito do Logflare aberto, pulando envio",
      expect.objectContaining({ key: "token-circuit:source" })
    );

    await vi.advanceTimersByTimeAsync(1_000);

    observability.log("info", "terceiro_evento");

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await vi.waitFor(() => {
      const metricEntries = consoleLogSpy.mock.calls
        .map(([arg]) => {
          if (typeof arg !== "string") return undefined;
          try {
            return JSON.parse(arg);
          } catch {
            return undefined;
          }
        })
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry && entry["event"] === "metric_recorded")
        );

      expect(metricEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metric: "logflare_circuit_state",
            value: 1,
            dimensions: expect.objectContaining({ status: "open", failureCount: 1 })
          }),
          expect.objectContaining({
            metric: "logflare_circuit_state",
            value: 0,
            dimensions: expect.objectContaining({ status: "closed", failureCount: 0 })
          })
        ])
      );
    });

    observability.log("info", "quarto_evento");

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
