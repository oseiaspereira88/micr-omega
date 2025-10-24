/**
 * Validação server-side de requisitos de evolução.
 *
 * Esta validação é crítica para prevenir exploits onde o cliente
 * poderia burlar as validações locais e evoluir sem requisitos.
 */

import type { PlayerInternal } from './playerManager';
import { computeEvolutionSlotsForPlayer } from './playerManager';
import { getPlayerLevelFromXp } from './progression';
import type { EvolutionTier } from './types';

export interface EvolutionRequirements {
  level?: number;
  mg?: number;
  fragments?: Record<string, number>;
  stableGenes?: Record<string, number>;
}

export interface EvolutionCost {
  pc?: number;
  mg?: number;
  fragments?: Record<string, number>;
  stableGenes?: Record<string, number>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Valida se um jogador atende todos os requisitos para uma evolução.
 *
 * @param player - Estado interno do jogador
 * @param requirements - Requisitos da evolução (level mínimo, recursos, etc)
 * @param cost - Custo da evolução (pontos, MG, fragmentos, genes)
 * @param tier - Tier da evolução para validar slots disponíveis
 * @returns Resultado da validação com flag e motivo de falha (se houver)
 */
export function validateEvolutionRequirements(
  player: PlayerInternal,
  requirements?: EvolutionRequirements | null,
  cost?: EvolutionCost | null,
  tier?: EvolutionTier | string
): ValidationResult {
  // Validar level mínimo
  if (requirements?.level) {
    const currentLevel = getPlayerLevelFromXp(player.xp);
    if (currentLevel < requirements.level) {
      return { valid: false, reason: 'insufficient_level' };
    }
  }

  // Validar custo de material genético
  if (cost?.mg && player.geneticMaterial < cost.mg) {
    return { valid: false, reason: 'insufficient_genetic_material' };
  }

  // Validar custo de pontos de característica
  if (cost?.pc) {
    const availablePoints = player.characteristicPoints?.available ?? 0;
    if (availablePoints < cost.pc) {
      return { valid: false, reason: 'insufficient_characteristic_points' };
    }
  }

  // Validar fragmentos de genes (requisitos)
  if (requirements?.fragments) {
    for (const [fragmentKey, requiredAmount] of Object.entries(requirements.fragments)) {
      const playerAmount = (player.geneFragments as any)?.[fragmentKey] ?? 0;
      if (playerAmount < requiredAmount) {
        return { valid: false, reason: `insufficient_fragments_${fragmentKey}` };
      }
    }
  }

  // Validar fragmentos de genes (custo)
  if (cost?.fragments) {
    for (const [fragmentKey, costAmount] of Object.entries(cost.fragments)) {
      const playerAmount = (player.geneFragments as any)?.[fragmentKey] ?? 0;
      if (playerAmount < costAmount) {
        return { valid: false, reason: `insufficient_fragments_${fragmentKey}` };
      }
    }
  }

  // Validar genes estáveis (requisitos)
  if (requirements?.stableGenes) {
    for (const [geneKey, requiredAmount] of Object.entries(requirements.stableGenes)) {
      const playerAmount = (player.stableGenes as any)?.[geneKey] ?? 0;
      if (playerAmount < requiredAmount) {
        return { valid: false, reason: `insufficient_stable_genes_${geneKey}` };
      }
    }
  }

  // Validar genes estáveis (custo)
  if (cost?.stableGenes) {
    for (const [geneKey, costAmount] of Object.entries(cost.stableGenes)) {
      const playerAmount = (player.stableGenes as any)?.[geneKey] ?? 0;
      if (playerAmount < costAmount) {
        return { valid: false, reason: `insufficient_stable_genes_${geneKey}` };
      }
    }
  }

  // Validar slots disponíveis
  if (tier && (tier === 'small' || tier === 'medium' || tier === 'large' || tier === 'macro')) {
    const slots = computeEvolutionSlotsForPlayer(player);
    const tierSlots = slots[tier as EvolutionTier];

    if (!tierSlots || tierSlots.used >= tierSlots.max) {
      return { valid: false, reason: 'no_slots_available' };
    }
  }

  return { valid: true };
}
