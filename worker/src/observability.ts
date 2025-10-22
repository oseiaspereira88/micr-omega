export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ObservabilityBindings {
  LOGFLARE_API_TOKEN?: string;
  LOGFLARE_SOURCE_ID?: string;
  LOGFLARE_BACKOFF_MS?: string | number;
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
const DEFAULT_LOGFLARE_BACKOFF_MS = 30_000;

type CircuitBreakerStatus = "open" | "closed";

interface CircuitBreakerState {
  failureCount: number;
  lastFailureAt?: number;
  openUntil?: number;
  status: CircuitBreakerStatus;
}

const circuitBreakerStates = new Map<string, CircuitBreakerState>();

const getCircuitKey = (apiToken: string, source: string) => `${apiToken}:${source}`;

const parseBackoffMs = (bindings: ObservabilityBindings) => {
  const { LOGFLARE_BACKOFF_MS } = bindings;
  const parsed = Number(LOGFLARE_BACKOFF_MS);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_LOGFLARE_BACKOFF_MS;
  }
  return parsed;
};

const emitCircuitMetric = (
  key: string,
  state: CircuitBreakerState,
  status: CircuitBreakerStatus
) => {
  const entry = {
    level: "info" as const,
    event: "metric_recorded",
    timestamp: new Date().toISOString(),
    component: "observability",
    service: "micr-omega-worker",
    metric: "logflare_circuit_state",
    value: status === "open" ? 1 : 0,
    dimensions: {
      key,
      status,
      failureCount: state.failureCount
    },
    category: "metric"
  } satisfies StructuredLogEntry;

  console.log(JSON.stringify(entry));
};

const dispatchToLogflare = async (
  bindings: ObservabilityBindings,
  entry: StructuredLogEntry
): Promise<void> => {
  const { LOGFLARE_API_TOKEN: apiToken, LOGFLARE_SOURCE_ID: source } = bindings;
  if (!apiToken || !source) {
    return;
  }

  const key = getCircuitKey(apiToken, source);
  const backoffMs = parseBackoffMs(bindings);
  const now = Date.now();
  const state = circuitBreakerStates.get(key) ?? {
    failureCount: 0,
    status: "closed" as CircuitBreakerStatus
  };

  if (!circuitBreakerStates.has(key)) {
    circuitBreakerStates.set(key, state);
  }

  if (state.status === "open" && state.openUntil && now < state.openUntil) {
    console.warn("[observability] Circuito do Logflare aberto, pulando envio", {
      key,
      openUntil: state.openUntil,
      now
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, LOGFLARE_TIMEOUT_MS);

  const registerFailure = () => {
    const current = Date.now();
    state.failureCount += 1;
    state.lastFailureAt = current;
    state.openUntil = current + backoffMs;
    if (state.status !== "open") {
      state.status = "open";
      emitCircuitMetric(key, state, "open");
    }
  };

  const registerSuccess = () => {
    const shouldEmitClosed = state.status === "open" || state.failureCount > 0;
    if (shouldEmitClosed) {
      state.failureCount = 0;
      state.lastFailureAt = undefined;
      state.openUntil = undefined;
      state.status = "closed";
      emitCircuitMetric(key, state, "closed");
    }
  };

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
      registerFailure();
      return;
    }

    registerSuccess();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[observability] Logflare request timed out", {
        timeoutMs: LOGFLARE_TIMEOUT_MS,
        entry
      });
      registerFailure();
      return;
    }
    // Evita loop infinito de logs
    console.error("[observability] Falha ao enviar log para Logflare", error);
    registerFailure();
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
