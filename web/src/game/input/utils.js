export const DEFAULT_JOYSTICK_STATE = Object.freeze({
  x: 0,
  y: 0,
  active: false,
  source: 'none'
});

export const JOYSTICK_MAX_DISTANCE = 50;

export const computeJoystickFromKeys = (keys) => {
  const x = (keys?.right ? 1 : 0) - (keys?.left ? 1 : 0);
  const y = (keys?.down ? 1 : 0) - (keys?.up ? 1 : 0);

  if (x === 0 && y === 0) {
    return { ...DEFAULT_JOYSTICK_STATE };
  }

  const length = Math.hypot(x, y) || 1;

  return {
    x: x / length,
    y: y / length,
    active: true,
    source: 'keyboard'
  };
};

export const updateJoystickPosition = (
  touchX,
  touchY,
  centerX,
  centerY,
  maxDistance = JOYSTICK_MAX_DISTANCE
) => {
  const dx = touchX - centerX;
  const dy = touchY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  let x = dx;
  let y = dy;

  if (distance > maxDistance) {
    x = (dx / distance) * maxDistance;
    y = (dy / distance) * maxDistance;
  }

  return {
    position: { x, y },
    joystick: {
      x: x / maxDistance,
      y: y / maxDistance,
      active: true,
      source: 'touch'
    }
  };
};
