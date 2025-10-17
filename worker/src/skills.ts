import type { StatusEffectEvent } from "@micr-omega/shared";

export const SKILL_KEYS = [
  "pulse",
  "spike",
  "shield",
  "drain",
  "biofilm",
  "entangle",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export const isSkillKey = (value: string): value is SkillKey =>
  (SKILL_KEYS as readonly string[]).includes(value as SkillKey);

export type SkillEffectKind =
  | "pulse"
  | "projectile"
  | "shield"
  | "drain"
  | "beam"
  | "entangle";

export type SkillDefinition = {
  key: SkillKey;
  name: string;
  icon: string;
  cooldownMs: number;
  cost: {
    energy?: number;
    xp?: number;
    mg?: number;
  };
  color: string;
  effect: SkillEffectKind;
  applies: StatusTag[];
  parameters?: Record<string, number>;
};

export type StatusTag =
  | "FISSURE"
  | "KNOCKBACK"
  | "CORROSION"
  | "ENTANGLED"
  | "LEECH"
  | "RESTORE"
  | "PHOTOLESION";

type SkillDefinitionMap = Record<SkillKey, SkillDefinition>;

export const SKILL_DEFINITIONS: SkillDefinitionMap = {
  pulse: {
    key: "pulse",
    name: "Pulso Osmótico",
    icon: "💥",
    cooldownMs: 3_200,
    cost: { energy: 28, xp: 6 },
    color: "#00D9FF",
    effect: "pulse",
    applies: ["FISSURE", "KNOCKBACK"],
    parameters: {
      radiusMultiplier: 1.1,
      damageMultiplier: 0.45,
      knockbackForce: 18,
      statusDurationMs: 6_000,
    },
  },
  spike: {
    key: "spike",
    name: "Lança Corrosiva",
    icon: "🔱",
    cooldownMs: 2_300,
    cost: { energy: 18, xp: 4 },
    color: "#FF0066",
    effect: "projectile",
    applies: ["CORROSION"],
    parameters: {
      projectileCount: 3,
      spreadRadians: 0.28,
      damageMultiplier: 1.35,
      statusDurationMs: 7_000,
    },
  },
  shield: {
    key: "shield",
    name: "Biofilme Local",
    icon: "🛡️",
    cooldownMs: 5_200,
    cost: { energy: 24, mg: 5 },
    color: "#7ED957",
    effect: "shield",
    applies: ["ENTANGLED"],
    parameters: {
      radiusMultiplier: 0.8,
      durationMs: 1_800,
      healMultiplier: 0.4,
      statusDurationMs: 4_000,
    },
  },
  drain: {
    key: "drain",
    name: "Absorção Vital",
    icon: "🌀",
    cooldownMs: 4_200,
    cost: { energy: 30, xp: 8 },
    color: "#00FF88",
    effect: "drain",
    applies: ["LEECH", "RESTORE", "FISSURE"],
    parameters: {
      radiusMultiplier: 1.4,
      damageMultiplier: 0.4,
      minimumDamage: 6,
      statusDurationMs: 4_000,
    },
  },
  biofilm: {
    key: "biofilm",
    name: "Rede Fotônica",
    icon: "🔆",
    cooldownMs: 3_600,
    cost: { energy: 26, xp: 10 },
    color: "#FFD93D",
    effect: "beam",
    applies: ["PHOTOLESION"],
    parameters: {
      radiusMultiplier: 1.6,
      damageMultiplier: 0.55,
      alignmentThreshold: 0.45,
      statusDurationMs: 5_000,
    },
  },
  entangle: {
    key: "entangle",
    name: "Tecido Adesivo",
    icon: "🕸️",
    cooldownMs: 2_800,
    cost: { energy: 16, mg: 4 },
    color: "#7F8CFF",
    effect: "entangle",
    applies: ["ENTANGLED"],
    parameters: {
      radiusMultiplier: 1.3,
      stacks: 2,
      statusDurationMs: 3_500,
    },
  },
};

export const getSkillDefinition = (key: SkillKey): SkillDefinition | null => {
  return SKILL_DEFINITIONS[key] ?? null;
};

export const getDefaultSkillList = (): SkillKey[] => SKILL_KEYS.slice();

export const cloneSkillCooldowns = (
  cooldowns: Record<string, number> | undefined,
): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!cooldowns) {
    return result;
  }
  for (const [skillKey, value] of Object.entries(cooldowns)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      result[skillKey] = Math.max(0, value);
    }
  }
  return result;
};

export const cloneStatusEvents = (events: StatusEffectEvent[] | undefined) =>
  Array.isArray(events) ? events.map((event) => ({ ...event })) : [];
