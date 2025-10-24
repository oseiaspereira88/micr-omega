import { useEffect, useState } from 'react';
import {
  getPerformanceTier,
  getPerformanceStyles,
  shouldUseBackdropFilter,
  PERFORMANCE_TIER,
} from '../utils/devicePerformance';

/**
 * Hook to access device performance tier and related utilities
 * @returns {Object} Performance tier and utilities
 */
const useDevicePerformance = () => {
  const [tier, setTier] = useState(() => getPerformanceTier());
  const [styles, setStyles] = useState(() => getPerformanceStyles());

  useEffect(() => {
    // Listen for manual tier changes
    const handleTierChange = (event) => {
      setTier(event.detail.tier);
      setStyles(getPerformanceStyles());
    };

    window.addEventListener('performanceTierChanged', handleTierChange);

    return () => {
      window.removeEventListener('performanceTierChanged', handleTierChange);
    };
  }, []);

  return {
    tier,
    styles,
    isHigh: tier === PERFORMANCE_TIER.HIGH,
    isMedium: tier === PERFORMANCE_TIER.MEDIUM,
    isLow: tier === PERFORMANCE_TIER.LOW,
    shouldUseBackdropFilter: shouldUseBackdropFilter(),
    PERFORMANCE_TIER,
  };
};

export default useDevicePerformance;
