import { useCallback, useRef, useEffect } from 'react';

/**
 * Haptic Feedback Hook
 * Provides vibration feedback for touch interactions on mobile devices
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether haptic feedback is enabled
 * @param {number} options.intensity - Intensity multiplier (0.5-1.5)
 * @returns {Object} Haptic feedback functions
 */
const useHapticFeedback = ({ enabled = true, intensity = 1.0 } = {}) => {
  const lastVibrateTime = useRef(0);
  const vibrateCount = useRef(0);
  const resetCountTimer = useRef(null);

  // Feature detection
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resetCountTimer.current) {
        clearTimeout(resetCountTimer.current);
      }
    };
  }, []);

  /**
   * Core vibrate function with debouncing and rate limiting
   * @param {number|number[]} pattern - Vibration pattern (ms or array)
   * @param {number} minInterval - Minimum ms between vibrations
   */
  const vibrate = useCallback(
    (pattern, minInterval = 50) => {
      if (!isSupported || !enabled) {
        return false;
      }

      const now = Date.now();
      const timeSinceLastVibrate = now - lastVibrateTime.current;

      // Debounce: prevent too frequent vibrations
      if (timeSinceLastVibrate < minInterval) {
        return false;
      }

      // Rate limiting: max 10 vibrations per second
      vibrateCount.current += 1;
      if (vibrateCount.current > 10) {
        return false;
      }

      // Reset counter after 1 second
      if (resetCountTimer.current) {
        clearTimeout(resetCountTimer.current);
      }
      resetCountTimer.current = setTimeout(() => {
        vibrateCount.current = 0;
      }, 1000);

      // Apply intensity scaling
      const clampedIntensity = Math.max(0.5, Math.min(1.5, intensity));
      let scaledPattern;

      if (Array.isArray(pattern)) {
        // Scale array pattern (vibrate, pause, vibrate, ...)
        scaledPattern = pattern.map((value, index) => {
          // Only scale vibrate durations (even indices), not pauses
          return index % 2 === 0
            ? Math.round(value * clampedIntensity)
            : value;
        });
      } else {
        scaledPattern = Math.round(pattern * clampedIntensity);
      }

      lastVibrateTime.current = now;

      try {
        return navigator.vibrate(scaledPattern);
      } catch (error) {
        console.warn('[HapticFeedback] Vibration failed:', error);
        return false;
      }
    },
    [enabled, intensity, isSupported]
  );

  // Haptic patterns as defined in the plan
  const patterns = {
    // Light tap (10ms): Button press, menu navigation
    light: useCallback(() => vibrate(10, 30), [vibrate]),

    // Medium tap (25ms): Attack hit, collectible pickup
    medium: useCallback(() => vibrate(25, 50), [vibrate]),

    // Heavy tap (50ms): Dash activation, skill cast
    heavy: useCallback(() => vibrate(50, 80), [vibrate]),

    // Success pattern [10, 50, 10]: Level up, evolution
    success: useCallback(() => vibrate([10, 50, 10], 200), [vibrate]),

    // Warning pattern [30, 30, 30]: Low HP, boss enrage
    warning: useCallback(() => vibrate([30, 30, 30, 30, 30], 300), [vibrate]),

    // Error pattern [100]: Invalid action, not enough energy
    error: useCallback(() => vibrate(100, 150), [vibrate]),

    // Impact pattern (for damage taken)
    impact: useCallback(() => vibrate([15, 20, 30], 100), [vibrate]),

    // Charge pattern (for charging attacks)
    charge: useCallback(() => vibrate([5, 10, 15], 50), [vibrate]),
  };

  /**
   * Stop any ongoing vibration
   */
  const stop = useCallback(() => {
    if (isSupported) {
      try {
        navigator.vibrate(0);
      } catch (error) {
        console.warn('[HapticFeedback] Stop vibration failed:', error);
      }
    }
  }, [isSupported]);

  return {
    isSupported,
    enabled,
    intensity,
    vibrate,
    stop,
    ...patterns,
  };
};

export default useHapticFeedback;
