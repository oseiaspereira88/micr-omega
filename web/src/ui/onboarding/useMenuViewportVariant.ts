import { useEffect, useState } from 'react';

type MenuViewportVariant = 'desktop' | 'mobile';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

const resolveVariant = (): MenuViewportVariant => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }

  try {
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches ? 'mobile' : 'desktop';
  } catch (error) {
    return 'desktop';
  }
};

const useMenuViewportVariant = (): MenuViewportVariant => {
  const [variant, setVariant] = useState<MenuViewportVariant>(() => resolveVariant());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleViewportChange = () => {
      setVariant((current) => {
        const next = resolveVariant();
        return current === next ? current : next;
      });
    };

    handleViewportChange();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  return variant;
};

export default useMenuViewportVariant;
