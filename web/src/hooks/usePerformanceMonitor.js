import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook para monitorar performance (FPS, frame time)
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.enabled - Se o monitoring está habilitado
 * @param {number} options.sampleInterval - Intervalo para atualizar métricas (ms)
 * @returns {Object} Métricas de performance
 */
const usePerformanceMonitor = ({
  enabled = true,
  sampleInterval = 1000,
} = {}) => {
  const [fps, setFps] = useState(60);
  const [frameTime, setFrameTime] = useState(16.67);
  const [performanceTier, setPerformanceTier] = useState('high'); // 'high', 'medium', 'low'

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const frameTimes = useRef([]);
  const rafId = useRef(null);
  const updateIntervalId = useRef(null);

  const measureFrame = useCallback((timestamp) => {
    if (!enabled) return;

    const delta = timestamp - lastTime.current;

    frameCount.current++;
    frameTimes.current.push(delta);

    // Limitar array a últimos 60 frames
    if (frameTimes.current.length > 60) {
      frameTimes.current.shift();
    }

    lastTime.current = timestamp;

    rafId.current = requestAnimationFrame(measureFrame);
  }, [enabled]);

  const calculateMetrics = useCallback(() => {
    if (frameCount.current === 0) return;

    // Calcular FPS baseado em frames no último intervalo
    const currentFps = Math.round(frameCount.current * (1000 / sampleInterval));
    setFps(currentFps);

    // Calcular frame time médio
    if (frameTimes.current.length > 0) {
      const avgFrameTime = frameTimes.current.reduce((sum, t) => sum + t, 0) / frameTimes.current.length;
      setFrameTime(Math.round(avgFrameTime * 100) / 100);

      // Determinar tier baseado em FPS
      if (currentFps >= 50) {
        setPerformanceTier('high');
      } else if (currentFps >= 30) {
        setPerformanceTier('medium');
      } else {
        setPerformanceTier('low');
      }
    }

    // Reset counter
    frameCount.current = 0;
  }, [sampleInterval]);

  useEffect(() => {
    if (!enabled) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (updateIntervalId.current) {
        clearInterval(updateIntervalId.current);
        updateIntervalId.current = null;
      }
      return;
    }

    // Iniciar medição de frames
    lastTime.current = performance.now();
    rafId.current = requestAnimationFrame(measureFrame);

    // Atualizar métricas periodicamente
    updateIntervalId.current = setInterval(calculateMetrics, sampleInterval);

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      if (updateIntervalId.current) {
        clearInterval(updateIntervalId.current);
      }
    };
  }, [enabled, measureFrame, calculateMetrics, sampleInterval]);

  const getPerformanceLevel = useCallback((fpsValue) => {
    if (fpsValue >= 50) return { level: 'high', label: 'Ótimo', color: '#10b981' };
    if (fpsValue >= 30) return { level: 'medium', label: 'Aceitável', color: '#f59e0b' };
    return { level: 'low', label: 'Ruim', color: '#ef4444' };
  }, []);

  return {
    fps,
    frameTime,
    performanceTier,
    getPerformanceLevel,
  };
};

export default usePerformanceMonitor;
