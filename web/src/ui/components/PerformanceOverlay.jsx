import React from 'react';
import styles from './PerformanceOverlay.module.css';
import usePerformanceMonitor from '../../hooks/usePerformanceMonitor';
import useNetworkQuality from '../../hooks/useNetworkQuality';

/**
 * Overlay de performance mostrando FPS, Frame Time, e Ping
 *
 * @param {Object} props
 * @param {boolean} props.enabled - Se o overlay está habilitado
 * @param {WebSocket} props.socket - WebSocket connection para medir ping
 * @param {string} props.position - Posição do overlay: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
 */
const PerformanceOverlay = ({
  enabled = false,
  socket = null,
  position = 'top-left',
}) => {
  const { fps, frameTime, performanceTier, getPerformanceLevel } = usePerformanceMonitor({
    enabled,
    sampleInterval: 1000,
  });

  const { ping, connectionQuality, isOnline, getConnectionQualityInfo } = useNetworkQuality({
    enabled,
    socket,
    pingInterval: 3000,
  });

  if (!enabled) {
    return null;
  }

  const fpsLevel = getPerformanceLevel(fps);
  const connectionInfo = getConnectionQualityInfo();

  const containerClassName = `${styles.container} ${styles[position] || styles.topLeft}`;

  return (
    <div className={containerClassName} role="status" aria-live="polite">
      <div className={styles.content}>
        {/* FPS */}
        <div className={styles.metric}>
          <span className={styles.label}>FPS:</span>
          <span
            className={styles.value}
            style={{ color: fpsLevel.color }}
            title={`Performance: ${fpsLevel.label}`}
          >
            {fps}
          </span>
        </div>

        {/* Frame Time */}
        <div className={styles.metric}>
          <span className={styles.label}>Frame:</span>
          <span
            className={styles.value}
            style={{ color: fpsLevel.color }}
            title={`Tempo de frame: ${frameTime.toFixed(2)}ms`}
          >
            {frameTime.toFixed(1)}ms
          </span>
        </div>

        {/* Ping/Latency */}
        {socket && (
          <div className={styles.metric}>
            <span className={styles.label}>Ping:</span>
            <span
              className={styles.value}
              style={{ color: connectionInfo.color }}
              title={`Conexão: ${connectionInfo.label}`}
            >
              {isOnline ? `${ping}ms` : 'Offline'}
            </span>
          </div>
        )}

        {/* Performance tier indicator */}
        <div className={styles.indicator}>
          <div
            className={`${styles.indicatorDot} ${styles[`tier${performanceTier.charAt(0).toUpperCase()}${performanceTier.slice(1)}`]}`}
            title={`Performance: ${fpsLevel.label}`}
          />
        </div>
      </div>

      {/* Screen reader friendly text */}
      <span className={styles.visuallyHidden}>
        Performance: {fps} FPS, {frameTime.toFixed(1)} milissegundos por frame
        {socket && `, Ping: ${isOnline ? `${ping} milissegundos` : 'Offline'}`}
      </span>
    </div>
  );
};

export default PerformanceOverlay;
