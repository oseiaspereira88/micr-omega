/**
 * PERF-003: Particle Effect Optimization
 * Object pooling system for particles to reduce GC pressure and improve performance
 */

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 1;
    this.color = '#ffffff';
    this.alpha = 1;
    this.life = 0;
    this.maxLife = 1;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.active = false;
    this.type = 'default';
  }

  update(deltaTime) {
    if (!this.active) return;

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Update life
    this.life += deltaTime;

    // Update alpha based on life
    const lifeRatio = this.life / this.maxLife;
    this.alpha = 1 - lifeRatio;

    // Update rotation
    this.rotation += this.rotationSpeed * deltaTime;

    // Deactivate if life exceeded
    if (this.life >= this.maxLife) {
      this.active = false;
    }
  }

  render(ctx) {
    if (!this.active || this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);

    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }

    // Render based on type
    switch (this.type) {
      case 'circle':
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'square':
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        break;

      case 'triangle':
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, this.size);
        ctx.lineTo(-this.size, this.size);
        ctx.closePath();
        ctx.fill();
        break;

      case 'star':
        this.renderStar(ctx);
        break;

      default:
        // Default to circle
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }

  renderStar(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = this.size;
    const innerRadius = this.size / 2;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();
  }
}

class ParticlePool {
  constructor(initialSize = 500, maxSize = 2000) {
    this.pool = [];
    this.activeParticles = [];
    this.initialSize = initialSize;
    this.maxSize = maxSize;

    // Pre-allocate initial pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Particle());
    }

    // Performance tier (can be adjusted based on device)
    this.performanceTier = 'high'; // 'high', 'medium', 'low'
    this.particleCountMultiplier = 1.0;

    // Stats for monitoring
    this.stats = {
      totalCreated: initialSize,
      activeCount: 0,
      poolSize: initialSize,
      reused: 0,
      created: 0,
    };
  }

  /**
   * Get a particle from the pool or create a new one
   */
  acquire() {
    let particle;

    if (this.pool.length > 0) {
      particle = this.pool.pop();
      this.stats.reused++;
    } else if (this.stats.totalCreated < this.maxSize) {
      particle = new Particle();
      this.stats.totalCreated++;
      this.stats.created++;
    } else {
      // Pool exhausted, reuse oldest active particle
      particle = this.activeParticles.shift();
      if (particle) {
        particle.reset();
      } else {
        // Fallback: create new particle despite max limit
        particle = new Particle();
      }
    }

    this.activeParticles.push(particle);
    this.stats.activeCount = this.activeParticles.length;

    return particle;
  }

  /**
   * Return a particle to the pool
   */
  release(particle) {
    particle.reset();

    const index = this.activeParticles.indexOf(particle);
    if (index > -1) {
      this.activeParticles.splice(index, 1);
    }

    this.pool.push(particle);
    this.stats.activeCount = this.activeParticles.length;
    this.stats.poolSize = this.pool.length;
  }

  /**
   * Spawn a particle with configuration
   */
  spawn(config) {
    // Apply performance multiplier
    if (Math.random() > this.particleCountMultiplier) {
      return null; // Skip spawning based on performance tier
    }

    const particle = this.acquire();

    if (!particle) return null;

    // Apply configuration
    particle.x = config.x || 0;
    particle.y = config.y || 0;
    particle.vx = config.vx || 0;
    particle.vy = config.vy || 0;
    particle.size = config.size || 2;
    particle.color = config.color || '#ffffff';
    particle.alpha = config.alpha !== undefined ? config.alpha : 1;
    particle.maxLife = config.maxLife || 1000; // ms
    particle.life = 0;
    particle.rotation = config.rotation || 0;
    particle.rotationSpeed = config.rotationSpeed || 0;
    particle.type = config.type || 'circle';
    particle.active = true;

    return particle;
  }

  /**
   * Spawn multiple particles (particle burst)
   */
  spawnBurst(config, count) {
    const particles = [];

    // Adjust count based on performance tier
    const adjustedCount = Math.floor(count * this.particleCountMultiplier);

    for (let i = 0; i < adjustedCount; i++) {
      const particle = this.spawn(config);
      if (particle) {
        particles.push(particle);
      }
    }

    return particles;
  }

  /**
   * Update all active particles
   */
  update(deltaTime) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const particle = this.activeParticles[i];

      particle.update(deltaTime);

      if (!particle.active) {
        this.release(particle);
      }
    }
  }

  /**
   * Render all active particles
   */
  render(ctx, camera = { x: 0, y: 0, width: 800, height: 600 }) {
    // Frustum culling - only render particles in view
    for (const particle of this.activeParticles) {
      if (!particle.active) continue;

      // Check if particle is in view (with some margin)
      const margin = 50;
      if (
        particle.x >= camera.x - margin &&
        particle.x <= camera.x + camera.width + margin &&
        particle.y >= camera.y - margin &&
        particle.y <= camera.y + camera.height + margin
      ) {
        particle.render(ctx);
      }
    }
  }

  /**
   * Set performance tier
   */
  setPerformanceTier(tier) {
    this.performanceTier = tier;

    switch (tier) {
      case 'high':
        this.particleCountMultiplier = 1.0;
        break;
      case 'medium':
        this.particleCountMultiplier = 0.5;
        break;
      case 'low':
        this.particleCountMultiplier = 0.25;
        break;
      default:
        this.particleCountMultiplier = 1.0;
    }
  }

  /**
   * Clear all active particles
   */
  clear() {
    for (const particle of this.activeParticles) {
      particle.reset();
      this.pool.push(particle);
    }

    this.activeParticles = [];
    this.stats.activeCount = 0;
    this.stats.poolSize = this.pool.length;
  }

  /**
   * Get current stats
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Shrink pool if it's too large
   */
  shrinkPool() {
    if (this.pool.length > this.initialSize * 2) {
      const excess = this.pool.length - this.initialSize;
      this.pool.splice(0, excess);
      this.stats.poolSize = this.pool.length;
    }
  }
}

export default ParticlePool;
