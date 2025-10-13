const parseBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }

  return defaultValue;
};

export const featureToggles = Object.freeze({
  minimap: parseBooleanFlag(import.meta.env.VITE_FEATURE_MINIMAP, false),
});
