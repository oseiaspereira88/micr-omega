import React, { useState, useEffect } from 'react';
import styles from './GestureTutorial.module.css';

/**
 * Tutorial de gestos que aparece na primeira vez
 *
 * @param {Object} props
 * @param {boolean} props.show - Se deve mostrar o tutorial
 * @param {Function} props.onClose - Callback ao fechar
 */
const GestureTutorial = ({ show = false, onClose }) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const handleDontShowAgain = () => {
    // Salvar preferência no localStorage
    try {
      localStorage.setItem('gesture-tutorial-shown', 'true');
    } catch (e) {
      // Ignorar erro de localStorage
    }
    handleClose();
  };

  if (!visible) {
    return null;
  }

  const gestures = [
    {
      icon: '👆👆',
      title: 'Swipe com 2 Dedos',
      description: 'Para cima: Abrir roda de skills',
      action: '↑',
    },
    {
      icon: '👆👆',
      title: 'Swipe com 2 Dedos',
      description: 'Para baixo: Fechar menus',
      action: '↓',
    },
    {
      icon: '👆👆',
      title: 'Swipe com 2 Dedos',
      description: 'Esquerda/Direita: Trocar skills',
      action: '← →',
    },
    {
      icon: '🤏',
      title: 'Pinch',
      description: 'Aproximar/Afastar para zoom',
      action: '⊕ ⊖',
    },
  ];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="gesture-tutorial-title">
      <div className={styles.container}>
        <h2 id="gesture-tutorial-title" className={styles.title}>
          Gestos Disponíveis
        </h2>

        <p className={styles.subtitle}>
          Use gestos para ações rápidas durante o jogo
        </p>

        <div className={styles.gestures}>
          {gestures.map((gesture, index) => (
            <div key={index} className={styles.gestureCard}>
              <div className={styles.gestureIcon}>{gesture.icon}</div>
              <div className={styles.gestureInfo}>
                <div className={styles.gestureTitle}>{gesture.title}</div>
                <div className={styles.gestureDescription}>{gesture.description}</div>
              </div>
              <div className={styles.gestureAction}>{gesture.action}</div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={handleDontShowAgain}
          >
            Não mostrar novamente
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={handleClose}
          >
            Entendi!
          </button>
        </div>
      </div>
    </div>
  );
};

export default GestureTutorial;
