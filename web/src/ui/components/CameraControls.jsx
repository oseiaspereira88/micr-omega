import React, { useCallback, useMemo } from 'react';

import { CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN, clampCameraZoom } from '../../store/gameSettings';

import styles from './CameraControls.module.css';

const formatZoomLabel = (zoom) => `${Math.round(zoom * 100)}%`;

const CameraControls = ({ zoom = 1, onChange }) => {
  const safeZoom = useMemo(() => clampCameraZoom(zoom), [zoom]);

  const handleChange = useCallback(
    (event) => {
      const value = Number.parseFloat(event.target.value);
      if (typeof onChange === 'function') {
        const parsedValue = Number.isFinite(value) ? value : safeZoom;
        onChange(clampCameraZoom(parsedValue));
      }
    },
    [onChange, safeZoom]
  );

  const handlePreset = useCallback(
    (value) => () => {
      if (typeof onChange === 'function') {
        onChange(clampCameraZoom(value));
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
          min={CAMERA_ZOOM_MIN}
          max={CAMERA_ZOOM_MAX}
          step={0.05}
          value={safeZoom}
          onChange={handleChange}
          aria-label="Controle de zoom da câmera"
          aria-valuemin={CAMERA_ZOOM_MIN}
          aria-valuemax={CAMERA_ZOOM_MAX}
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
