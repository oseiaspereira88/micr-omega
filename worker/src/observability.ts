export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ObservabilityBindings {
  LOGFLARE_API_TOKEN?: string;
  LOGFLARE_SOURCE_ID?: string;
}

export interface ObservabilityContext {
  component: string;
  service?: string;
}

interface StructuredLogEntry extends Record<string, unknown> {
  level: LogLevel;
  event: string;
  timestamp: string;
  component: string;
  service: string;
  category?: string;
}

export interface Observability {
  log: (level: LogLevel, event: string, data?: Record<string, unknown>) => void;
  logError: (event: string, error: unknown, data?: Record<string, unknown>) => void;
  recordMetric: (name: string, value: number, dimensions?: Record<string, string | number>) => void;
}

const LOGFLARE_ENDPOINT = "https://api.logflare.app/logs";
const LOGFLARE_TIMEOUT_MS = 5_000;

const dispatchToLogflare = async (
  bindings: ObservabilityBindings,
  entry: StructuredLogEntry
): Promise<void> => {
  const { LOGFLARE_API_TOKEN: apiToken, LOGFLARE_SOURCE_ID: source } = bindings;
  if (!apiToken || !source) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, LOGFLARE_TIMEOUT_MS);

  try {
    const response = await fetch(LOGFLARE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiToken
      },
      body: JSON.stringify({
        source,
        log_entry: entry,
        metadata: entry
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      let bodyText: string | undefined;
      try {
        bodyText = await response.text();
      } catch (bodyReadError) {
        bodyText = `[unavailable: ${String(bodyReadError)}]`;
      }

      // Não fazemos retry automático para evitar duplicar eventos e gerar backpressure no Logflare.
      console.error("[observability] Logflare respondeu com erro", {
        status: response.status,
        body: bodyText,
        entry
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[observability] Logflare request timed out", {
        timeoutMs: LOGFLARE_TIMEOUT_MS,
        entry
      });
      return;
    }
    // Evita loop infinito de logs
    console.error("[observability] Falha ao enviar log para Logflare", error);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  }
  return {
    message: String(error)
  };
};

export const createObservability = (
  bindings: ObservabilityBindings,
  context: ObservabilityContext
): Observability => {
  const service = context.service ?? "micr-omega-worker";

  const log = (level: LogLevel, event: string, data: Record<string, unknown> = {}) => {
    const entry: StructuredLogEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      component: context.component,
      service,
      ...data
    };

    console.log(JSON.stringify(entry));
    void dispatchToLogflare(bindings, entry);
  };

  const logError = (event: string, error: unknown, data: Record<string, unknown> = {}) => {
    log("error", event, {
      ...data,
      error: serializeError(error),
      category: data.category ?? "error"
    });
  };

  const recordMetric = (
    name: string,
    value: number,
    dimensions: Record<string, string | number> = {}
  ) => {
    log("info", "metric_recorded", {
      metric: name,
      value,
      dimensions,
      category: "metric"
    });
  };

  return {
    log,
    logError,
    recordMetric
  };
};
