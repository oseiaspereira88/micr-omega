export { performDash, updateOrganismPhysics } from './movement';
export { performAttack, updateEnemy } from './combat';
export { useSkill, cycleSkill } from './skills';
export {
  checkEvolution,
  openEvolutionMenu,
  chooseEvolution,
  chooseTrait,
  chooseForm,
  selectArchetype,
  restartGame,
  requestEvolutionReroll,
} from './progression';

import { updateOrganismPhysics } from './movement';
import { updateEnemy } from './combat';

export const runGameSystems = (state, delta = 0, helpers = {}) => {
  if (!state) return state;

  updateOrganismPhysics(state, helpers, delta);
  state.enemies = state.enemies.filter(enemy => updateEnemy(state, helpers, enemy, delta));

  return state;
};
