import React, { useEffect, useRef, useState } from 'react';
import styles from './LiveAnnouncer.module.css';

/**
 * Component for screen reader announcements
 * Uses ARIA live regions for important game events
 *
 * @param {Object} props
 * @param {string} props.message - Message to announce
 * @param {string} props.priority - 'polite' or 'assertive'
 * @param {number} props.clearDelay - Time to clear message (ms)
 */
const LiveAnnouncer = ({ message = '', priority = 'polite', clearDelay = 3000 }) => {
  const [currentMessage, setCurrentMessage] = useState('');
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (message && message !== currentMessage) {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new message
      setCurrentMessage(message);

      // Schedule clearing the message
      if (clearDelay > 0) {
        timeoutRef.current = setTimeout(() => {
          setCurrentMessage('');
        }, clearDelay);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, currentMessage, clearDelay]);

  return (
    <div className={styles.announcer}>
      {/* Polite announcements - won't interrupt current speech */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.liveRegion}
      >
        {priority === 'polite' ? currentMessage : ''}
      </div>

      {/* Assertive announcements - will interrupt current speech */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={styles.liveRegion}
      >
        {priority === 'assertive' ? currentMessage : ''}
      </div>
    </div>
  );
};

/**
 * Hook for managing live announcements
 * Provides a simple API for announcing messages to screen readers
 */
export const useLiveAnnouncer = () => {
  const [announcement, setAnnouncement] = useState({ message: '', priority: 'polite' });

  const announce = (message, priority = 'polite') => {
    setAnnouncement({ message, priority, timestamp: Date.now() });
  };

  const announcePolite = (message) => {
    announce(message, 'polite');
  };

  const announceAssertive = (message) => {
    announce(message, 'assertive');
  };

  return {
    announcement,
    announce,
    announcePolite,
    announceAssertive,
  };
};

/**
 * Component that announces game events automatically
 */
export const GameEventAnnouncer = ({
  level,
  health,
  maxHealth,
  canEvolve,
  bossActive,
  skillReady,
  dashReady,
}) => {
  const { announce, announceAssertive } = useLiveAnnouncer();
  const prevValues = useRef({
    level: level,
    health: health,
    canEvolve: canEvolve,
    bossActive: bossActive,
    skillReady: skillReady,
    dashReady: dashReady,
  });

  useEffect(() => {
    // Level up
    if (level > prevValues.current.level) {
      announce(`Você subiu para o nível ${level}!`, 'polite');
    }

    // Critical health
    const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 100;
    const prevHealthPercent = maxHealth > 0 ? (prevValues.current.health / maxHealth) * 100 : 100;

    if (healthPercent <= 20 && prevHealthPercent > 20) {
      announceAssertive('Atenção! Vida crítica!');
    }

    // Can evolve
    if (canEvolve && !prevValues.current.canEvolve) {
      announce('Você pode evoluir! Pressione E ou toque no botão de evolução.', 'polite');
    }

    // Boss spawned
    if (bossActive && !prevValues.current.bossActive) {
      announceAssertive('Boss apareceu! Prepare-se para o combate!');
    }

    // Boss defeated
    if (!bossActive && prevValues.current.bossActive) {
      announce('Boss derrotado!', 'polite');
    }

    // Skill ready
    if (skillReady && !prevValues.current.skillReady) {
      announce('Habilidade pronta para usar.', 'polite');
    }

    // Dash ready
    if (dashReady && !prevValues.current.dashReady) {
      announce('Dash disponível.', 'polite');
    }

    // Update prev values
    prevValues.current = {
      level,
      health,
      canEvolve,
      bossActive,
      skillReady,
      dashReady,
    };
  }, [level, health, maxHealth, canEvolve, bossActive, skillReady, dashReady, announce, announceAssertive]);

  return null;
};

export default LiveAnnouncer;
