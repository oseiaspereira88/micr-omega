/**
 * PERF-004: Layered Canvas Rendering
 * Separates static and dynamic content into different layers to reduce redraws
 */

class LayeredRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.layers = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all canvas layers
   */
  initialize(width, height) {
    if (this.initialized) {
      this.cleanup();
    }

    const layerConfigs = [
      { name: 'background', zIndex: 0, alpha: true },
      { name: 'entities', zIndex: 1, alpha: true },
      { name: 'effects', zIndex: 2, alpha: true },
      { name: 'ui', zIndex: 3, alpha: true },
    ];

    for (const config of layerConfigs) {
      this.createLayer(config.name, width, height, config.zIndex, config.alpha);
    }

    this.initialized = true;
  }

  /**
   * Create a single layer
   */
  createLayer(name, width, height, zIndex = 0, alpha = true) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.zIndex = zIndex.toString();
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d', { alpha });

    // Performance optimizations
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low'; // Faster rendering

    this.layers.set(name, {
      canvas,
      ctx,
      dirty: true,
      zIndex,
    });

    this.container.appendChild(canvas);

    return { canvas, ctx };
  }

  /**
   * Get a specific layer
   */
  getLayer(name) {
    return this.layers.get(name);
  }

  /**
   * Mark a layer as dirty (needs redraw)
   */
  markDirty(layerName) {
    const layer = this.layers.get(layerName);
    if (layer) {
      layer.dirty = true;
    }
  }

  /**
   * Mark all layers as dirty
   */
  markAllDirty() {
    for (const layer of this.layers.values()) {
      layer.dirty = true;
    }
  }

  /**
   * Check if a layer is dirty
   */
  isDirty(layerName) {
    const layer = this.layers.get(layerName);
    return layer ? layer.dirty : false;
  }

  /**
   * Clear a layer
   */
  clearLayer(layerName) {
    const layer = this.layers.get(layerName);
    if (layer) {
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    }
  }

  /**
   * Clear all layers
   */
  clearAll() {
    for (const [name] of this.layers) {
      this.clearLayer(name);
    }
  }

  /**
   * Resize all layers
   */
  resize(width, height) {
    for (const layer of this.layers.values()) {
      layer.canvas.width = width;
      layer.canvas.height = height;
      layer.dirty = true;
    }
  }

  /**
   * Clean up all layers
   */
  cleanup() {
    for (const layer of this.layers.values()) {
      if (layer.canvas.parentNode) {
        layer.canvas.parentNode.removeChild(layer.canvas);
      }
    }

    this.layers.clear();
    this.initialized = false;
  }

  /**
   * Get canvas dimensions
   */
  getDimensions() {
    const firstLayer = this.layers.values().next().value;
    if (!firstLayer) {
      return { width: 0, height: 0 };
    }

    return {
      width: firstLayer.canvas.width,
      height: firstLayer.canvas.height,
    };
  }
}

/**
 * Dirty Rectangle Manager
 * Tracks regions that need redrawing
 */
class DirtyRectManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this.hasDirtyRegion = false;
  }

  /**
   * Add a dirty rectangle
   */
  addRect(x, y, width, height) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x + width);
    this.maxY = Math.max(this.maxY, y + height);
    this.hasDirtyRegion = true;
  }

  /**
   * Add a point with radius
   */
  addPoint(x, y, radius = 10) {
    this.addRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /**
   * Get the dirty rectangle
   */
  getRect() {
    if (!this.hasDirtyRegion) {
      return null;
    }

    return {
      x: Math.floor(this.minX),
      y: Math.floor(this.minY),
      width: Math.ceil(this.maxX - this.minX),
      height: Math.ceil(this.maxY - this.minY),
    };
  }

  /**
   * Check if there's a dirty region
   */
  isDirty() {
    return this.hasDirtyRegion;
  }
}

/**
 * Offscreen Canvas Cache
 * Pre-renders complex shapes for reuse
 */
class OffscreenCanvasCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get or create cached canvas
   */
  get(key, width, height, renderFn) {
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);

      // Check if dimensions match
      if (cached.width === width && cached.height === height) {
        return cached.canvas;
      }

      // Dimensions changed, recreate
      this.invalidate(key);
    }

    // Create new offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Render to offscreen canvas
    renderFn(ctx, width, height);

    this.cache.set(key, { canvas, width, height });

    return canvas;
  }

  /**
   * Invalidate a cached entry
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }
}

export { LayeredRenderer, DirtyRectManager, OffscreenCanvasCache };
export default LayeredRenderer;
