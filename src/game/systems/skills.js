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

  if (state.energy < skill.cost) {
    addNotification?.(state, 'Energia insuficiente!');
    return state;
  }

  state.energy -= skill.cost;
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
