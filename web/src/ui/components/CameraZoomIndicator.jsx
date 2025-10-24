import React, { useEffect, useState } from 'react';
import styles from './CameraZoomIndicator.module.css';

/**
 * Visual indicator for camera zoom level
 *
 * @param {Object} props
 * @param {number} props.zoom - Current zoom level (0.6 - 1.2)
 * @param {boolean} props.show - Whether to show the indicator
 * @param {number} props.autoHideDelay - Time to auto-hide after zoom change (ms)
 */
const CameraZoomIndicator = ({
  zoom = 1.0,
  show = false,
  autoHideDelay = 2000,
}) => {
  const [visible, setVisible] = useState(show);
  const [lastZoom, setLastZoom] = useState(zoom);

  useEffect(() => {
    if (zoom !== lastZoom) {
      setVisible(true);
      setLastZoom(zoom);

      if (autoHideDelay > 0) {
        const timeout = setTimeout(() => {
          setVisible(false);
        }, autoHideDelay);

        return () => clearTimeout(timeout);
      }
    }
  }, [zoom, lastZoom, autoHideDelay]);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  if (!visible) {
    return null;
  }

  // Calculate zoom percentage (0.6 = 60%, 1.0 = 100%, 1.2 = 120%)
  const zoomPercent = Math.round(zoom * 100);

  // Determine zoom level label
  let zoomLabel = 'Normal';
  if (zoom < 0.8) {
    zoomLabel = 'Muito Distante';
  } else if (zoom < 1.0) {
    zoomLabel = 'Distante';
  } else if (zoom > 1.1) {
    zoomLabel = 'Muito Próximo';
  } else if (zoom > 1.0) {
    zoomLabel = 'Próximo';
  }

  // Determine icon
  let icon = '🔍';
  if (zoom < 1.0) {
    icon = '🔍−'; // Zoom out
  } else if (zoom > 1.0) {
    icon = '🔍+'; // Zoom in
  }

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.content}>
        <div className={styles.icon}>{icon}</div>
        <div className={styles.info}>
          <div className={styles.percentage}>{zoomPercent}%</div>
          <div className={styles.label}>{zoomLabel}</div>
        </div>
        <div className={styles.visualBar}>
          <div
            className={styles.visualBarFill}
            style={{
              width: `${((zoom - 0.6) / (1.2 - 0.6)) * 100}%`,
            }}
          />
          <div
            className={styles.visualBarMarker}
            style={{
              left: `${((1.0 - 0.6) / (1.2 - 0.6)) * 100}%`,
            }}
            aria-label="Zoom normal (100%)"
          />
        </div>
      </div>

      {/* Screen reader text */}
      <span className={styles.visuallyHidden}>
        Zoom da câmera: {zoomPercent}%, {zoomLabel}
      </span>
    </div>
  );
};

export default CameraZoomIndicator;
