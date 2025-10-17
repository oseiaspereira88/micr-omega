import React from 'react';
import styles from './Notifications.module.css';

const Notifications = ({ notifications = [] }) => {
  if (!notifications.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      {notifications.map((notification, index) => (
        <div
          key={notification.id ?? `${notification.text ?? ''}-${index}`}
          className={styles.notification}
        >
          {notification.text}
        </div>
      ))}
    </div>
  );
};

export default Notifications;
