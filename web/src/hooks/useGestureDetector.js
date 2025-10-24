import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook para detectar gestos multi-touch (swipe, pinch)
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.enabled - Se a detecção está habilitada
 * @param {Function} options.onSwipeUp - Callback para swipe up (2 dedos)
 * @param {Function} options.onSwipeDown - Callback para swipe down (2 dedos)
 * @param {Function} options.onSwipeLeft - Callback para swipe left (2 dedos)
 * @param {Function} options.onSwipeRight - Callback para swipe right (2 dedos)
 * @param {Function} options.onPinchIn - Callback para pinch in (zoom out)
 * @param {Function} options.onPinchOut - Callback para pinch out (zoom in)
 * @param {number} options.minSwipeDistance - Distância mínima para swipe (px)
 * @param {number} options.minPinchDelta - Delta mínimo para pinch (px)
 */
const useGestureDetector = ({
  enabled = true,
  onSwipeUp = null,
  onSwipeDown = null,
  onSwipeLeft = null,
  onSwipeRight = null,
  onPinchIn = null,
  onPinchOut = null,
  minSwipeDistance = 50,
  minPinchDelta = 30,
} = {}) => {
  const gestureState = useRef({
    isActive: false,
    touches: [],
    startDistance: 0,
    startMidpoint: { x: 0, y: 0 },
  });

  const calculateDistance = useCallback((touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const calculateMidpoint = useCallback((touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback((event) => {
    if (!enabled) return;

    const touches = Array.from(event.touches);

    if (touches.length === 2) {
      // Gesto de 2 dedos detectado
      gestureState.current = {
        isActive: true,
        touches: touches.map(t => ({ x: t.clientX, y: t.clientY })),
        startDistance: calculateDistance(touches[0], touches[1]),
        startMidpoint: calculateMidpoint(touches[0], touches[1]),
      };
    }
  }, [enabled, calculateDistance, calculateMidpoint]);

  const handleTouchMove = useCallback((event) => {
    if (!enabled || !gestureState.current.isActive) return;

    const touches = Array.from(event.touches);

    if (touches.length === 2) {
      const currentDistance = calculateDistance(touches[0], touches[1]);
      const distanceDelta = currentDistance - gestureState.current.startDistance;

      // Detectar pinch
      if (Math.abs(distanceDelta) > minPinchDelta) {
        if (distanceDelta > 0 && onPinchOut) {
          // Pinch out (zoom in)
          const scale = currentDistance / gestureState.current.startDistance;
          onPinchOut(scale);
          event.preventDefault();
        } else if (distanceDelta < 0 && onPinchIn) {
          // Pinch in (zoom out)
          const scale = currentDistance / gestureState.current.startDistance;
          onPinchIn(scale);
          event.preventDefault();
        }
      }
    }
  }, [enabled, calculateDistance, minPinchDelta, onPinchIn, onPinchOut]);

  const handleTouchEnd = useCallback((event) => {
    if (!enabled || !gestureState.current.isActive) return;

    const touches = Array.from(event.changedTouches);

    if (touches.length >= 1 && gestureState.current.touches.length === 2) {
      // Calcular movimento do ponto médio para detectar swipe
      const endTouches = Array.from(event.touches);

      if (endTouches.length === 0) {
        // Todos os dedos foram levantados, calcular swipe baseado no último toque
        const lastTouch = touches[touches.length - 1];
        const endMidpoint = { x: lastTouch.clientX, y: lastTouch.clientY };

        const deltaX = endMidpoint.x - gestureState.current.startMidpoint.x;
        const deltaY = endMidpoint.y - gestureState.current.startMidpoint.y;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determinar direção do swipe
        if (absX > minSwipeDistance || absY > minSwipeDistance) {
          if (absX > absY) {
            // Swipe horizontal
            if (deltaX > 0 && onSwipeRight) {
              onSwipeRight();
            } else if (deltaX < 0 && onSwipeLeft) {
              onSwipeLeft();
            }
          } else {
            // Swipe vertical
            if (deltaY > 0 && onSwipeDown) {
              onSwipeDown();
            } else if (deltaY < 0 && onSwipeUp) {
              onSwipeUp();
            }
          }
        }
      }
    }

    // Reset state
    if (event.touches.length === 0) {
      gestureState.current.isActive = false;
    }
  }, [enabled, minSwipeDistance, onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    if (!enabled) return;

    const options = { passive: false };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);
    document.addEventListener('touchcancel', handleTouchEnd, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, options);
      document.removeEventListener('touchmove', handleTouchMove, options);
      document.removeEventListener('touchend', handleTouchEnd, options);
      document.removeEventListener('touchcancel', handleTouchEnd, options);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    // Este hook não retorna state, apenas conecta callbacks
  };
};

export default useGestureDetector;
