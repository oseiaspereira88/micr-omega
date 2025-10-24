# Plano de Correção: Sistema de Evolução de Personagens

## Visão Geral

Este plano corrige todos os problemas críticos, de alta e média prioridade identificados no sistema de evolução, incluindo bugs de sincronização cliente-servidor, inconsistências de multiplicadores, problemas de UI/UX e edge cases.

## Estrutura do Plano

### Fase 1: Correções Críticas (Bloqueadores de Gameplay)

**Tempo estimado: 4-6 horas**

1. **Corrigir Multiplicadores 200x Menores no Servidor**
   - Remover divisão por 100 em `playerManager.ts:478`
   - Sincronizar cálculo de multiplicadores com cliente
   - Adicionar testes de integração

2. **Implementar Proteção Contra Dupla Evolução**
   - Adicionar sequence number em mensagens de evolução
   - Implementar debounce no botão de evolução
   - Adicionar lock de estado durante processamento

3. **Corrigir Race Condition em Reconexão**
   - Adicionar flag de evolução pendente no estado
   - Sincronizar estado completo ao reconectar
   - Validar estado de evolução no handshake

### Fase 2: Sincronização Cliente-Servidor

**Tempo estimado: 5-7 horas**

4. **Centralizar Cálculo de Diminishing Returns**
   - Criar arquivo shared para lógica de multiplicadores
   - Mover `diminishingMultiplier` para shared
   - Garantir mesmo cálculo em cliente e servidor

5. **Adicionar Validação de Requisitos no Servidor**
   - Implementar `validateEvolutionRequirements()` no worker
   - Validar level, recursos, slots antes de aplicar
   - Retornar erro específico ao cliente

6. **Sincronizar Histórico de Evolução**
   - Adicionar histórico completo em state sync
   - Implementar merge strategy para reconexões
   - Limitar histórico a últimas 100 evoluções

### Fase 3: Correções de UI/UX

**Tempo estimado: 3-4 horas**

7. **Corrigir Estado do Botão de Evolução**
   - Refatorar lógica de `canEvolve` para ser computed property
   - Adicionar validação de opções disponíveis
   - Melhorar feedback visual de estados

8. **Adicionar Pausa Durante Evolução em Combate**
   - Pausar game loop quando menu de evolução abre
   - Adicionar overlay bloqueando interações
   - Resumir jogo após escolha

9. **Prevenir Travamento do Menu**
   - Adicionar try-catch em `entry.effect()`
   - Implementar timeout para fechar menu automaticamente
   - Adicionar botão de cancelamento sempre visível

### Fase 4: Performance e Otimizações

**Tempo estimado: 2-3 horas**

10. **Otimizar Recálculo de Opções**
    - Memoizar `buildEvolutionOptions` com base em dependencies
    - Cachear opções disponíveis por tier
    - Invalidar cache apenas em mudanças relevantes

11. **Limitar Crescimento do Histórico**
    - Implementar LRU para histórico de evolução
    - Manter apenas últimas 100 evoluções
    - Agregar contadores antigos

### Fase 5: Edge Cases e Robustez

**Tempo estimado: 2-3 horas**

12. **Tratar Evolução Durante Morte**
    - Cancelar menu de evolução ao morrer
    - Preservar fila de progressão até próximo levelup
    - Restaurar estado corretamente após restart

13. **Validar Macro Evolution Slots**
    - Adicionar migração para jogadores antigos
    - Inicializar `macroEvolutionSlots` se ausente
    - Validar compatibilidade retroativa

---

## Detalhamento das Correções

### 1. Corrigir Multiplicadores 200x Menores no Servidor

**Arquivo:** `worker/src/playerManager.ts:472-481`

**Problema:**
```typescript
// ANTES - ERRADO
const effectiveMultiplier = 1 + multiplier / 100;  // Divide por 100!
```

**Solução:**
```typescript
// DEPOIS - CORRETO
const effectiveMultiplier = 1 + multiplier;  // Sem divisão
```

**Validação:** Adicionar teste comparando stats cliente vs servidor após evolução

**Arquivos modificados:**
- `worker/src/playerManager.ts`

---

### 2. Implementar Proteção Contra Dupla Evolução

**Arquivos:**
- `web/src/game/systems/progression.js`
- `worker/src/RoomDO.ts`
- `shared/src/messageTypes.ts`

**Mudanças:**

#### a) Adicionar sequence number em mensagens:
```typescript
// shared/src/messageTypes.ts
export interface EvolutionMessage extends ClientMessage {
  type: 'evolution';
  evolutionId: string;
  tier: EvolutionTier;
  sequenceNumber: number;  // NOVO
}
```

#### b) Adicionar lock no cliente:
```javascript
// web/src/game/systems/progression.js
let evolutionInProgress = false;

export const chooseEvolution = (state, helpers, tier, key) => {
  if (evolutionInProgress) {
    console.warn('Evolution already in progress');
    return;
  }

  evolutionInProgress = true;

  try {
    // ... lógica existente ...
    helpers.sendEvolution?.(tier, key, Date.now()); // sequenceNumber
  } finally {
    setTimeout(() => {
      evolutionInProgress = false;
    }, 1000); // Timeout de segurança
  }
};
```

#### c) Validar sequence no servidor:
```typescript
// worker/src/RoomDO.ts
private lastEvolutionSequence: Map<string, number> = new Map();

handleEvolutionAction(playerId: string, action: EvolutionMessage) {
  const lastSeq = this.lastEvolutionSequence.get(playerId) || 0;

  if (action.sequenceNumber <= lastSeq) {
    // Duplicada, ignorar
    return { success: false, reason: 'duplicate' };
  }

  this.lastEvolutionSequence.set(playerId, action.sequenceNumber);
  // ... aplicar evolução ...
}
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`
- `worker/src/RoomDO.ts`
- `shared/src/messageTypes.ts`

---

### 3. Corrigir Race Condition em Reconexão

**Arquivo:** `web/src/hooks/useGameSocket.ts`

**Mudanças:**

#### a) Adicionar flag de evolução pendente:
```typescript
// Após reconectar, verificar se havia evolução pendente
case 'joined': {
  const serverState = message.state;
  const localPendingEvolution = gameStore.getState().evolutionContext;

  if (localPendingEvolution && !serverState.showEvolutionChoice) {
    // Servidor não tem evolução pendente, limpar local
    gameStore.actions.cancelEvolutionChoice();
  } else if (!localPendingEvolution && serverState.canEvolve) {
    // Servidor tem evolução disponível, sincronizar
    gameStore.actions.syncEvolutionState(serverState);
  }
}
```

**Arquivos modificados:**
- `web/src/hooks/useGameSocket.ts`
- `web/src/store/gameStore.js`

---

### 4. Centralizar Cálculo de Diminishing Returns

**Arquivo novo:** `shared/src/evolutionCalculations.ts`

**Criar função compartilhada:**
```typescript
// shared/src/evolutionCalculations.ts
export interface DiminishingConfig {
  rate: number;
  minimum: number;
}

export const DIMINISHING_CONFIGS: Record<EvolutionTier, DiminishingConfig> = {
  small: { rate: 0.6, minimum: 0.2 },
  medium: { rate: 0.6, minimum: 0.2 },  // PADRONIZADO
  large: { rate: 0.6, minimum: 0.2 },   // PADRONIZADO
};

export function calculateDiminishingMultiplier(
  previousPurchases: number,
  tier: EvolutionTier
): number {
  if (previousPurchases <= 0) return 1;

  const config = DIMINISHING_CONFIGS[tier];
  return Math.max(config.minimum, config.rate ** previousPurchases);
}
```

**Usar em cliente e servidor:**
```javascript
// web/src/game/config/smallEvolutions.js
import { calculateDiminishingMultiplier } from '@micr-omega/shared';

const multiplier = calculateDiminishingMultiplier(
  context.previousPurchases,
  'small'
);

// worker/src/playerManager.ts
import { calculateDiminishingMultiplier } from '@micr-omega/shared';

const multiplier = calculateDiminishingMultiplier(
  history[tier][evolutionId] || 0,
  tier
);
```

**Arquivos novos:**
- `shared/src/evolutionCalculations.ts`

**Arquivos modificados:**
- `web/src/game/config/smallEvolutions.js`
- `web/src/game/config/mediumEvolutions.js`
- `web/src/game/config/majorEvolutions.js`
- `worker/src/playerManager.ts`

---

### 5. Adicionar Validação de Requisitos no Servidor

**Arquivo:** `worker/src/evolutionValidator.ts` (novo)

**Criar validador:**
```typescript
// worker/src/evolutionValidator.ts
export interface EvolutionRequirements {
  level?: number;
  organicMatter?: number;
  slots?: boolean;
}

export function validateEvolutionRequirements(
  playerState: PlayerState,
  evolution: EvolutionDefinition,
  tier: EvolutionTier
): { valid: boolean; reason?: string } {

  // Validar nível
  if (evolution.requirements?.level && playerState.level < evolution.requirements.level) {
    return { valid: false, reason: 'insufficient_level' };
  }

  // Validar recursos
  const cost = evolution.cost || 0;
  if (playerState.organicMatter < cost) {
    return { valid: false, reason: 'insufficient_resources' };
  }

  // Validar slots
  const slots = playerState.evolutionSlots?.[tier];
  if (!slots || slots.used >= slots.max) {
    return { valid: false, reason: 'no_slots_available' };
  }

  return { valid: true };
}
```

**Usar no RoomDO:**
```typescript
// worker/src/RoomDO.ts
import { validateEvolutionRequirements } from './evolutionValidator';

handleEvolutionAction(playerId: string, action: EvolutionMessage) {
  const player = this.players.get(playerId);
  const evolution = this.getEvolutionDefinition(action.evolutionId, action.tier);

  const validation = validateEvolutionRequirements(player, evolution, action.tier);
  if (!validation.valid) {
    return this.sendErrorToPlayer(playerId, validation.reason);
  }

  // ... aplicar evolução ...
}
```

**Arquivos novos:**
- `worker/src/evolutionValidator.ts`

**Arquivos modificados:**
- `worker/src/RoomDO.ts`

---

### 6. Sincronizar Histórico de Evolução

**Arquivo:** `worker/src/playerManager.ts`

**Mudanças:**

#### a) Limitar histórico a 100 evoluções mais recentes:
```typescript
function pruneEvolutionHistory(history: EvolutionHistory): EvolutionHistory {
  const MAX_ENTRIES = 100;

  for (const tier of ['small', 'medium', 'large'] as const) {
    const entries = Object.entries(history[tier]);

    if (entries.length > MAX_ENTRIES) {
      // Manter apenas as 100 mais usadas
      const sorted = entries.sort(([, a], [, b]) => b - a);
      history[tier] = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
    }
  }

  return history;
}
```

#### b) Sincronizar em reconnect:
```typescript
// Ao enviar estado completo em 'joined' message
state: {
  ...playerState,
  evolutionHistory: pruneEvolutionHistory(playerState.evolutionHistory),
}
```

**Arquivos modificados:**
- `worker/src/playerManager.ts`
- `worker/src/RoomDO.ts`

---

### 7. Corrigir Estado do Botão de Evolução

**Arquivo:** `web/src/game/systems/progression.js`

**Refatorar para computed property:**
```javascript
export function computeCanEvolve(state) {
  // Verificar se há tiers na fila
  if (state.progressionQueue?.length === 0) {
    return false;
  }

  // Verificar se há pelo menos uma opção válida em algum tier
  const tiers = ['small', 'medium', 'large'];
  for (const tier of tiers) {
    const options = buildEvolutionOptions(state, {}, tier);
    if (options.length > 0) {
      return true;
    }
  }

  return false;
}

// Usar em updateGameState
export function checkEvolution(state, helpers) {
  state.canEvolve = computeCanEvolve(state);
  // ... resto da lógica ...
}
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`

---

### 8. Adicionar Pausa Durante Evolução

**Arquivo:** `web/src/game/engine/useGameLoop.js`

**Mudanças:**
```javascript
// useGameLoop.js
const isPaused = useRef(false);

// Modificar loop principal
const gameLoop = (timestamp) => {
  if (isPaused.current) {
    frameIdRef.current = requestAnimationFrame(gameLoop);
    return; // Não atualizar estado
  }

  // ... resto do loop ...
};

// Exportar controle de pausa
export const pauseGame = () => {
  isPaused.current = true;
};

export const resumeGame = () => {
  isPaused.current = false;
};
```

**Em GameCanvas:**
```javascript
// GameCanvas.jsx
import { pauseGame, resumeGame } from './engine/useGameLoop';

useEffect(() => {
  if (showEvolutionChoice) {
    pauseGame();
  } else {
    resumeGame();
  }
}, [showEvolutionChoice]);
```

**Arquivos modificados:**
- `web/src/game/engine/useGameLoop.js`
- `web/src/game/engine/GameCanvas.jsx`

---

### 9. Prevenir Travamento do Menu

**Arquivo:** `web/src/game/systems/progression.js`

**Adicionar proteções:**
```javascript
export const chooseEvolution = (state, helpers, tier, key) => {
  try {
    const entry = getEvolutionEntry(tier, key);

    if (!entry || !entry.effect) {
      throw new Error(`Invalid evolution: ${tier}/${key}`);
    }

    // Timeout de segurança
    const timeoutId = setTimeout(() => {
      console.error('Evolution effect timeout');
      closeEvolutionMenu(state, helpers);
    }, 5000);

    entry.effect(state, helpers);

    clearTimeout(timeoutId);
    closeEvolutionMenu(state, helpers);

  } catch (error) {
    console.error('Evolution effect error:', error);

    // Garantir que menu fecha mesmo em erro
    closeEvolutionMenu(state, helpers);

    // Notificar usuário
    helpers.showNotification?.({
      message: 'Erro ao aplicar evolução. Tente novamente.',
      type: 'error'
    });
  }
};
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`

---

### 10. Otimizar Recálculo de Opções

**Arquivo:** `web/src/game/systems/progression.js`

**Adicionar memoization:**
```javascript
// Cache de opções
const evolutionOptionsCache = new Map();

function getCacheKey(state, tier) {
  return `${tier}-${state.level}-${state.organicMatter}-${JSON.stringify(state.evolutionSlots)}`;
}

export function buildEvolutionOptions(state, helpers, tier) {
  const cacheKey = getCacheKey(state, tier);

  if (evolutionOptionsCache.has(cacheKey)) {
    return evolutionOptionsCache.get(cacheKey);
  }

  const options = computeEvolutionOptions(state, helpers, tier);

  // Limitar cache a 20 entries
  if (evolutionOptionsCache.size > 20) {
    const firstKey = evolutionOptionsCache.keys().next().value;
    evolutionOptionsCache.delete(firstKey);
  }

  evolutionOptionsCache.set(cacheKey, options);
  return options;
}

// Invalidar cache quando relevante
export function invalidateEvolutionCache() {
  evolutionOptionsCache.clear();
}
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`

---

### 11. Limitar Crescimento do Histórico

Implementação já coberta na **Correção #6**

---

### 12. Tratar Evolução Durante Morte

**Arquivo:** `web/src/game/systems/progression.js`

**Mudanças:**
```javascript
export const restartGame = (state, helpers) => {
  // Salvar fila de progressão
  const savedQueue = [...(state.progressionQueue || [])];

  // Reset de estado
  Object.assign(state, {
    level: 1,
    xp: 0,
    // ... outros resets ...
  });

  // Cancelar menu de evolução se aberto
  if (state.showEvolutionChoice) {
    closeEvolutionMenu(state, helpers);
  }

  // Restaurar fila para próximo levelup
  // (será consumida quando atingir nível apropriado)
  state.progressionQueuePending = savedQueue;

  // Limpar evolução atual
  state.evolutionContext = null;
  state.canEvolve = false;
};

// Ao fazer levelup, verificar fila pendente
export const handleLevelUp = (state, helpers, newLevel) => {
  // ... lógica existente ...

  // Restaurar fila pendente se houver
  if (state.progressionQueuePending?.length > 0) {
    state.progressionQueue = [...state.progressionQueuePending];
    state.progressionQueuePending = [];
    state.canEvolve = true;
  }
};
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`

---

### 13. Validar Macro Evolution Slots

**Arquivo:** `web/src/game/systems/progression.js`

**Adicionar migração:**
```javascript
export function ensureMacroEvolutionSlots(state) {
  if (!state.macroEvolutionSlots) {
    state.macroEvolutionSlots = {
      used: 0,
      max: Math.floor(state.level / 10) || 1, // 1 macro slot a cada 10 níveis
    };
  }

  // Atualizar max baseado em nível atual
  const expectedMax = Math.floor(state.level / 10) || 1;
  if (state.macroEvolutionSlots.max < expectedMax) {
    state.macroEvolutionSlots.max = expectedMax;
  }
}

// Chamar em checkEvolution
export function checkEvolution(state, helpers) {
  ensureMacroEvolutionSlots(state);
  // ... resto da lógica ...
}
```

**Arquivos modificados:**
- `web/src/game/systems/progression.js`

---

## Ordem de Execução

1. **Fase 1 - Críticos (prioridade máxima):**
   - Correção #1: Multiplicadores no servidor
   - Correção #2: Proteção dupla evolução
   - Correção #3: Race condition reconexão

2. **Fase 2 - Sincronização (alta prioridade):**
   - Correção #4: Centralizar cálculos
   - Correção #5: Validação servidor
   - Correção #6: Sincronizar histórico

3. **Fase 3 - UI/UX (média prioridade):**
   - Correção #7: Estado do botão
   - Correção #8: Pausa durante evolução
   - Correção #9: Prevenir travamento

4. **Fase 4 - Performance (média prioridade):**
   - Correção #10: Otimizar recálculo

5. **Fase 5 - Edge Cases (baixa prioridade):**
   - Correção #12: Evolução durante morte
   - Correção #13: Macro evolution slots

---

## Arquivos Impactados

### Novos Arquivos

- `shared/src/evolutionCalculations.ts`
- `worker/src/evolutionValidator.ts`

### Arquivos Modificados

**Shared:**
- `shared/src/messageTypes.ts`

**Worker:**
- `worker/src/playerManager.ts`
- `worker/src/RoomDO.ts`

**Web:**
- `web/src/game/systems/progression.js`
- `web/src/game/config/smallEvolutions.js`
- `web/src/game/config/mediumEvolutions.js`
- `web/src/game/config/majorEvolutions.js`
- `web/src/game/engine/useGameLoop.js`
- `web/src/game/engine/GameCanvas.jsx`
- `web/src/hooks/useGameSocket.ts`
- `web/src/store/gameStore.js`

---

## Testes Recomendados

### Testes Unitários

1. `evolutionCalculations.test.ts` - Validar cálculos de diminishing
2. `evolutionValidator.test.ts` - Validar requisitos
3. `progression.test.js` - Testar lógica de evolução

### Testes de Integração

1. **Cliente-Servidor:** Stats após evolução devem ser idênticos
2. **Reconexão:** Estado de evolução preservado
3. **Race conditions:** Duplo clique não duplica evolução

### Testes Manuais

1. Evoluir durante combate com boss
2. Morrer durante escolha de evolução
3. Desconectar durante evolução
4. Múltiplas evoluções rápidas

---

## Critérios de Sucesso

- ✅ Multiplicadores cliente e servidor idênticos (±0.01)
- ✅ Sem duplicação de evoluções em qualquer cenário
- ✅ Histórico sincronizado após reconexão
- ✅ Botão de evolução sempre reflete estado correto
- ✅ Menu não trava em erros
- ✅ Jogo pausa durante evolução em combate
- ✅ Performance: menu abre em < 100ms
- ✅ Sem crashes relacionados a evolução
- ✅ Jogadores antigos migrados corretamente

---

## Tempo Total Estimado

**16-25 horas** de desenvolvimento e testes, distribuídas em 5 fases progressivas.