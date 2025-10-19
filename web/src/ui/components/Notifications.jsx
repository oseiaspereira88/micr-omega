import React from 'react';
import styles from './Notifications.module.css';

const VARIANT_CLASS_MAP = {
  critical: styles.variantCritical,
  advantage: styles.variantAdvantage,
  resisted: styles.variantResisted,
  status: styles.variantStatus,
  dot: styles.variantStatus,
};

const resolveVariantClass = (variant) => {
  if (typeof variant !== 'string') {
    return null;
  }

  const normalized = variant.trim().toLowerCase();
  return VARIANT_CLASS_MAP[normalized] ?? null;
};

const Notifications = ({ notifications = [] }) => {
  if (!notifications.length) {
    return null;
  }

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {notifications.map((notification, index) => {
        const variantClass = resolveVariantClass(notification?.variant);
        const className = variantClass
          ? `${styles.notification} ${variantClass}`
          : styles.notification;

        return (
          <div
            key={notification.id ?? `${notification.text ?? ''}-${index}`}
            className={className}
            data-variant={notification?.variant}
          >
            {notification.text}
          </div>
        );
      })}
    </div>
  );
};

export default Notifications;
