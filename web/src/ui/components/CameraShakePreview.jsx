import React, { useState, useEffect } from 'react';
import styles from './CameraShakePreview.module.css';

/**
 * Visual preview of camera shake intensity
 *
 * @param {Object} props
 * @param {number} props.intensity - Shake intensity (0-1)
 * @param {boolean} props.enabled - Whether shake is enabled
 */
const CameraShakePreview = ({ intensity = 0.5, enabled = true }) => {
  const [shaking, setShaking] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const triggerShake = () => {
    if (!enabled || intensity === 0) return;

    setShaking(true);

    // Duration based on intensity (shorter for low intensity)
    const duration = 500 + (intensity * 500);
    const shakeCount = 8;
    const maxOffset = intensity * 15; // Max 15px offset

    let frame = 0;
    const shakeInterval = setInterval(() => {
      if (frame >= shakeCount) {
        clearInterval(shakeInterval);
        setOffset({ x: 0, y: 0 });
        setShaking(false);
        return;
      }

      // Random offset with decreasing intensity
      const progress = frame / shakeCount;
      const currentIntensity = (1 - progress) * maxOffset;

      setOffset({
        x: (Math.random() - 0.5) * currentIntensity,
        y: (Math.random() - 0.5) * currentIntensity,
      });

      frame++;
    }, duration / shakeCount);

    return () => clearInterval(shakeInterval);
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.previewButton}
        onClick={triggerShake}
        disabled={!enabled || shaking}
        aria-label={`Testar shake da câmera com intensidade ${Math.round(intensity * 100)}%`}
      >
        Testar Shake
      </button>

      <div className={styles.visualization}>
        <div
          className={`${styles.box} ${shaking ? styles.shaking : ''}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          <div className={styles.boxInner}>
            <div className={styles.crosshair}>
              <div className={styles.crosshairH} />
              <div className={styles.crosshairV} />
            </div>
          </div>
        </div>

        {!enabled && (
          <div className={styles.disabledOverlay}>
            <div className={styles.disabledText}>Shake Desabilitado</div>
          </div>
        )}

        {enabled && intensity === 0 && (
          <div className={styles.disabledOverlay}>
            <div className={styles.disabledText}>Intensidade: 0%</div>
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.infoLabel}>Intensidade:</div>
        <div className={styles.infoValue}>{Math.round(intensity * 100)}%</div>
      </div>
    </div>
  );
};

export default CameraShakePreview;
