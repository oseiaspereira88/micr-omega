const generateNotificationId = (() => {
  if (typeof globalThis === 'object') {
    const { crypto } = globalThis;
    if (crypto && typeof crypto.randomUUID === 'function') {
      return () => crypto.randomUUID();
    }
  }

  let counter = 0;
  return () => {
    counter += 1;
    return `notification-${counter}`;
  };
})();

const createNotification = (text) => ({
  text,
  life: 2,
  y: 60,
  id: generateNotificationId()
});

export const addNotification = (notifications = [], text) => [
  ...notifications,
  createNotification(text)
];

export default addNotification;
