import React, { useState, useEffect } from 'react';
import styles from './ContextualTooltip.module.css';

/**
 * Tooltip contextual para onboarding e dicas durante gameplay
 *
 * @param {Object} props
 * @param {boolean} props.show - Se deve mostrar o tooltip
 * @param {string} props.title - Título do tooltip
 * @param {string} props.message - Mensagem do tooltip
 * @param {string} props.position - Posição: 'top', 'center', 'bottom'
 * @param {Function} props.onDismiss - Callback ao dispensar
 * @param {boolean} props.dismissible - Se pode ser dispensado
 */
const ContextualTooltip = ({
  show = false,
  title = '',
  message = '',
  position = 'top',
  onDismiss = null,
  dismissible = true,
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleDontShowAgain = () => {
    // Salvar no localStorage para não mostrar novamente
    const tooltipKey = `tooltip-dismissed-${title.toLowerCase().replace(/\s+/g, '-')}`;
    try {
      localStorage.setItem(tooltipKey, 'true');
    } catch (e) {
      // Ignorar erro
    }
    handleDismiss();
  };

  if (!isVisible) {
    return null;
  }

  const containerClassName = `${styles.container} ${styles[position] || styles.top}`;

  return (
    <div className={containerClassName} role="alert" aria-live="polite">
      <div className={styles.content}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {message && <p className={styles.message}>{message}</p>}

        {dismissible && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={handleDontShowAgain}
              aria-label="Não mostrar novamente"
            >
              Não mostrar novamente
            </button>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={handleDismiss}
              aria-label="Entendi"
            >
              Entendi!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Hook para gerenciar tooltips contextuais de onboarding
 */
export const useContextualTooltips = () => {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const showTooltip = (tooltipId, config) => {
    // Verificar se já foi dispensado permanentemente
    const tooltipKey = `tooltip-dismissed-${tooltipId}`;
    try {
      const dismissed = localStorage.getItem(tooltipKey);
      if (dismissed === 'true') {
        return; // Não mostrar se foi dispensado
      }
    } catch (e) {
      // Ignorar erro
    }

    setActiveTooltip({
      id: tooltipId,
      ...config,
    });
  };

  const hideTooltip = () => {
    setActiveTooltip(null);
  };

  return {
    activeTooltip,
    showTooltip,
    hideTooltip,
  };
};

export default ContextualTooltip;
