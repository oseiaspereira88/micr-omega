export const useSkill = (state, helpers = {}) => {
  if (!state) return state;

  const { skills, addNotification, syncState, playSound } = helpers;
  const organism = state.organism;

  if (!organism || organism.skills.length === 0 || organism.dying) {
    return state;
  }

  const currentSkillKey = organism.skills[organism.currentSkillIndex];
  const skill = skills?.[currentSkillKey];

  if (!skill || organism.skillCooldowns[currentSkillKey] > 0) {
    return state;
  }

  const cost = skill.cost ?? {};
  const energyCost = Number.isFinite(cost.energy)
    ? cost.energy
    : Number.isFinite(skill.cost)
    ? skill.cost
    : 0;
  const xpCost = Number.isFinite(cost.xp) ? cost.xp : 0;
  const mgCost = Number.isFinite(cost.mg) ? cost.mg : 0;

  if (state.energy < energyCost) {
    addNotification?.(state, 'Energia insuficiente!');
    return state;
  }

  if ((state.xp?.current ?? 0) < xpCost) {
    addNotification?.(state, 'XP insuficiente!');
    return state;
  }

  if ((state.geneticMaterial?.current ?? 0) < mgCost) {
    addNotification?.(state, 'MG insuficiente!');
    return state;
  }

  state.energy -= energyCost;
  if (xpCost > 0 && state.xp) {
    state.xp.current = Math.max(0, state.xp.current - xpCost);
  }
  if (mgCost > 0 && state.geneticMaterial) {
    state.geneticMaterial.current = Math.max(0, state.geneticMaterial.current - mgCost);
  }
  skill.effect(state);
  organism.skillCooldowns[currentSkillKey] = skill.cooldown / 1000;
  state.uiSyncTimer = 0;
  playSound?.('skill');
  syncState?.(state);
  return state;
};

export const cycleSkill = (state, helpers = {}, direction = 1) => {
  if (!state) return state;

  const { skills, addNotification, syncState } = helpers;
  const organism = state.organism;

  if (!organism || organism.skills.length <= 1 || organism.dying) {
    return state;
  }

  const total = organism.skills.length;
  organism.currentSkillIndex = (organism.currentSkillIndex + direction + total) % total;

  const skillKey = organism.skills[organism.currentSkillIndex];
  const skill = skills?.[skillKey];
  if (skill) {
    addNotification?.(state, `Skill: ${skill.name}`);
  }

  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};
