import React from 'react';

import GameCanvas from './game/engine/GameCanvas.jsx';
import { GameProvider } from './game/engine/GameContext.jsx';

const MicroOmegaGame = ({ settings, onQuit }) => (
  <GameProvider>
    <GameCanvas settings={settings} onQuit={onQuit} />
  </GameProvider>
);

export default MicroOmegaGame;
