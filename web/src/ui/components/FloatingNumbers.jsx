import React, { useEffect, useState, useCallback } from 'react';
import styles from './FloatingNumbers.module.css';

/**
 * FloatingNumbers Component
 * Displays animated floating numbers for resource changes (XP, Energy, etc)
 *
 * @param {Object} props
 * @param {Array<{id: string, value: number, type: string, x: number, y: number}>} props.numbers
 * @param {Function} props.onComplete - Called when animation completes with id
 */
const FloatingNumbers = ({ numbers = [], onComplete }) => {
  const [visibleNumbers, setVisibleNumbers] = useState([]);

  useEffect(() => {
    if (numbers.length === 0) {
      return;
    }

    // Add new numbers to visible list
    setVisibleNumbers(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const newNumbers = numbers.filter(n => !existingIds.has(n.id));
      return [...prev, ...newNumbers];
    });

    // Set timers to remove numbers after animation
    const timers = numbers.map(number => {
      return setTimeout(() => {
        setVisibleNumbers(prev => prev.filter(n => n.id !== number.id));
        onComplete?.(number.id);
      }, 800); // Match animation duration
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [numbers, onComplete]);

  if (visibleNumbers.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {visibleNumbers.map(number => {
        const isGain = number.value > 0;
        const displayValue = isGain ? `+${number.value}` : number.value;

        // Color coding based on resource type
        const colorClass = (() => {
          if (number.type === 'energy') {
            return isGain ? styles.energyGain : styles.energyLoss;
          }
          if (number.type === 'health') {
            return isGain ? styles.healthGain : styles.healthLoss;
          }
          if (number.type === 'xp') {
            return styles.xpGain;
          }
          if (number.type === 'geneticMaterial') {
            return styles.mgGain;
          }
          if (number.type === 'damage') {
            return styles.damage;
          }
          return isGain ? styles.gain : styles.loss;
        })();

        // Icon based on type
        const icon = (() => {
          switch (number.type) {
            case 'energy':
              return '⚡';
            case 'health':
              return '❤️';
            case 'xp':
              return '✨';
            case 'geneticMaterial':
              return '🧬';
            case 'damage':
              return '💥';
            default:
              return null;
          }
        })();

        const style = {
          left: `${number.x ?? 50}%`,
          top: `${number.y ?? 50}%`,
        };

        return (
          <div
            key={number.id}
            className={`${styles.floatingNumber} ${colorClass}`}
            style={style}
            role="status"
            aria-label={`${number.type}: ${displayValue}`}
          >
            {icon && <span className={styles.icon}>{icon}</span>}
            <span className={styles.value}>{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
};

export default FloatingNumbers;
