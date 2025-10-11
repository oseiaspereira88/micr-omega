import React from 'react';
import styles from './Notifications.module.css';

const Notifications = ({ notifications = [] }) => {
  if (!notifications.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      {notifications.map(notification => (
        <div key={notification.id} className={styles.notification}>
          {notification.text}
        </div>
      ))}
    </div>
  );
};

export default Notifications;
