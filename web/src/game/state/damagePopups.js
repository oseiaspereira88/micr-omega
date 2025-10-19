const DEFAULT_LIFETIME_SECONDS = 1;
const MIN_LIFETIME_SECONDS = 0.25;

let popupCounter = 0;

const resolveLifetime = (lifetime) => {
  if (!Number.isFinite(lifetime)) {
    return DEFAULT_LIFETIME_SECONDS;
  }
  return Math.max(MIN_LIFETIME_SECONDS, lifetime);
};

const generatePopupId = () => {
  popupCounter += 1;
  const timePart = Date.now().toString(36);
  return `dmg-${timePart}-${popupCounter.toString(36)}`;
};

const ensureCollection = (state) => {
  if (!state) {
    return [];
  }

  if (!Array.isArray(state.damagePopups)) {
    state.damagePopups = [];
  }

  return state.damagePopups;
};

export const createDamagePopup = ({
  x = 0,
  y = 0,
  value = 0,
  variant = 'normal',
  lifetime = DEFAULT_LIFETIME_SECONDS,
} = {}) => {
  const resolvedLifetime = resolveLifetime(lifetime);
  const createdAt = Date.now();
  const positionX = Number.isFinite(x) ? x : 0;
  const positionY = Number.isFinite(y) ? y : 0;

  return {
    id: generatePopupId(),
    x: positionX,
    y: positionY,
    position: {
      x: positionX,
      y: positionY,
    },
    value: Number.isFinite(value) ? Math.round(value) : 0,
    variant: typeof variant === 'string' && variant ? variant : 'normal',
    lifetime: resolvedLifetime,
    createdAt,
    expiresAt: createdAt + resolvedLifetime * 1000,
  };
};

export const pushDamagePopup = (state, payload = {}) => {
  if (!state) return null;

  const collection = ensureCollection(state);
  pruneDamagePopups(state);

  const popup = createDamagePopup(payload);
  collection.push(popup);
  return popup;
};

export const pruneDamagePopups = (state, now = Date.now()) => {
  if (!state || !Array.isArray(state.damagePopups)) {
    return;
  }

  state.damagePopups = state.damagePopups.filter((popup) => {
    if (!popup || typeof popup !== 'object') {
      return false;
    }

    const lifetime = resolveLifetime(popup.lifetime);
    const createdAt = Number.isFinite(popup.createdAt) ? popup.createdAt : now;
    const expiresAt = Number.isFinite(popup.expiresAt)
      ? Math.max(popup.expiresAt, createdAt)
      : createdAt + lifetime * 1000;

    if (!Number.isFinite(popup.expiresAt)) {
      popup.expiresAt = expiresAt;
    }

    if (!popup.position || typeof popup.position !== 'object') {
      popup.position = {
        x: Number.isFinite(popup.x) ? popup.x : 0,
        y: Number.isFinite(popup.y) ? popup.y : 0,
      };
    }

    return expiresAt > now;
  });
};

export const DEFAULT_DAMAGE_POPUP_LIFETIME = DEFAULT_LIFETIME_SECONDS;
