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
import {
  DEFAULT_JOYSTICK_SENSITIVITY,
  DEFAULT_TOUCH_CONTROL_SCALE,
  clampJoystickSensitivity,
  clampTouchControlScale,
} from "../config/touchControls";

export type VisualDensity = "low" | "medium" | "high";

export type TouchLayout = "right" | "left";

export type GameSettings = {
  audioEnabled: boolean;
  masterVolume: number;
  visualDensity: VisualDensity;
  showTouchControls: boolean;
  showMinimap: boolean;
  touchLayout: TouchLayout;
  autoSwapTouchLayoutWhenSidebarOpen: boolean;
  touchControlScale: number;
  joystickSensitivity: number;
};

const DEFAULT_SETTINGS: GameSettings = {
  audioEnabled: true,
  masterVolume: 1,
  visualDensity: "medium",
  showTouchControls: false,
  showMinimap: featureToggles.minimap,
  touchLayout: "right",
  autoSwapTouchLayoutWhenSidebarOpen: true,
  touchControlScale: DEFAULT_TOUCH_CONTROL_SCALE,
  joystickSensitivity: DEFAULT_JOYSTICK_SENSITIVITY,
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

const parseTouchLayout = (value: unknown, fallback: TouchLayout): TouchLayout => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "right" || normalized === "left") {
    return normalized;
  }

  return fallback;
};

const clampVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const parseMasterVolume = (value: unknown, fallback: number): number => {
  if (typeof value === "number") {
    return clampVolume(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return clampVolume(parsed);
    }
  }

  return clampVolume(fallback);
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

    const masterVolume = parseMasterVolume(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume);

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

    const touchLayout = parseTouchLayout(
      parsed.touchLayout,
      DEFAULT_SETTINGS.touchLayout,
    );

    const autoSwapTouchLayoutWhenSidebarOpen = parseBoolean(
      parsed.autoSwapTouchLayoutWhenSidebarOpen,
      DEFAULT_SETTINGS.autoSwapTouchLayoutWhenSidebarOpen,
    );

    const touchControlScale = clampTouchControlScale(
      parsed.touchControlScale,
      DEFAULT_SETTINGS.touchControlScale,
    );

    const joystickSensitivity = clampJoystickSensitivity(
      parsed.joystickSensitivity,
      DEFAULT_SETTINGS.joystickSensitivity,
    );

    return {
      audioEnabled,
      masterVolume,
      visualDensity,
      showTouchControls,
      showMinimap,
      touchLayout,
      autoSwapTouchLayoutWhenSidebarOpen,
      touchControlScale,
      joystickSensitivity,
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
    setSettings((prev) => {
      const normalizedNext: Partial<GameSettings> = { ...next };

      if ("masterVolume" in normalizedNext && typeof normalizedNext.masterVolume === "number") {
        normalizedNext.masterVolume = clampVolume(normalizedNext.masterVolume);
      }

      if ("touchControlScale" in normalizedNext) {
        normalizedNext.touchControlScale = clampTouchControlScale(
          normalizedNext.touchControlScale,
          prev.touchControlScale,
        );
      }

      if ("joystickSensitivity" in normalizedNext) {
        normalizedNext.joystickSensitivity = clampJoystickSensitivity(
          normalizedNext.joystickSensitivity,
          prev.joystickSensitivity,
        );
      }

      return {
        ...prev,
        ...normalizedNext,
      };
    });
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
