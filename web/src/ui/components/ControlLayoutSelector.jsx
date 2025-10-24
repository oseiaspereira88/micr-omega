import React, { useState } from 'react';
import styles from './ControlLayoutSelector.module.css';
import { useControlLayout } from '../../contexts/ControlLayoutContext';

/**
 * A11Y-003: Control Layout Selector
 * UI for selecting and customizing touch control layouts
 */
const ControlLayoutSelector = () => {
  const {
    currentPreset,
    presets,
    customSettings,
    applyPreset,
    updateCustomSetting,
    exportLayout,
    importLayout,
    resetToDefault,
  } = useControlLayout();

  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');

  const handlePresetChange = (presetId) => {
    applyPreset(presetId);
  };

  const handleScaleChange = (e) => {
    const value = parseFloat(e.target.value);
    updateCustomSetting('buttonScale', value);
  };

  const handleOpacityChange = (e) => {
    const value = parseFloat(e.target.value);
    updateCustomSetting('buttonOpacity', value);
  };

  const handleExport = () => {
    const code = exportLayout();
    navigator.clipboard.writeText(code).then(() => {
      alert('Código do layout copiado para a área de transferência!');
    }).catch(() => {
      // Fallback: show code in alert
      prompt('Copie este código:', code);
    });
  };

  const handleImport = () => {
    const success = importLayout(importCode);
    if (success) {
      setImportError('');
      setShowImport(false);
      setImportCode('');
      alert('Layout importado com sucesso!');
    } else {
      setImportError('Código inválido. Verifique e tente novamente.');
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Layout de Controles</h3>

      {/* Presets */}
      <div className={styles.section}>
        <label className={styles.label}>Selecionar Preset</label>
        <div className={styles.presetGrid}>
          {Object.values(presets).map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`${styles.presetCard} ${currentPreset === preset.id ? styles.presetCardActive : ''}`}
              onClick={() => handlePresetChange(preset.id)}
            >
              <div className={styles.presetName}>{preset.name}</div>
              <div className={styles.presetDescription}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom settings */}
      <div className={styles.section}>
        <label htmlFor="button-scale" className={styles.label}>
          Tamanho dos Botões: {Math.round(customSettings.buttonScale * 100)}%
        </label>
        <input
          id="button-scale"
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={customSettings.buttonScale}
          onChange={handleScaleChange}
          className={styles.slider}
        />
      </div>

      <div className={styles.section}>
        <label htmlFor="button-opacity" className={styles.label}>
          Opacidade dos Botões: {Math.round(customSettings.buttonOpacity * 100)}%
        </label>
        <input
          id="button-opacity"
          type="range"
          min="0.5"
          max="1.0"
          step="0.05"
          value={customSettings.buttonOpacity}
          onChange={handleOpacityChange}
          className={styles.slider}
        />
      </div>

      {/* Import/Export */}
      <div className={styles.section}>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleExport}
            className={styles.button}
          >
            📤 Exportar Layout
          </button>
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            className={styles.button}
          >
            📥 Importar Layout
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className={styles.buttonSecondary}
          >
            🔄 Resetar
          </button>
        </div>

        {showImport && (
          <div className={styles.importBox}>
            <label htmlFor="import-code" className={styles.label}>
              Cole o código do layout:
            </label>
            <textarea
              id="import-code"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              className={styles.textarea}
              placeholder="Cole o código aqui..."
              rows={3}
            />
            {importError && (
              <div className={styles.error}>{importError}</div>
            )}
            <div className={styles.importActions}>
              <button
                type="button"
                onClick={handleImport}
                className={styles.button}
                disabled={!importCode.trim()}
              >
                Importar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportCode('');
                  setImportError('');
                }}
                className={styles.buttonSecondary}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlLayoutSelector;
