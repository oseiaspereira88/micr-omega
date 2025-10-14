import React, { createContext, useContext, useReducer } from 'react';

import { createResourceProfile } from '../state/resourceProfile';

const GameStateContext = createContext(undefined);
const GameDispatchContext = createContext(undefined);

const baseResources = createResourceProfile();

const initialState = {
  energy: 0,
  health: 100,
  maxHealth: 100,
  level: 1,
  score: 0,
  dashCharge: 100,
  canEvolve: false,
  showEvolutionChoice: false,
  showMenu: false,
  gameOver: false,
  combo: 0,
  maxCombo: 0,
  activePowerUps: [],
  bossActive: false,
  bossHealth: 0,
  bossMaxHealth: 0,
  currentSkill: null,
  skillList: [],
  hasMultipleSkills: false,
  notifications: [],
  availableTraits: [],
  availableForms: [],
  currentForm: null,
  formReapplyNotice: false,
  evolutionType: null,
  cameraZoom: 1,
  opponents: [],
  resources: baseResources,
  xp: baseResources.xp,
  characteristicPoints: baseResources.characteristicPoints,
  geneticMaterial: baseResources.geneticMaterial,
  geneFragments: baseResources.geneFragments,
  stableGenes: baseResources.stableGenes,
  evolutionSlots: baseResources.evolutionSlots,
  reroll: baseResources.reroll,
  dropPity: baseResources.dropPity,
  progressionQueue: [],
  recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
  evolutionContext: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SYNC_STATE':
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        {children}
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameProvider');
  }
  return context;
};

export const useGameDispatch = () => {
  const context = useContext(GameDispatchContext);
  if (context === undefined) {
    throw new Error('useGameDispatch must be used within a GameProvider');
  }
  return context;
};

