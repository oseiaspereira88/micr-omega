import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook para detectar gestos de swipe para abrir/fechar sidebar
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.enabled - Se o gesture está habilitado
 * @param {Function} options.onSwipeStart - Callback quando swipe inicia
 * @param {Function} options.onSwipeMove - Callback durante movimento (recebe progress 0-1)
 * @param {Function} options.onSwipeEnd - Callback quando swipe termina (recebe shouldOpen boolean)
 * @param {number} options.edgeThreshold - Distância da borda para iniciar swipe (px)
 * @param {number} options.minSwipeDistance - Distância mínima para considerar swipe válido (px)
 * @param {number} options.velocityThreshold - Velocidade mínima para snap (px/ms)
 * @param {string} options.direction - Direção do swipe: 'left' ou 'right'
 */
const useSwipeGesture = ({
  enabled = true,
  onSwipeStart = null,
  onSwipeMove = null,
  onSwipeEnd = null,
  edgeThreshold = 50,
  minSwipeDistance = 50,
  velocityThreshold = 0.3,
  direction = 'left', // 'left' para swipe from right edge
} = {}) => {
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeState = useRef({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isFromEdge: false,
  });

  const isSwipeFromEdge = useCallback((x, viewportWidth) => {
    if (direction === 'left') {
      // Swipe from right edge (para fechar sidebar)
      return x >= (viewportWidth - edgeThreshold);
    } else {
      // Swipe from left edge
      return x <= edgeThreshold;
    }
  }, [direction, edgeThreshold]);

  const handlePointerDown = useCallback((event) => {
    if (!enabled) return;

    const viewportWidth = window.innerWidth;
    const touch = event.touches ? event.touches[0] : event;
    const x = touch.clientX;
    const y = touch.clientY;

    // Verificar se está na edge zone
    if (!isSwipeFromEdge(x, viewportWidth)) {
      return;
    }

    swipeState.current = {
      isActive: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      startTime: Date.now(),
      isFromEdge: true,
    };

    setIsSwiping(true);
    onSwipeStart?.();
  }, [enabled, isSwipeFromEdge, onSwipeStart]);

  const handlePointerMove = useCallback((event) => {
    if (!enabled || !swipeState.current.isActive) return;

    const touch = event.touches ? event.touches[0] : event;
    const x = touch.clientX;
    const y = touch.clientY;

    swipeState.current.currentX = x;
    swipeState.current.currentY = y;

    const deltaX = x - swipeState.current.startX;
    const deltaY = y - swipeState.current.startY;

    // Verificar se é movimento horizontal predominante
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

    if (!isHorizontal) {
      // Se movimento é muito vertical, cancelar swipe
      return;
    }

    // Calcular progresso (0-1) baseado na distância
    const distance = Math.abs(deltaX);
    const maxDistance = window.innerWidth * 0.7; // 70% da largura da tela
    const progress = Math.min(1, distance / maxDistance);

    onSwipeMove?.(progress, deltaX);

    // Prevenir scroll se está fazendo swipe horizontal
    if (isHorizontal) {
      event.preventDefault();
    }
  }, [enabled, onSwipeMove]);

  const handlePointerUp = useCallback((event) => {
    if (!enabled || !swipeState.current.isActive) return;

    const touch = event.changedTouches ? event.changedTouches[0] : event;
    const endX = touch.clientX;
    const endTime = Date.now();

    const deltaX = endX - swipeState.current.startX;
    const deltaTime = endTime - swipeState.current.startTime;
    const velocity = Math.abs(deltaX) / deltaTime; // px/ms

    const distance = Math.abs(deltaX);
    const swipeDirection = deltaX > 0 ? 'right' : 'left';

    // Determinar se deve abrir ou fechar baseado em:
    // 1. Distância percorrida (threshold)
    // 2. Velocidade do swipe (velocity)
    // 3. Direção do swipe
    let shouldOpen = false;

    if (direction === 'left') {
      // Swipe from right edge - fechar se swipe para direita
      shouldOpen = swipeDirection === 'left' &&
                   (distance >= minSwipeDistance || velocity >= velocityThreshold);
    } else {
      // Swipe from left edge - abrir se swipe para direita
      shouldOpen = swipeDirection === 'right' &&
                   (distance >= minSwipeDistance || velocity >= velocityThreshold);
    }

    onSwipeEnd?.(shouldOpen, velocity);

    // Reset state
    swipeState.current.isActive = false;
    setIsSwiping(false);
  }, [enabled, direction, minSwipeDistance, velocityThreshold, onSwipeEnd]);

  const handlePointerCancel = useCallback(() => {
    if (swipeState.current.isActive) {
      swipeState.current.isActive = false;
      setIsSwiping(false);
      onSwipeEnd?.(false, 0);
    }
  }, [onSwipeEnd]);

  useEffect(() => {
    if (!enabled) return;

    // Use passive: false para poder prevenir scroll
    const options = { passive: false };

    window.addEventListener('touchstart', handlePointerDown, options);
    window.addEventListener('touchmove', handlePointerMove, options);
    window.addEventListener('touchend', handlePointerUp, options);
    window.addEventListener('touchcancel', handlePointerCancel, options);

    // Também suportar mouse para testing
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('touchstart', handlePointerDown, options);
      window.removeEventListener('touchmove', handlePointerMove, options);
      window.removeEventListener('touchend', handlePointerUp, options);
      window.removeEventListener('touchcancel', handlePointerCancel, options);

      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [enabled, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);

  return {
    isSwiping,
  };
};

export default useSwipeGesture;
