import React from 'react';

import GameCanvas from './game/engine/GameCanvas.jsx';
import { GameProvider } from './game/engine/GameContext.jsx';

const MicroOmegaGame = () => (
  <GameProvider>
    <GameCanvas />
  </GameProvider>
);

export default MicroOmegaGame;
