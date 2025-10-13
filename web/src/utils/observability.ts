import * as Sentry from "@sentry/react";

type LatencyMetadata = {
  source?: "ws" | "http" | "render";
  phase?: string;
};

export const reportRealtimeLatency = (latencyMs: number, metadata: LatencyMetadata = {}): void => {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return;
  }

  if (typeof Sentry.metrics?.distribution === "function") {
    Sentry.metrics.distribution("realtime.latency", latencyMs, {
      unit: "millisecond",
      ...metadata
    });
  }
};

export const reportClientError = (error: unknown): void => {
  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureMessage(typeof error === "string" ? error : JSON.stringify(error));
  }
};
