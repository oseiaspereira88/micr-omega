import React, { useMemo } from 'react';
import GameApp from './GameApp.jsx';
import MicroWorldConceptScreens from './ui/concepts/MicroWorldConceptScreens.jsx';

const detectConceptMode = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const search = window.location?.search ?? '';
    const params = new URLSearchParams(search);
    const toggles = ['ui', 'mode', 'screen'];

    for (const key of toggles) {
      const value = params.get(key);
      if (typeof value === 'string' && value.toLowerCase() === 'concept') {
        return true;
      }
    }

    const hash = window.location?.hash ?? '';
    return hash.toLowerCase().includes('concept');
  } catch (error) {
    return false;
  }
};

const App = () => {
  const isConceptMode = useMemo(detectConceptMode, []);

  if (isConceptMode) {
    return <MicroWorldConceptScreens />;
  }

  return <GameApp />;
};

export default App;
