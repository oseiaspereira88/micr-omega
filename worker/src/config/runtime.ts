import type { Env } from "../index";

export type RuntimeConfig = {
  MIN_PLAYERS_TO_START: number;
  WAITING_START_DELAY_MS: number;
  ROUND_DURATION_MS: number;
  RESET_DELAY_MS: number;
  RECONNECT_WINDOW_MS: number;
  INACTIVE_TIMEOUT_MS: number;
  MAX_PLAYERS: number;
  MAX_CLIENT_MESSAGE_SIZE_BYTES: number;
  MAX_COMBO_MULTIPLIER: number;
  DAMAGE_POPUP_TTL_MS: number;
  MAX_DAMAGE_POPUPS_PER_TICK: number;
  RATE_LIMIT_WINDOW_MS: number;
  MAX_MESSAGES_PER_CONNECTION: number;
  MAX_MESSAGES_GLOBAL: number;
  GLOBAL_RATE_LIMIT_HEADROOM: number;
  RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS: number;
  WORLD_TICK_INTERVAL_MS: number;
  SNAPSHOT_FLUSH_INTERVAL_MS: number;
  PLAYER_ATTACK_COOLDOWN_MS: number;
  PLAYER_COLLECT_RADIUS: number;
  CONTACT_BUFFER: number;
  PLAYER_COLLISION_RADIUS: number;
  MICRO_COLLISION_RADIUS: number;
  OBSTACLE_PADDING: number;
  MICRO_LOW_HEALTH_THRESHOLD: number;
  MICRO_RETARGET_COOLDOWN_MS: number;
  MICRO_FLEE_DURATION_MS: number;
  MICRO_PATROL_RADIUS: number;
  MICRO_WAYPOINT_REACH_DISTANCE: number;
  MICRO_WAYPOINT_REFRESH_MS: number;
  MICRO_ZIG_ANGLE_RADIANS: number;
  MICRO_ZIG_INTERVAL_MS: number;
  MICRO_STEERING_SAMPLE_DISTANCE: number;
  SMALL_EVOLUTION_SLOT_BASE: number;
  SMALL_SLOT_LEVEL_DIVISOR: number;
  MEDIUM_SLOT_INTERVAL: number;
  LARGE_SLOT_INTERVAL: number;
  MIN_XP_REQUIREMENT: number;
  BASE_XP_REQUIREMENT: number;
  XP_REQUIREMENT_GROWTH: number;
  MAX_LEVEL_ITERATIONS: number;
  CLIENT_TIME_MAX_FUTURE_DRIFT_MS: number;
};

export type RuntimeConfigOverrides = Partial<RuntimeConfig>;

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  MIN_PLAYERS_TO_START: 1,
  WAITING_START_DELAY_MS: 15_000,
  ROUND_DURATION_MS: 120_000,
  RESET_DELAY_MS: 10_000,
  RECONNECT_WINDOW_MS: 30_000,
  INACTIVE_TIMEOUT_MS: 45_000,
  MAX_PLAYERS: 100,
  MAX_CLIENT_MESSAGE_SIZE_BYTES: 16 * 1024,
  MAX_COMBO_MULTIPLIER: 50,
  DAMAGE_POPUP_TTL_MS: 1_200,
  MAX_DAMAGE_POPUPS_PER_TICK: 12,
  RATE_LIMIT_WINDOW_MS: 60_000,
  MAX_MESSAGES_PER_CONNECTION: 4_200,
  MAX_MESSAGES_GLOBAL: 12_000,
  GLOBAL_RATE_LIMIT_HEADROOM: 1.25,
  RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS: 5_000,
  WORLD_TICK_INTERVAL_MS: 50,
  SNAPSHOT_FLUSH_INTERVAL_MS: 500,
  PLAYER_ATTACK_COOLDOWN_MS: 800,
  PLAYER_COLLECT_RADIUS: 60,
  CONTACT_BUFFER: 4,
  PLAYER_COLLISION_RADIUS: 36,
  MICRO_COLLISION_RADIUS: 60,
  OBSTACLE_PADDING: 12,
  MICRO_LOW_HEALTH_THRESHOLD: 0.3,
  MICRO_RETARGET_COOLDOWN_MS: 500,
  MICRO_FLEE_DURATION_MS: 2_000,
  MICRO_PATROL_RADIUS: 140,
  MICRO_WAYPOINT_REACH_DISTANCE: 16,
  MICRO_WAYPOINT_REFRESH_MS: 6_000,
  MICRO_ZIG_ANGLE_RADIANS: Math.PI / 6,
  MICRO_ZIG_INTERVAL_MS: 1_200,
  MICRO_STEERING_SAMPLE_DISTANCE: 360,
  SMALL_EVOLUTION_SLOT_BASE: 2,
  SMALL_SLOT_LEVEL_DIVISOR: 3,
  MEDIUM_SLOT_INTERVAL: 2,
  LARGE_SLOT_INTERVAL: 5,
  MIN_XP_REQUIREMENT: 60,
  BASE_XP_REQUIREMENT: 120,
  XP_REQUIREMENT_GROWTH: 45,
  MAX_LEVEL_ITERATIONS: 200,
  CLIENT_TIME_MAX_FUTURE_DRIFT_MS: 2_000,
};

const GLOBAL_RUNTIME_CONFIG_KEY = "__MICR_OMEGA_RUNTIME_CONFIG__";

type RuntimeConfigGlobal = typeof globalThis & {
  [GLOBAL_RUNTIME_CONFIG_KEY]?: RuntimeConfigOverrides;
};

type LoadRuntimeConfigOptions = {
  env?: Partial<Env> | Record<string, unknown>;
  overrides?: RuntimeConfigOverrides;
};

const coerceValue = <K extends keyof RuntimeConfig>(
  key: K,
  raw: unknown,
): RuntimeConfig[K] | undefined => {
  const defaultValue = DEFAULT_RUNTIME_CONFIG[key];
  if (typeof defaultValue === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw as RuntimeConfig[K];
    }
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed as RuntimeConfig[K];
      }
    }
    return undefined;
  }

  if (typeof defaultValue === "boolean") {
    if (typeof raw === "boolean") {
      return raw as RuntimeConfig[K];
    }
    if (typeof raw === "string") {
      const normalized = raw.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") {
        return true as RuntimeConfig[K];
      }
      if (normalized === "false" || normalized === "0") {
        return false as RuntimeConfig[K];
      }
    }
    return undefined;
  }

  return raw as RuntimeConfig[K];
};

const applyOverrides = (target: RuntimeConfig, overrides?: RuntimeConfigOverrides): void => {
  if (!overrides) {
    return;
  }

  for (const key of Object.keys(overrides) as (keyof RuntimeConfig)[]) {
    const raw = overrides[key];
    if (raw === undefined) {
      continue;
    }
    const coerced = coerceValue(key, raw);
    if (coerced !== undefined) {
      target[key] = coerced;
    }
  }
};

const getGlobalOverrides = (): RuntimeConfigOverrides => {
  const global = globalThis as RuntimeConfigGlobal;
  return global[GLOBAL_RUNTIME_CONFIG_KEY] ?? {};
};

const readEnvOverrides = (env?: LoadRuntimeConfigOptions["env"]): RuntimeConfigOverrides => {
  if (!env) {
    return {};
  }

  const overrides: RuntimeConfigOverrides = {};
  const record = env as Record<string, unknown>;

  for (const key of Object.keys(DEFAULT_RUNTIME_CONFIG) as (keyof RuntimeConfig)[]) {
    if (record[key] === undefined) {
      continue;
    }
    const coerced = coerceValue(key, record[key]);
    if (coerced !== undefined) {
      overrides[key] = coerced;
    }
  }

  return overrides;
};

export const loadRuntimeConfig = (options: LoadRuntimeConfigOptions = {}): RuntimeConfig => {
  const config: RuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG };

  applyOverrides(config, getGlobalOverrides());
  applyOverrides(config, readEnvOverrides(options.env));
  applyOverrides(config, options.overrides);

  return config;
};

export const setRuntimeConfigOverrides = (overrides?: RuntimeConfigOverrides): void => {
  const global = globalThis as RuntimeConfigGlobal;

  if (!overrides || Object.keys(overrides).length === 0) {
    delete global[GLOBAL_RUNTIME_CONFIG_KEY];
    return;
  }

  global[GLOBAL_RUNTIME_CONFIG_KEY] = { ...overrides };
};
