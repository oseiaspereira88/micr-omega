const isFiniteNumber = (value) => Number.isFinite(value) ? value : null;

export const extractPosition = (entity) => {
  if (!entity || typeof entity !== 'object') {
    return null;
  }

  const directX = isFiniteNumber(entity.x);
  const directY = isFiniteNumber(entity.y);

  if (directX !== null && directY !== null) {
    return { x: directX, y: directY };
  }

  const nestedX = isFiniteNumber(entity.position?.x);
  const nestedY = isFiniteNumber(entity.position?.y);

  if (nestedX !== null && nestedY !== null) {
    return { x: nestedX, y: nestedY };
  }

  return null;
};

const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const findNearestHostileMicroorganismId = ({
  playerPosition,
  renderMicroorganisms,
  sharedMicroorganisms,
} = {}) => {
  if (!playerPosition || !Number.isFinite(playerPosition.x) || !Number.isFinite(playerPosition.y)) {
    return null;
  }

  const candidateLists = [];

  if (Array.isArray(renderMicroorganisms) && renderMicroorganisms.length > 0) {
    candidateLists.push(renderMicroorganisms);
  }

  if (Array.isArray(sharedMicroorganisms) && sharedMicroorganisms.length > 0) {
    candidateLists.push(sharedMicroorganisms);
  }

  if (candidateLists.length === 0) {
    return null;
  }

  const origin = { x: Number(playerPosition.x), y: Number(playerPosition.y) };
  let nearestId = null;
  let nearestDistance = Infinity;
  const evaluated = new Set();

  for (const list of candidateLists) {
    for (const entity of list) {
      const id = typeof entity?.id === 'string' && entity.id ? entity.id : null;
      if (!id || evaluated.has(id)) {
        continue;
      }

      const position = extractPosition(entity);
      if (!position) {
        continue;
      }

      evaluated.add(id);

      const distance = dist2(origin, position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = id;
      }
    }
  }

  return nearestId;
};

export const resolvePlayerPosition = ({ renderPlayer, sharedPlayer } = {}) => {
  const renderSources = [renderPlayer?.renderPosition, renderPlayer?.position, renderPlayer];
  for (const source of renderSources) {
    const position = extractPosition(source);
    if (position) {
      return position;
    }
  }

  const sharedSources = [sharedPlayer?.position, sharedPlayer];
  for (const source of sharedSources) {
    const position = extractPosition(source);
    if (position) {
      return position;
    }
  }

  return null;
};

export default findNearestHostileMicroorganismId;
