import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { featureToggles } from "../config/featureToggles.js";

export type VisualDensity = "low" | "medium" | "high";

export type GameSettings = {
  audioEnabled: boolean;
  visualDensity: VisualDensity;
  showTouchControls: boolean;
  showMinimap: boolean;
};

const DEFAULT_SETTINGS: GameSettings = {
  audioEnabled: true,
  visualDensity: "medium",
  showTouchControls: false,
  showMinimap: featureToggles.minimap,
};

const STORAGE_KEY = "micr-omega:game-settings";

type GameSettingsContextValue = {
  settings: GameSettings;
  updateSettings: (next: Partial<GameSettings>) => void;
  resetSettings: () => void;
};

const GameSettingsContext = createContext<GameSettingsContextValue | undefined>(
  undefined
);

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
};

const parseVisualDensity = (value: unknown, fallback: VisualDensity): VisualDensity => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return fallback;
};

const parseStoredSettings = (): GameSettings => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<GameSettings> | null;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }

    const audioEnabled = parseBoolean(parsed.audioEnabled, DEFAULT_SETTINGS.audioEnabled);

    const visualDensity = parseVisualDensity(
      parsed.visualDensity,
      DEFAULT_SETTINGS.visualDensity,
    );

    const showTouchControls = parseBoolean(
      parsed.showTouchControls,
      DEFAULT_SETTINGS.showTouchControls,
    );

    const showMinimap = parseBoolean(
      parsed.showMinimap,
      DEFAULT_SETTINGS.showMinimap,
    );

    return {
      audioEnabled,
      visualDensity,
      showTouchControls,
      showMinimap,
    };
  } catch (error) {
    console.warn("Não foi possível ler as configurações do jogo salvas", error);
    return { ...DEFAULT_SETTINGS };
  }
};

export const GameSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<GameSettings>(parseStoredSettings);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Não foi possível persistir as configurações do jogo", error);
    }
  }, [settings]);

  const updateSettings = useCallback((next: Partial<GameSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...next,
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSettings, resetSettings]
  );

  return (
    <GameSettingsContext.Provider value={value}>
      {children}
    </GameSettingsContext.Provider>
  );
};

export const useGameSettings = (): GameSettingsContextValue => {
  const context = useContext(GameSettingsContext);
  if (!context) {
    throw new Error("useGameSettings deve ser usado dentro de GameSettingsProvider");
  }
  return context;
};

export const getDefaultSettings = (): GameSettings => ({ ...DEFAULT_SETTINGS });
