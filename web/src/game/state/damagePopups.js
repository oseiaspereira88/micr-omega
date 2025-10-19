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
} = {}) => ({
  id: generatePopupId(),
  x: Number.isFinite(x) ? x : 0,
  y: Number.isFinite(y) ? y : 0,
  value: Number.isFinite(value) ? Math.round(value) : 0,
  variant: typeof variant === 'string' && variant ? variant : 'normal',
  lifetime: resolveLifetime(lifetime),
  createdAt: Date.now(),
});

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
    return createdAt + lifetime * 1000 > now;
  });
};

export const DEFAULT_DAMAGE_POPUP_LIFETIME = DEFAULT_LIFETIME_SECONDS;
