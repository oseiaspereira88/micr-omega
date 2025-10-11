import { addNotification as appendNotification } from '../ui/notifications';

const notify = (state, message) => {
  state.notifications = appendNotification(state.notifications, message);
};

export const createPowerUpTypes = () => ({
  health: {
    name: 'Cápsula Regenerativa',
    icon: '❤️',
    color: '#FF4444',
    instant: true,
    apply: (state) => {
      state.health = Math.min(state.maxHealth, state.health + 50);
      notify(state, '+50 HP');
    }
  },
  energy: {
    name: 'Nódulo Energético',
    icon: '⚡',
    color: '#FFD700',
    instant: true,
    apply: (state) => {
      state.energy += 100;
      notify(state, '+100 Energia');
    }
  },
  speed: {
    name: 'Impulso Cinético',
    icon: '💨',
    color: '#00FFAA',
    duration: 8,
    message: 'Velocidade 2x!'
  },
  damage: {
    name: 'Pico Ofensivo',
    icon: '⚔️',
    color: '#FF4477',
    duration: 10,
    message: 'Ataque Potente!'
  },
  invincibility: {
    name: 'Escudo Estelar',
    icon: '🛡️',
    color: '#FFD700',
    duration: 6,
    message: 'Invencível!'
  }
});

export default createPowerUpTypes;
