import { useEffect, useState } from 'react';

const detectTouchDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) {
    return true;
  }

  if ('ontouchstart' in window) {
    return true;
  }

  if (typeof window.matchMedia === 'function') {
    try {
      const mediaQuery = window.matchMedia('(pointer: coarse)');
      if (mediaQuery?.matches) {
        return true;
      }
    } catch (error) {
      // Ignore matchMedia errors and continue with the remaining fallbacks.
    }
  }

  const userAgent = navigator.userAgent?.toLowerCase?.() ?? '';
  return userAgent.includes('mobi') || userAgent.includes('android');
};

const useIsTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(() => detectTouchDevice());

  useEffect(() => {
    if (isTouchDevice) {
      return undefined;
    }

    const handleFirstTouch = () => {
      setIsTouchDevice(true);
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, [isTouchDevice]);

  return isTouchDevice;
};

export default useIsTouchDevice;
export { detectTouchDevice };
