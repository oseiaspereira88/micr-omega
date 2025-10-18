import React from 'react';

import GameCanvas from './game/engine/GameCanvas.jsx';
import { GameProvider } from './game/engine/GameContext.jsx';

const MicroOmegaGame = ({ settings, onQuit, onReconnect }) => (
  <GameProvider>
    <GameCanvas settings={settings} onQuit={onQuit} onReconnect={onReconnect} />
  </GameProvider>
);

export default MicroOmegaGame;
