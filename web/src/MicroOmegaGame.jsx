import React from 'react';

import GameCanvas from './game/engine/GameCanvas.jsx';
import { GameProvider } from './game/engine/GameContext.jsx';

const MicroOmegaGame = ({ settings, updateSettings, onQuit, onReconnect }) => (
  <GameProvider>
    <GameCanvas
      settings={settings}
      updateSettings={updateSettings}
      onQuit={onQuit}
      onReconnect={onReconnect}
    />
  </GameProvider>
);

export default MicroOmegaGame;
