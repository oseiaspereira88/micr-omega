export const SKILL_METADATA = {
  pulse: { key: 'pulse', name: 'Pulso Osmótico', icon: '💥' },
  spike: { key: 'spike', name: 'Lança Corrosiva', icon: '🔱' },
  shield: { key: 'shield', name: 'Biofilme Local', icon: '🛡️' },
  drain: { key: 'drain', name: 'Absorção Vital', icon: '🌀' },
  biofilm: { key: 'biofilm', name: 'Rede Fotônica', icon: '🔆' },
  entangle: { key: 'entangle', name: 'Tecido Adesivo', icon: '🕸️' },
};

export const skillMetadataList = Object.values(SKILL_METADATA);

export const getSkillMetadata = (key) => SKILL_METADATA[key] ?? null;
