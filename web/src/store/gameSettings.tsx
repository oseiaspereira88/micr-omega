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

export type TouchLayout = "right" | "left";

export type GameSettings = {
  audioEnabled: boolean;
  masterVolume: number;
  visualDensity: VisualDensity;
  showTouchControls: boolean;
  showMinimap: boolean;
  touchLayout: TouchLayout;
  autoSwapTouchLayoutWhenSidebarOpen: boolean;
  cameraZoom: number;
  touchControlScale: number;
  joystickSensitivity: number;
};

export const TOUCH_CONTROL_SCALE_MIN = 0.6;
export const TOUCH_CONTROL_SCALE_MAX = 1.6;
export const TOUCH_CONTROL_SCALE_STEP = 0.05;
export const JOYSTICK_SENSITIVITY_MIN = 0.5;
export const JOYSTICK_SENSITIVITY_MAX = 1.5;
export const JOYSTICK_SENSITIVITY_STEP = 0.05;

const DEFAULT_SETTINGS: GameSettings = {
  audioEnabled: true,
  masterVolume: 1,
  visualDensity: "medium",
  showTouchControls: false,
  showMinimap: featureToggles.minimap,
  touchLayout: "right",
  autoSwapTouchLayoutWhenSidebarOpen: true,
  cameraZoom: 1,
  touchControlScale: 1,
  joystickSensitivity: 1,
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

const clampCameraZoom = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value < 0.6) {
    return 0.6;
  }

  if (value > 1.2) {
    return 1.2;
  }

  return value;
};

const parseCameraZoom = (value: unknown, fallback: number): number => {
  if (typeof value === "number") {
    return clampCameraZoom(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return clampCameraZoom(parsed);
    }
  }

  return clampCameraZoom(fallback);
};

export const clampTouchControlScale = (value: unknown): number => {
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  if (numericValue < TOUCH_CONTROL_SCALE_MIN) {
    return TOUCH_CONTROL_SCALE_MIN;
  }

  if (numericValue > TOUCH_CONTROL_SCALE_MAX) {
    return TOUCH_CONTROL_SCALE_MAX;
  }

  return Number(numericValue);
};

export const clampJoystickSensitivity = (value: unknown): number => {
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  if (numericValue < JOYSTICK_SENSITIVITY_MIN) {
    return JOYSTICK_SENSITIVITY_MIN;
  }

  if (numericValue > JOYSTICK_SENSITIVITY_MAX) {
    return JOYSTICK_SENSITIVITY_MAX;
  }

  return Number(numericValue);
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

    const cameraZoom = parseCameraZoom(parsed.cameraZoom, DEFAULT_SETTINGS.cameraZoom);

    const touchControlScale = clampTouchControlScale(
      parsed.touchControlScale ?? DEFAULT_SETTINGS.touchControlScale,
    );

    const joystickSensitivity = clampJoystickSensitivity(
      parsed.joystickSensitivity ?? DEFAULT_SETTINGS.joystickSensitivity,
    );

    return {
      audioEnabled,
      masterVolume,
      visualDensity,
      showTouchControls,
      showMinimap,
      touchLayout,
      autoSwapTouchLayoutWhenSidebarOpen,
      cameraZoom,
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
      const merged: GameSettings = {
        ...prev,
        ...next,
      };

      if ("masterVolume" in next) {
        merged.masterVolume = clampVolume(merged.masterVolume);
      }

      if ("cameraZoom" in next) {
        merged.cameraZoom = clampCameraZoom(merged.cameraZoom);
      }

      if ("touchControlScale" in next) {
        merged.touchControlScale = clampTouchControlScale(next.touchControlScale);
      }

      if ("joystickSensitivity" in next) {
        merged.joystickSensitivity = clampJoystickSensitivity(next.joystickSensitivity);
      }

      return merged;
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
