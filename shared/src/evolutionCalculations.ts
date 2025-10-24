/**
 * Configuração e cálculo centralizado de diminishing returns para evoluções.
 *
 * Esta implementação garante que cliente e servidor usem exatamente a mesma
 * lógica para calcular multiplicadores de evolução, evitando dessincronia.
 */

export interface DiminishingConfig {
  rate: number;
  minimum: number;
}

/**
 * Configurações padrão de diminishing returns por tier.
 *
 * Padronizado em rate=0.6 e minimum=0.2 para todas as tiers,
 * mas permite override por evolução individual.
 */
export const DIMINISHING_CONFIGS: Record<string, DiminishingConfig> = {
  small: { rate: 0.6, minimum: 0.2 },
  medium: { rate: 0.6, minimum: 0.2 },
  large: { rate: 0.6, minimum: 0.2 },
  macro: { rate: 0.6, minimum: 0.2 },
};

/**
 * Calcula o multiplicador de diminishing returns para uma evolução.
 *
 * @param previousPurchases - Número de vezes que a evolução foi comprada anteriormente
 * @param tier - Tier da evolução ('small', 'medium', 'large', 'macro')
 * @param customRate - Taxa de diminuição customizada (opcional, usa padrão do tier)
 * @param customMinimum - Multiplicador mínimo customizado (opcional, usa padrão do tier)
 * @returns Multiplicador entre 0 e 1, nunca menor que o mínimo configurado
 *
 * @example
 * // Primeira compra (sem diminuição)
 * calculateDiminishingMultiplier(0, 'small') // 1.0
 *
 * // Segunda compra (rate=0.6)
 * calculateDiminishingMultiplier(1, 'small') // 0.6
 *
 * // Terceira compra
 * calculateDiminishingMultiplier(2, 'small') // 0.36
 *
 * // Com custom rate
 * calculateDiminishingMultiplier(1, 'small', 0.8, 0.3) // 0.8
 */
export function calculateDiminishingMultiplier(
  previousPurchases: number,
  tier: string,
  customRate?: number,
  customMinimum?: number
): number {
  // Primeira compra não tem diminuição
  if (previousPurchases <= 0) {
    return 1;
  }

  // Usar configuração customizada ou padrão do tier
  const config = DIMINISHING_CONFIGS[tier];
  const rate = customRate ?? config?.rate ?? 0.6;
  const minimum = customMinimum ?? config?.minimum ?? 0.2;

  // Calcular diminuição exponencial: rate^purchases
  const scaled = rate ** previousPurchases;

  // Garantir que nunca fique abaixo do mínimo
  return Math.max(minimum, scaled);
}
