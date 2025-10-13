import React from 'react';

import GameCanvas from './game/engine/GameCanvas.jsx';
import { GameProvider } from './game/engine/GameContext.jsx';

const MicroOmegaGame = ({ settings }) => (
  <GameProvider>
    <GameCanvas settings={settings} />
  </GameProvider>
);

export default MicroOmegaGame;
