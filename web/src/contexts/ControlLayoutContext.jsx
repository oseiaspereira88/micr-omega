import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * A11Y-003: Customizable Button Layout Context (Simplified)
 * Manages touch control layout presets
 */

const ControlLayoutContext = createContext(null);

// Predefined layout presets
const LAYOUT_PRESETS = {
  default: {
    id: 'default',
    name: 'Padrão',
    description: 'Layout padrão com joystick à esquerda e botões à direita',
    joystickSide: 'left',
    buttonSide: 'right',
    buttonScale: 1.0,
    buttonOpacity: 1.0,
    compact: false,
  },
  leftHanded: {
    id: 'leftHanded',
    name: 'Canhoto',
    description: 'Joystick à direita e botões à esquerda',
    joystickSide: 'right',
    buttonSide: 'left',
    buttonScale: 1.0,
    buttonOpacity: 1.0,
    compact: false,
  },
  compact: {
    id: 'compact',
    name: 'Compacto',
    description: 'Botões agrupados próximos para telas pequenas',
    joystickSide: 'left',
    buttonSide: 'right',
    buttonScale: 0.85,
    buttonOpacity: 1.0,
    compact: true,
  },
  spread: {
    id: 'spread',
    name: 'Espaçado',
    description: 'Máximo espaçamento entre controles',
    joystickSide: 'left',
    buttonSide: 'right',
    buttonScale: 1.1,
    buttonOpacity: 1.0,
    compact: false,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Controles translúcidos para melhor visão do jogo',
    joystickSide: 'left',
    buttonSide: 'right',
    buttonScale: 0.9,
    buttonOpacity: 0.7,
    compact: false,
  },
};

const STORAGE_KEY = 'control-layout-preset';

export const ControlLayoutProvider = ({ children }) => {
  const [currentPreset, setCurrentPreset] = useState(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LAYOUT_PRESETS[saved]) {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 'default';
  });

  const [customSettings, setCustomSettings] = useState({
    buttonScale: 1.0,
    buttonOpacity: 1.0,
  });

  useEffect(() => {
    // Save to localStorage when preset changes
    try {
      localStorage.setItem(STORAGE_KEY, currentPreset);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [currentPreset]);

  const applyPreset = (presetId) => {
    if (LAYOUT_PRESETS[presetId]) {
      setCurrentPreset(presetId);
      const preset = LAYOUT_PRESETS[presetId];
      setCustomSettings({
        buttonScale: preset.buttonScale,
        buttonOpacity: preset.buttonOpacity,
      });
    }
  };

  const updateCustomSetting = (key, value) => {
    setCustomSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const getCurrentLayout = () => {
    const preset = LAYOUT_PRESETS[currentPreset];
    return {
      ...preset,
      ...customSettings,
    };
  };

  const exportLayout = () => {
    const layout = getCurrentLayout();
    const exportData = {
      preset: currentPreset,
      custom: customSettings,
      version: 1,
    };
    return btoa(JSON.stringify(exportData));
  };

  const importLayout = (code) => {
    try {
      const data = JSON.parse(atob(code));
      if (data.version === 1 && LAYOUT_PRESETS[data.preset]) {
        setCurrentPreset(data.preset);
        setCustomSettings(data.custom);
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const resetToDefault = () => {
    applyPreset('default');
  };

  const value = {
    currentPreset,
    presets: LAYOUT_PRESETS,
    customSettings,
    applyPreset,
    updateCustomSetting,
    getCurrentLayout,
    exportLayout,
    importLayout,
    resetToDefault,
  };

  return (
    <ControlLayoutContext.Provider value={value}>
      {children}
    </ControlLayoutContext.Provider>
  );
};

export const useControlLayout = () => {
  const context = useContext(ControlLayoutContext);
  if (!context) {
    throw new Error('useControlLayout must be used within ControlLayoutProvider');
  }
  return context;
};

export default ControlLayoutContext;
