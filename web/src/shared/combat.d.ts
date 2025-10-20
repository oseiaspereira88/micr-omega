export type ElementType =
  | 'bio'
  | 'chemical'
  | 'acid'
  | 'thermal'
  | 'electric'
  | 'kinetic'
  | 'psionic'
  | 'sonic';

export interface StatusAuraDefinition {
  /**
   * Alcance visual em unidades de jogo. Valores entre 48 e 96 criam halos fáceis de ler.
   */
  radius?: number;
  /**
   * Paleta de cores CSS usada no gradiente do efeito. Pode ser vazia para reutilizar a cor base.
   */
  colors?: string[];
  /**
   * Intensidade do deslocamento de ondas no contorno animado.
   */
  waveAmplitude?: number;
  /**
   * Velocidade angular do giro em radianos/segundo.
   */
  rotationSpeed?: number;
  /**
   * Curva normalizada aplicada ao brilho pulsante (0 a 1).
   */
  intensityCurve?: number[];
}

export interface StatusDefinition {
  label: string;
  icon: string;
  color: string;
  category: string;
  duration: number;
  maxStacks: number;
  effect?: string;
  synergy?: { element: ElementType; bonus: number };
  dot?: { element: ElementType; damagePerSecond: number };
  defensePenaltyPerStack?: number;
  movementPenaltyPerStack?: number;
  criticalBonusPerStack?: number;
  controlWeight?: number;
  aura?: StatusAuraDefinition;
}

export declare const ELEMENT_TYPES: Readonly<Record<string, ElementType>>;
export declare const STATUS_EFFECTS: Readonly<Record<string, string>>;
export declare const STATUS_METADATA: Readonly<Record<string, StatusDefinition>>;
