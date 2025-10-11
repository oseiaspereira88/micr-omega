export const evolutionaryTraits = {
  flagellum: { name: 'Flagelo', icon: '🦎', color: '#00FFB3', skill: 'pulse', effect: (org) => { org.speed *= 1.5; org.skills.push('pulse'); } },
  spikes: { name: 'Espinhos', icon: '⚡', color: '#FF0066', skill: 'spike', effect: (org) => { org.attack *= 1.8; org.skills.push('spike'); } },
  membrane: { name: 'Membrana', icon: '🛡️', color: '#FF6B00', skill: 'shield', effect: (org) => { org.defense *= 1.6; org.skills.push('shield'); } },
  nucleus: { name: 'Núcleo Vital', icon: '💎', color: '#FFD700', skill: 'drain', effect: (org) => { org.maxHealth += 50; org.skills.push('drain'); } }
};
