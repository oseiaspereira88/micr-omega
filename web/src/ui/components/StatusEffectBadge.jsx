import React from 'react';
import styles from './StatusEffectBadge.module.css';

/**
 * Status Effect Icons
 * Each status has a unique icon to help colorblind players
 */
const STATUS_ICONS = {
  poison: '☠️',
  burn: '🔥',
  freeze: '❄️',
  stun: '⚡',
  slow: '🐌',
  bleed: '🩸',
  regeneration: '💚',
  shield: '🛡️',
  weakness: '⬇️',
  strength: '⬆️',
  haste: '💨',
  confusion: '💫',
  paralysis: '🔒',
  blind: '👁️',
  silence: '🔇',
};

/**
 * Pattern types for visual differentiation
 * Used in combination with color for better accessibility
 */
const STATUS_PATTERNS = {
  poison: 'dots',
  burn: 'diagonal',
  freeze: 'crystal',
  stun: 'zigzag',
  slow: 'horizontal',
  bleed: 'vertical',
  regeneration: 'plus',
  shield: 'grid',
  weakness: 'cross',
  strength: 'chevron',
  haste: 'wave',
  confusion: 'spiral',
  paralysis: 'lock',
  blind: 'solid',
  silence: 'mute',
};

/**
 * StatusEffectBadge Component
 * Colorblind-friendly status effect display with icons and patterns
 *
 * @param {Object} props
 * @param {string} props.type - Status effect type
 * @param {string} props.label - Display label
 * @param {number} props.stacks - Number of stacks
 * @param {number} props.remaining - Seconds remaining
 * @param {string} props.color - Color for the effect
 * @param {string} props.className - Additional CSS class
 */
const StatusEffectBadge = ({
  type,
  label,
  stacks = 1,
  remaining = 0,
  color = '#fff',
  className,
}) => {
  const icon = STATUS_ICONS[type] || '✨';
  const pattern = STATUS_PATTERNS[type] || 'solid';
  const stacksDisplay = stacks > 1 ? `x${stacks}` : null;
  const timeDisplay = remaining > 0 ? `${Math.ceil(remaining)}s` : null;

  const ariaLabel = [
    label || type,
    stacksDisplay,
    timeDisplay,
  ].filter(Boolean).join(' • ');

  return (
    <div
      className={`${styles.badge} ${styles[`pattern-${pattern}`]} ${className || ''}`}
      style={{
        '--status-color': color,
        borderColor: color,
      }}
      role="status"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.content}>
        {stacksDisplay && (
          <span className={styles.stacks} aria-hidden="true">
            {stacksDisplay}
          </span>
        )}
        {timeDisplay && (
          <span className={styles.time} aria-hidden="true">
            {timeDisplay}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusEffectBadge;
