import React, { useCallback, useState } from 'react';
import GameApp from './GameApp.jsx';
import MicroWorldOnboardingFlow from './ui/onboarding/MicroWorldOnboardingFlow.jsx';
import MicroWorldConceptScreens from './ui/concepts/MicroWorldConceptScreens.jsx';

const detectInitialMode = () => {
  if (typeof window === 'undefined') {
    return 'concept';
  }

  try {
    const search = window.location?.search ?? '';
    const params = new URLSearchParams(search);
    const explicitMode = params.get('mode');

    if (typeof explicitMode === 'string') {
      const normalized = explicitMode.trim().toLowerCase();
      if (normalized === 'play' || normalized === 'game') {
        return 'game';
      }
    }

    return 'concept';
  } catch (error) {
    return 'concept';
  }
};

const App = () => {
  const [displayMode, setDisplayMode] = useState(() => detectInitialMode());

  const handleConceptComplete = useCallback(() => {
    setDisplayMode('game');
  }, []);

  if (displayMode === 'concept') {
    return <MicroWorldOnboardingFlow onComplete={handleConceptComplete} />;
  }

  return <GameApp />;
};

export default App;
