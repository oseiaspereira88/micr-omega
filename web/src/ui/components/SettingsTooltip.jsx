import React, { useState } from 'react';
import styles from './SettingsTooltip.module.css';

/**
 * Tooltip de ajuda para configurações
 *
 * @param {Object} props
 * @param {string} props.text - Texto de ajuda
 * @param {string} props.position - Posição: 'top', 'bottom', 'left', 'right'
 */
const SettingsTooltip = ({ text, position = 'top', children }) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);

  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  if (!text) return children;

  return (
    <div
      className={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {isVisible && (
        <div
          className={`${styles.tooltip} ${styles[position]}`}
          role="tooltip"
          aria-hidden="false"
        >
          <div className={styles.content}>{text}</div>
          <div className={styles.arrow} />
        </div>
      )}
    </div>
  );
};

export default SettingsTooltip;
