import { useEffect } from 'react';

const parsePixelValue = (value) => {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const useDynamicViewportHeight = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    if (!root) {
      return undefined;
    }

    const updateViewportHeight = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      if (typeof viewportHeight !== 'number') {
        return;
      }

      const safeAreaInsetBottom = (() => {
        try {
          const styles = window.getComputedStyle(root);
          return parsePixelValue(styles.getPropertyValue('--safe-area-inset-bottom'));
        } catch (error) {
          return 0;
        }
      })();

      const adjustedHeight = Math.max(viewportHeight - safeAreaInsetBottom, 0);
      root.style.setProperty('--app-viewport-height', `${adjustedHeight}px`);
    };

    updateViewportHeight();

    const viewport = window.visualViewport;

    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);

    if (viewport) {
      viewport.addEventListener('resize', updateViewportHeight);
      viewport.addEventListener('scroll', updateViewportHeight);
    }

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);

      if (viewport) {
        viewport.removeEventListener('resize', updateViewportHeight);
        viewport.removeEventListener('scroll', updateViewportHeight);
      }
    };
  }, []);
};

export default useDynamicViewportHeight;
