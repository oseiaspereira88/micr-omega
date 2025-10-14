export const applyCameraTransform = (ctx, camera) => {
  if (!ctx || !camera) return;

  const zoom = camera.zoom ?? 1;
  if (zoom === 1) return;

  const viewport = camera.viewport || {};
  const width = viewport.width ?? ctx.canvas?.width ?? 0;
  const height = viewport.height ?? ctx.canvas?.height ?? 0;

  if (width === 0 || height === 0) return;

  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-width / 2, -height / 2);
};

export const withCameraTransform = (ctx, camera, renderFn) => {
  if (!ctx || typeof renderFn !== 'function') return;

  ctx.save();
  applyCameraTransform(ctx, camera);
  renderFn();
  ctx.restore();
};

export const getCameraViewMetrics = (camera) => {
  const zoom = camera?.zoom ?? 1;
  const viewport = camera?.viewport || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;

  const halfWidth = width > 0 ? width / zoom / 2 : 0;
  const halfHeight = height > 0 ? height / zoom / 2 : 0;

  return {
    zoom,
    width,
    height,
    halfWidth,
    halfHeight,
    centerX: camera?.x ?? 0,
    centerY: camera?.y ?? 0,
  };
};
