export interface RuntimeConfig {
  minPlayersToStart: number;
  waitingStartDelayMs: number;
  roundDurationMs: number;
  resetDelayMs: number;
  reconnectWindowMs: number;
  inactiveTimeoutMs: number;
  handshakeTimeoutMs: number;
  maxPlayers: number;
  rateLimitWindowMs: number;
  maxMessagesPerConnection: number;
  maxMessagesGlobal: number;
  globalRateLimitHeadroom: number;
  rateLimitUtilizationReportIntervalMs: number;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  minPlayersToStart: 1,
  waitingStartDelayMs: 15_000,
  roundDurationMs: 120_000,
  resetDelayMs: 10_000,
  reconnectWindowMs: 30_000,
  inactiveTimeoutMs: 45_000,
  handshakeTimeoutMs: 10_000,
  maxPlayers: 100,
  rateLimitWindowMs: 60_000,
  maxMessagesPerConnection: 4_200,
  maxMessagesGlobal: 12_000,
  globalRateLimitHeadroom: 1.25,
  rateLimitUtilizationReportIntervalMs: 5_000,
};

const BINDING_TO_CONFIG_KEY = {
  ROOM_MIN_PLAYERS_TO_START: "minPlayersToStart",
  ROOM_WAITING_START_DELAY_MS: "waitingStartDelayMs",
  ROOM_ROUND_DURATION_MS: "roundDurationMs",
  ROOM_RESET_DELAY_MS: "resetDelayMs",
  ROOM_RECONNECT_WINDOW_MS: "reconnectWindowMs",
  ROOM_INACTIVE_TIMEOUT_MS: "inactiveTimeoutMs",
  ROOM_HANDSHAKE_TIMEOUT_MS: "handshakeTimeoutMs",
  ROOM_MAX_PLAYERS: "maxPlayers",
  ROOM_RATE_LIMIT_WINDOW_MS: "rateLimitWindowMs",
  ROOM_MAX_MESSAGES_PER_CONNECTION: "maxMessagesPerConnection",
  ROOM_MAX_MESSAGES_GLOBAL: "maxMessagesGlobal",
  ROOM_GLOBAL_RATE_LIMIT_HEADROOM: "globalRateLimitHeadroom",
  ROOM_RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS: "rateLimitUtilizationReportIntervalMs",
} as const satisfies Record<string, keyof RuntimeConfig>;

type BindingKey = keyof typeof BINDING_TO_CONFIG_KEY;
type ConfigKey = (typeof BINDING_TO_CONFIG_KEY)[BindingKey];

const CONFIG_KEY_TO_BINDING = Object.fromEntries(
  Object.entries(BINDING_TO_CONFIG_KEY).map(([binding, configKey]) => [configKey, binding]),
) as { [K in ConfigKey]: BindingKey };

export type RuntimeConfigBindings = {
  [K in BindingKey]?: string | number;
};

function coerceNumber(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeRuntimeConfigValue(key: ConfigKey, value: number | null): number | null {
  if (value === null) {
    return null;
  }

  switch (key) {
    case "minPlayersToStart":
    case "maxPlayers":
      return value >= 1 ? Math.round(value) : null;
    case "globalRateLimitHeadroom":
      return value > 0 ? value : null;
    default:
      return value >= 0 ? value : null;
  }
}

function assignRuntimeConfigValue(
  target: RuntimeConfig,
  key: ConfigKey,
  value: number | null,
): void {
  const sanitized = sanitizeRuntimeConfigValue(key, value);
  if (sanitized !== null) {
    target[key] = sanitized;
  }
}

export function loadRuntimeConfig(
  bindings?: RuntimeConfigBindings | null,
  overrides?: Partial<RuntimeConfig> | null,
): RuntimeConfig {
  const config: RuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG };

  if (bindings) {
    for (const bindingKey of Object.keys(BINDING_TO_CONFIG_KEY) as BindingKey[]) {
      const configKey = BINDING_TO_CONFIG_KEY[bindingKey];
      const raw = bindings[bindingKey];
      const parsed = coerceNumber(raw);
      assignRuntimeConfigValue(config, configKey, parsed);
    }
  }

  if (overrides) {
    for (const key of Object.keys(overrides) as ConfigKey[]) {
      const value = overrides[key];
      if (value === undefined) {
        continue;
      }
      assignRuntimeConfigValue(config, key, value);
    }
  }

  return config;
}

export function createRuntimeConfigBindings(
  overrides: Partial<RuntimeConfig>,
): RuntimeConfigBindings {
  const bindings: RuntimeConfigBindings = {};

  for (const key of Object.keys(overrides) as ConfigKey[]) {
    const value = overrides[key];
    if (value === undefined) {
      continue;
    }
    const bindingKey = CONFIG_KEY_TO_BINDING[key];
    bindings[bindingKey] = String(value);
  }

  return bindings;
}

export type { RuntimeConfig as RoomRuntimeConfig };
