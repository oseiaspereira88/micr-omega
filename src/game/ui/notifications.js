const createNotification = (text) => ({
  text,
  life: 2,
  y: 60,
  id: Date.now() + Math.random()
});

export const addNotification = (notifications = [], text) => [
  ...notifications,
  createNotification(text)
];

export default addNotification;
