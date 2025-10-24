/**
 * PERF-004: Canvas Rendering Optimizations
 * Collection of utilities for optimizing canvas rendering
 */

/**
 * Batch Renderer
 * Groups similar draw calls to minimize context state changes
 */
class BatchRenderer {
  constructor() {
    this.batches = new Map();
    this.currentBatch = null;
  }

  /**
   * Start a new batch
   */
  beginBatch(type, style) {
    const key = `${type}_${style}`;

    if (!this.batches.has(key)) {
      this.batches.set(key, {
        type,
        style,
        items: [],
      });
    }

    this.currentBatch = this.batches.get(key);
  }

  /**
   * Add item to current batch
   */
  add(item) {
    if (this.currentBatch) {
      this.currentBatch.items.push(item);
    }
  }

  /**
   * Render all batches
   */
  render(ctx) {
    for (const batch of this.batches.values()) {
      if (batch.items.length === 0) continue;

      // Set style once for entire batch
      this.applyStyle(ctx, batch.type, batch.style);

      // Render all items in batch
      for (const item of batch.items) {
        this.renderItem(ctx, batch.type, item);
      }

      batch.items = []; // Clear batch
    }
  }

  /**
   * Apply style to context
   */
  applyStyle(ctx, type, style) {
    switch (type) {
      case 'fill':
        ctx.fillStyle = style;
        break;
      case 'stroke':
        ctx.strokeStyle = style;
        break;
      case 'text':
        ctx.fillStyle = style.color || '#ffffff';
        ctx.font = style.font || '12px sans-serif';
        ctx.textAlign = style.align || 'left';
        ctx.textBaseline = style.baseline || 'top';
        break;
    }
  }

  /**
   * Render a single item
   */
  renderItem(ctx, type, item) {
    switch (item.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        if (type === 'fill') ctx.fill();
        else if (type === 'stroke') ctx.stroke();
        break;

      case 'rect':
        if (type === 'fill') {
          ctx.fillRect(item.x, item.y, item.width, item.height);
        } else if (type === 'stroke') {
          ctx.strokeRect(item.x, item.y, item.width, item.height);
        }
        break;

      case 'text':
        ctx.fillText(item.text, item.x, item.y);
        break;

      case 'path':
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        if (item.closePath) ctx.closePath();
        if (type === 'fill') ctx.fill();
        else if (type === 'stroke') ctx.stroke();
        break;
    }
  }

  /**
   * Clear all batches
   */
  clear() {
    this.batches.clear();
    this.currentBatch = null;
  }
}

/**
 * Viewport Culler
 * Determines if objects are visible in the current viewport
 */
class ViewportCuller {
  constructor() {
    this.viewport = { x: 0, y: 0, width: 800, height: 600 };
    this.margin = 50; // Extra margin for smooth entry/exit
  }

  /**
   * Set viewport bounds
   */
  setViewport(x, y, width, height, margin = 50) {
    this.viewport = { x, y, width, height };
    this.margin = margin;
  }

  /**
   * Check if a point is visible
   */
  isPointVisible(x, y) {
    return (
      x >= this.viewport.x - this.margin &&
      x <= this.viewport.x + this.viewport.width + this.margin &&
      y >= this.viewport.y - this.margin &&
      y <= this.viewport.y + this.viewport.height + this.margin
    );
  }

  /**
   * Check if a rectangle is visible
   */
  isRectVisible(x, y, width, height) {
    return (
      x + width >= this.viewport.x - this.margin &&
      x <= this.viewport.x + this.viewport.width + this.margin &&
      y + height >= this.viewport.y - this.margin &&
      y <= this.viewport.y + this.viewport.height + this.margin
    );
  }

  /**
   * Check if a circle is visible
   */
  isCircleVisible(x, y, radius) {
    return this.isRectVisible(x - radius, y - radius, radius * 2, radius * 2);
  }

  /**
   * Get visible objects from a list
   */
  filterVisible(objects, getPosition) {
    return objects.filter(obj => {
      const pos = getPosition(obj);
      return this.isPointVisible(pos.x, pos.y);
    });
  }
}

/**
 * Frame Timer
 * Helps measure rendering performance
 */
class FrameTimer {
  constructor() {
    this.frames = [];
    this.maxFrames = 60;
    this.lastTime = performance.now();
  }

  /**
   * Mark start of frame
   */
  begin() {
    this.startTime = performance.now();
  }

  /**
   * Mark end of frame and record time
   */
  end() {
    const endTime = performance.now();
    const frameTime = endTime - this.startTime;
    const deltaTime = endTime - this.lastTime;

    this.frames.push({ frameTime, deltaTime, timestamp: endTime });

    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }

    this.lastTime = endTime;

    return { frameTime, deltaTime };
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime() {
    if (this.frames.length === 0) return 0;

    const sum = this.frames.reduce((acc, f) => acc + f.frameTime, 0);
    return sum / this.frames.length;
  }

  /**
   * Get current FPS
   */
  getFPS() {
    if (this.frames.length === 0) return 0;

    const avgDelta = this.frames.reduce((acc, f) => acc + f.deltaTime, 0) / this.frames.length;
    return 1000 / avgDelta;
  }

  /**
   * Get stats
   */
  getStats() {
    const avgFrameTime = this.getAverageFrameTime();
    const fps = this.getFPS();

    return {
      fps: Math.round(fps),
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      frameCount: this.frames.length,
    };
  }
}

/**
 * Draw Call Counter
 * Tracks number of draw calls for optimization
 */
class DrawCallCounter {
  constructor() {
    this.reset();
  }

  reset() {
    this.counts = {
      total: 0,
      circles: 0,
      rects: 0,
      lines: 0,
      text: 0,
      images: 0,
      paths: 0,
    };
  }

  increment(type) {
    this.counts.total++;
    if (this.counts[type] !== undefined) {
      this.counts[type]++;
    }
  }

  getCounts() {
    return { ...this.counts };
  }
}

/**
 * Canvas State Manager
 * Minimizes save/restore calls
 */
class CanvasStateManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.stateStack = [];
    this.currentState = this.captureState();
  }

  captureState() {
    return {
      fillStyle: this.ctx.fillStyle,
      strokeStyle: this.ctx.strokeStyle,
      lineWidth: this.ctx.lineWidth,
      globalAlpha: this.ctx.globalAlpha,
      font: this.ctx.font,
      textAlign: this.ctx.textAlign,
      textBaseline: this.ctx.textBaseline,
    };
  }

  /**
   * Save current state only if different
   */
  save() {
    this.stateStack.push({ ...this.currentState });
    this.ctx.save();
  }

  /**
   * Restore previous state
   */
  restore() {
    if (this.stateStack.length > 0) {
      this.currentState = this.stateStack.pop();
      this.ctx.restore();
    }
  }

  /**
   * Apply state only if changed
   */
  applyState(newState) {
    for (const key in newState) {
      if (this.currentState[key] !== newState[key]) {
        this.ctx[key] = newState[key];
        this.currentState[key] = newState[key];
      }
    }
  }
}

export {
  BatchRenderer,
  ViewportCuller,
  FrameTimer,
  DrawCallCounter,
  CanvasStateManager,
};
