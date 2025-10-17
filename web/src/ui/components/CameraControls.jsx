import React, { useCallback, useMemo } from 'react';

import styles from './CameraControls.module.css';

const clampZoom = (zoom) => {
  const value = Number.isFinite(zoom) ? zoom : 1;
  return Math.min(1.2, Math.max(0.6, value));
};

const formatZoomLabel = (zoom) => `${Math.round(zoom * 100)}%`;

const CameraControls = ({ zoom = 1, onChange }) => {
  const safeZoom = useMemo(() => clampZoom(zoom), [zoom]);

  const handleChange = useCallback(
    (event) => {
      const value = Number.parseFloat(event.target.value);
      if (typeof onChange === 'function') {
        onChange(Number.isFinite(value) ? value : safeZoom);
      }
    },
    [onChange, safeZoom]
  );

  const handlePreset = useCallback(
    (value) => () => {
      if (typeof onChange === 'function') {
        onChange(value);
      }
    },
    [onChange]
  );

  const isDefaultPresetActive = safeZoom >= 0.95;
  const isMacroPresetActive = safeZoom <= 0.75;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Câmera</span>
        <span className={styles.value}>{formatZoomLabel(safeZoom)}</span>
      </div>

      <label className={styles.sliderLabel}>
        <span className={styles.sliderText}>Zoom</span>
        <input
          className={styles.slider}
          type="range"
          min={0.6}
          max={1.2}
          step={0.05}
          value={safeZoom}
          onChange={handleChange}
          aria-label="Controle de zoom da câmera"
          aria-valuemin={0.6}
          aria-valuemax={1.2}
          aria-valuenow={safeZoom}
          aria-valuetext={formatZoomLabel(safeZoom)}
        />
      </label>

      <div className={styles.presets}>
        <button
          type="button"
          className={`${styles.presetButton} ${isDefaultPresetActive ? styles.active : ''}`}
          onClick={handlePreset(1)}
          aria-pressed={isDefaultPresetActive}
        >
          Padrão
        </button>
        <button
          type="button"
          className={`${styles.presetButton} ${isMacroPresetActive ? styles.active : ''}`}
          onClick={handlePreset(0.7)}
          aria-pressed={isMacroPresetActive}
        >
          Macro
        </button>
      </div>
    </div>
  );
};

export default CameraControls;
