export const TOUCH_CONTROL_SCALE_MIN = 0.75;
export const TOUCH_CONTROL_SCALE_MAX = 1.5;
export const DEFAULT_TOUCH_CONTROL_SCALE = 1;

export const JOYSTICK_SENSITIVITY_MIN = 0.5;
export const JOYSTICK_SENSITIVITY_MAX = 1.5;
export const DEFAULT_JOYSTICK_SENSITIVITY = 1;

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const clampTouchControlScale = (
  value: unknown,
  fallback: number = DEFAULT_TOUCH_CONTROL_SCALE,
): number => {
  const numeric = coerceNumber(value);
  const base = Number.isFinite(numeric ?? NaN) ? (numeric as number) : fallback;
  return clamp(base, TOUCH_CONTROL_SCALE_MIN, TOUCH_CONTROL_SCALE_MAX);
};

export const clampJoystickSensitivity = (
  value: unknown,
  fallback: number = DEFAULT_JOYSTICK_SENSITIVITY,
): number => {
  const numeric = coerceNumber(value);
  const base = Number.isFinite(numeric ?? NaN) ? (numeric as number) : fallback;
  return clamp(base, JOYSTICK_SENSITIVITY_MIN, JOYSTICK_SENSITIVITY_MAX);
};
