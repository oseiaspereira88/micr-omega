/**
 * Device Performance Detection
 * Detects device performance tier to optimize visual effects
 */

/**
 * Performance tiers
 */
export const PERFORMANCE_TIER = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Detect device performance tier
 * @returns {string} Performance tier (high, medium, low)
 */
export const detectPerformanceTier = () => {
  if (typeof window === 'undefined') {
    return PERFORMANCE_TIER.MEDIUM;
  }

  const nav = window.navigator;
  let score = 0;

  // Check hardware concurrency (CPU cores)
  const cores = nav.hardwareConcurrency || 2;
  if (cores >= 8) score += 3;
  else if (cores >= 4) score += 2;
  else score += 1;

  // Check device memory (GB)
  const memory = nav.deviceMemory || 4;
  if (memory >= 8) score += 3;
  else if (memory >= 4) score += 2;
  else score += 1;

  // Check connection type (for mobile detection)
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g') score += 2;
    else if (effectiveType === '3g') score += 1;
    else if (effectiveType === '2g' || effectiveType === 'slow-2g') score -= 1;
  }

  // Check if mobile/tablet (generally lower performance)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    nav.userAgent
  );
  if (isMobile) {
    score -= 1;
  }

  // Check for low power mode (Safari on iOS/macOS)
  if (nav.getBattery) {
    nav.getBattery().then(battery => {
      if (battery.charging === false && battery.level < 0.2) {
        // Low battery, reduce performance tier
        const currentTier = getStoredPerformanceTier();
        if (currentTier === PERFORMANCE_TIER.HIGH) {
          storePerformanceTier(PERFORMANCE_TIER.MEDIUM);
        } else if (currentTier === PERFORMANCE_TIER.MEDIUM) {
          storePerformanceTier(PERFORMANCE_TIER.LOW);
        }
      }
    }).catch(() => {
      // Battery API not available, ignore
    });
  }

  // Calculate tier based on score
  let tier;
  if (score >= 6) {
    tier = PERFORMANCE_TIER.HIGH;
  } else if (score >= 3) {
    tier = PERFORMANCE_TIER.MEDIUM;
  } else {
    tier = PERFORMANCE_TIER.LOW;
  }

  // Store in localStorage for persistence
  storePerformanceTier(tier);

  return tier;
};

/**
 * Store performance tier in localStorage
 * @param {string} tier
 */
const storePerformanceTier = (tier) => {
  try {
    localStorage.setItem('devicePerformanceTier', tier);
  } catch (error) {
    console.warn('[DevicePerformance] Failed to store tier:', error);
  }
};

/**
 * Get stored performance tier from localStorage
 * @returns {string|null}
 */
const getStoredPerformanceTier = () => {
  try {
    return localStorage.getItem('devicePerformanceTier');
  } catch (error) {
    return null;
  }
};

/**
 * Get current performance tier (from storage or detect)
 * @returns {string}
 */
export const getPerformanceTier = () => {
  const stored = getStoredPerformanceTier();
  if (stored && Object.values(PERFORMANCE_TIER).includes(stored)) {
    return stored;
  }
  return detectPerformanceTier();
};

/**
 * Get backdrop filter value based on performance tier
 * @param {number} defaultBlur - Default blur value in px
 * @returns {string} CSS backdrop-filter value
 */
export const getBackdropFilter = (defaultBlur = 22) => {
  const tier = getPerformanceTier();

  switch (tier) {
    case PERFORMANCE_TIER.HIGH:
      return `blur(${defaultBlur}px)`;
    case PERFORMANCE_TIER.MEDIUM:
      return `blur(${Math.round(defaultBlur * 0.5)}px)`;
    case PERFORMANCE_TIER.LOW:
      return 'none';
    default:
      return `blur(${defaultBlur}px)`;
  }
};

/**
 * Check if backdrop filter should be used
 * @returns {boolean}
 */
export const shouldUseBackdropFilter = () => {
  const tier = getPerformanceTier();
  return tier !== PERFORMANCE_TIER.LOW;
};

/**
 * Get performance-adjusted CSS custom properties
 * @returns {Object} CSS custom properties
 */
export const getPerformanceStyles = () => {
  const tier = getPerformanceTier();

  const styles = {
    '--perf-tier': tier,
  };

  switch (tier) {
    case PERFORMANCE_TIER.HIGH:
      styles['--backdrop-blur'] = '22px';
      styles['--shadow-blur'] = '32px';
      styles['--particle-count'] = '1';
      break;
    case PERFORMANCE_TIER.MEDIUM:
      styles['--backdrop-blur'] = '12px';
      styles['--shadow-blur'] = '20px';
      styles['--particle-count'] = '0.5';
      break;
    case PERFORMANCE_TIER.LOW:
      styles['--backdrop-blur'] = '0px';
      styles['--shadow-blur'] = '12px';
      styles['--particle-count'] = '0.25';
      break;
    default:
      styles['--backdrop-blur'] = '22px';
      styles['--shadow-blur'] = '32px';
      styles['--particle-count'] = '1';
  }

  return styles;
};

/**
 * Manually set performance tier (for user override)
 * @param {string} tier
 */
export const setPerformanceTier = (tier) => {
  if (Object.values(PERFORMANCE_TIER).includes(tier)) {
    storePerformanceTier(tier);
    // Dispatch custom event for reactive updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performanceTierChanged', { detail: { tier } }));
    }
  }
};
