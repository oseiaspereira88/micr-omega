# MicrΩ - Plano de Correção de Bugs Visuais e Aprimoramento UI/UX

> **Data de Criação:** 2025-10-24
> **Status:** Em Planejamento
> **Prioridade:** Alta

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Bugs Visuais Identificados](#-bugs-visuais-identificados)
3. [Melhorias de UI](#-melhorias-de-ui)
4. [Melhorias de UX](#-melhorias-de-ux)
5. [Aprimoramentos de Acessibilidade](#-aprimoramentos-de-acessibilidade)
6. [Otimizações de Performance Visual](#-otimizações-de-performance-visual)
7. [Roadmap de Implementação](#-roadmap-de-implementação)

---

## 🎯 Visão Geral

Este plano documenta todos os bugs visuais pendentes e oportunidades de aprimoramento de UI/UX identificados no MicrΩ. O foco principal está em:

- **Responsividade Mobile:** Garantir experiência perfeita em todos os tamanhos de tela
- **Feedback Visual:** Melhorar comunicação de estado e ações do jogador
- **Acessibilidade:** Tornar o jogo utilizável para mais jogadores
- **Polish Visual:** Refinamento de animações e transições
- **Usabilidade:** Reduzir fricção e melhorar discoverability

### Estado Atual da UI/UX

**Pontos Fortes:**
- ✅ Arquitetura responsiva bem estruturada
- ✅ Controles touch personalizáveis (escala, sensibilidade, layout)
- ✅ Implementação ARIA completa para acessibilidade
- ✅ Suporte a safe area insets (notches)
- ✅ Animações polidas com feedback visual

**Áreas de Melhoria:**
- ⚠️ Densidade de informação no HUD em telas pequenas
- ⚠️ Feedback háptico ausente em controles touch
- ⚠️ Falta de gestos alternativos para ações comuns
- ⚠️ Tutoriais de onboarding pouco interativos
- ⚠️ Ausência de indicadores de performance (FPS, latência)

---

## 🐛 Bugs Visuais Identificados

### Prioridade 1 - Críticos (Impedem Jogabilidade)

#### BUG-001: Touch Controls - Sobreposição em Telas Ultra-Pequenas
- **Arquivo:** `web/src/ui/components/TouchControls.module.css`
- **Descrição:** Em dispositivos com width < 350px, botões de ação podem sobrepor o joystick virtual
- **Reprodução:** Testar em iPhone SE (1ª geração) ou similar
- **Impacto:** Dificulta movimento e ataque simultâneo
- **Solução Proposta:**
  - Reduzir `--touch-gap` para 44-48px em telas < 350px
  - Implementar empilhamento vertical mais agressivo
  - Adicionar detecção de colisão para reposicionamento automático
- **Status:** 🔴 Pendente

#### BUG-002: HUD Bar - Overflow Horizontal em Landscape Mobile
- **Arquivo:** `web/src/ui/components/HudBar.jsx`
- **Descrição:** Informações de status transbordam em orientação landscape em dispositivos estreitos
- **Reprodução:** Rotacionar iPhone 12 Pro para landscape
- **Impacto:** Informações cortadas, prejudica decisões táticas
- **Solução Proposta:**
  - Implementar scroll horizontal com fade gradients
  - Priorizar stats críticos (HP, Energy) com ocultação progressiva de secundários
  - Adicionar indicador visual de "mais informações disponíveis"
- **Status:** 🔴 Pendente

### Prioridade 2 - Importantes (Afetam UX)

#### BUG-003: Boss Health Bar - Texto Sobreposto em 320px Width
- **Arquivo:** `web/src/ui/components/BossHealthBar.jsx`
- **Descrição:** Nome do boss e fase sobrepõem em viewports 320px
- **Reprodução:** Galaxy Fold (tela frontal fechada)
- **Impacto:** Informação ilegível durante boss fights
- **Solução Proposta:**
  - Reduzir font-size para clamp(0.7rem, 3vw, 0.9rem)
  - Truncar nome do boss com ellipsis se > 20 caracteres
  - Empilhar verticalmente nome/fase em vez de lado a lado
- **Status:** 🟡 Pendente

#### BUG-004: Skill Wheel - Cooldown Overlay Desalinhado em Alguns Dispositivos
- **Arquivo:** `web/src/ui/components/SkillWheel.jsx`
- **Descrição:** Overlay de cooldown (conic gradient) não centraliza perfeitamente em Safari iOS
- **Reprodução:** Safari iOS 15+, qualquer device
- **Impacto:** Visual polish comprometido
- **Solução Proposta:**
  - Revisar transform origin e positioning do overlay
  - Adicionar vendor prefixes para backdrop-filter
  - Testar em Safari Technology Preview
- **Status:** 🟡 Pendente

#### BUG-005: Touch Controls - Legends Cortadas em Altura Reduzida
- **Arquivo:** `web/src/ui/components/TouchControls.module.css`
- **Descrição:** Legendas de botões (Attack, Dash, etc) cortadas em viewports com height < 600px
- **Reprodução:** Chrome DevTools, iPhone SE horizontal
- **Impacto:** Novos jogadores não sabem função dos botões
- **Solução Proposta:**
  - Ocultar legends em height < 600px
  - Mostrar tooltips on press como alternativa
  - Adicionar toggle de "sempre mostrar legendas" em settings
- **Status:** 🟡 Pendente

### Prioridade 3 - Polish (Melhorias Visuais)

#### BUG-006: GameHud - Sidebar Backdrop Blur Performance
- **Arquivo:** `web/src/ui/components/GameHud.module.css`
- **Descrição:** Backdrop blur de 22px causa frame drops em devices mid-range
- **Reprodução:** Android mid-range (Snapdragon 600 series)
- **Impacto:** Sidebar abre com lag perceptível
- **Solução Proposta:**
  - Reduzir para blur(12px) em devices mobile
  - Usar media query `@media (prefers-reduced-motion)`
  - Fallback para opacity sem blur em low-end devices
- **Status:** 🟢 Pendente

#### BUG-007: Notifications - Z-Index Conflict com Touch Controls
- **Arquivo:** `web/src/ui/components/Notifications.jsx`
- **Descrição:** Notificações críticas aparecem atrás de botões touch em alguns cenários
- **Reprodução:** Receber notificação de "Resisted!" durante combate
- **Impacto:** Feedback importante não visto pelo jogador
- **Solução Proposta:**
  - Aumentar z-index de notificações para acima de touch controls
  - Posicionar notificações no topo central, fora da zona de touch
  - Adicionar animação de slide-in mais pronunciada
- **Status:** 🟢 Pendente

#### BUG-008: Evolution Button - Pulse Animation Causa Reflow
- **Arquivo:** `web/src/ui/components/TouchControls.module.css`
- **Descrição:** Animação de pulse do botão Evolve causa layout shifts
- **Reprodução:** Atingir XP suficiente para evoluir
- **Impacto:** Micro-stutter durante gameplay
- **Solução Proposta:**
  - Usar `transform: scale()` em vez de width/height
  - Adicionar `will-change: transform` para GPU acceleration
  - Conter animação em container com dimensões fixas
- **Status:** 🟢 Pendente

---

## 🎨 Melhorias de UI

### UI-001: Touch Controls - Feedback Visual Aprimorado

**Objetivo:** Tornar feedback de toque mais imediato e satisfatório

**Implementações:**

1. **Ripple Effect nos Botões**
   - Adicionar animação de ripple radial ao tocar botões
   - Cor: `rgba(56, 189, 248, 0.4)` (cyan translúcido)
   - Duração: 400ms com ease-out
   - Arquivo: `TouchControls.module.css`

2. **Long Press Indicator**
   - Adicionar anel de progresso para ações de hold
   - Feedback visual de "charging" para ataques carregados
   - Arquivo: `TouchControls.jsx` + CSS

3. **Cooldown Animations**
   - Melhorar conic gradient de cooldown com easing
   - Adicionar "flash" quando skill fica disponível novamente
   - Transição de cor: red → yellow → green conforme cooldown

4. **Button State Transitions**
   - Suavizar transições entre estados (idle → active → cooldown → disabled)
   - Adicionar micro-bounce ao retornar de pressed state
   - Timing: 180ms cubic-bezier(0.34, 1.56, 0.64, 1)

**Prioridade:** 🟡 Média
**Estimativa:** 6-8 horas
**Dependências:** Nenhuma

---

### UI-002: HUD Bar - Redesign para Densidade de Informação

**Objetivo:** Melhorar legibilidade e hierarquia visual de stats

**Implementações:**

1. **Progressive Disclosure System**
   - Estado Compacto: HP, Energy, Level, Score (sempre visível)
   - Estado Expandido: Badges, Evolution Slots, Resources (toggle)
   - Toggle com ícone de expand/collapse
   - Persistir preferência em localStorage

2. **Visual Hierarchy**
   - HP Bar: Aumentar para 6px height, adicionar gradient pulse quando low (<30%)
   - Energy Bar: Adicionar shimmer effect quando full
   - XP Bar: Mostrar "próximo nível" number ao lado da barra
   - Badges: Limitar a 3 visíveis + counter "+X mais"

3. **Color Coding**
   - HP Critical (<20%): Pulsing red (#ef4444)
   - HP Low (<50%): Orange (#f97316)
   - Energy Full: Bright cyan glow
   - Evolution Ready: Magenta pulse (#ec4899)

4. **Mobile-Specific Layout**
   - Stacking vertical em vez de horizontal em width < 400px
   - Font-size reduction: clamp(0.7rem, 2.5vw, 0.85rem)
   - Icon-only mode para badges em telas pequenas

**Prioridade:** 🔴 Alta
**Estimativa:** 10-12 horas
**Dependências:** Design system color tokens

---

### UI-003: Skill Wheel - Aprimoramento Visual e Usabilidade

**Objetivo:** Tornar skill selection mais intuitiva e visualmente rica

**Implementações:**

1. **Skill Cards Redesign**
   - Adicionar thumbnail visual para cada skill (ícone maior)
   - Background gradient baseado no elemento da skill
   - Border glow quando skill está off cooldown
   - Skill cost badges mais proeminentes

2. **Readiness Indicator**
   - Circular progress wheel mais espesso (6px → 8px)
   - Adicionar percentage text no centro (80%, 100%)
   - Flash animation + haptic ao atingir 100%
   - Gradient colorido: red → yellow → green

3. **Status Effects Preview**
   - Mostrar ícones de status effects que a skill aplica
   - Tooltips on hover/long-press com descrições
   - Badge count para stacks ("Poison x3")

4. **Empty State Improvement**
   - Ilustração visual em vez de texto puro
   - Call-to-action: "Evolua para desbloquear skills"
   - Preview de skills futuras (locked state)

**Prioridade:** 🟡 Média
**Estimativa:** 8-10 horas
**Dependências:** Skill icon assets

---

### UI-004: Boss Health Bar - Enhanced Visual Feedback

**Objetivo:** Tornar boss fights mais épicos e informativos

**Implementações:**

1. **Phase Visualization**
   - Segmentos de health com cores diferentes por fase
   - Fase 1: Cyan → Fase 2: Blue → Fase 3: Purple → Fase 4: Red
   - Separator lines entre fases mais proeminentes
   - Crack animation ao quebrar fase

2. **Enrage State**
   - "Enfurecido!" com pulsing red background
   - Screen shake leve ao entrar em enrage
   - Boss name com efeito de glitch/distortion

3. **Damage Numbers**
   - Floating damage numbers quando jogador acerta
   - Critical hits com scale maior e cor dourada
   - Animate: slide up + fade out (800ms)

4. **Boss Portrait**
   - Adicionar thumbnail do boss à esquerda da barra
   - Frame com glow matching phase color
   - Portrait shake quando boss toma dano pesado

**Prioridade:** 🟢 Baixa (Polish)
**Estimativa:** 6-8 horas
**Dependências:** Boss portrait assets

---

### UI-005: Settings Panel - Organização e Usabilidade

**Objetivo:** Facilitar navegação e descoberta de configurações

**Implementações:**

1. **Category Tabs**
   - Separar em: Gameplay, Controles, Áudio, Vídeo, Acessibilidade
   - Tab navigation com icons
   - Scroll spy para highlight de seção ativa

2. **Search/Filter**
   - Input de busca no topo do panel
   - Filtrar settings por keyword (ex: "volume", "sensitivity")
   - Highlight de matches no texto

3. **Preset Profiles**
   - Presets: "Performance", "Imersão", "Acessibilidade", "Competitivo"
   - Quick switch entre presets
   - Custom preset: salvar configurações atuais com nome

4. **Reset Controls**
   - Reset individual por seção
   - Reset all to defaults (com confirmação)
   - Indicator visual de "modified from default"

5. **Tooltips & Help**
   - Help icon ao lado de cada setting
   - Tooltip explicativo on hover/long-press
   - Exemplos visuais quando aplicável

**Prioridade:** 🟡 Média
**Estimativa:** 12-14 horas
**Dependências:** i18n strings (português)

---

### UI-006: Camera Controls - Visual Enhancement

**Objetivo:** Melhorar feedback visual de zoom e camera settings

**Implementações:**

1. **Zoom Indicator**
   - Visual indicator de nível de zoom (1x, 1.5x, 2x)
   - Minimap com zoom level overlay
   - Smooth transition animation

2. **Camera Shake Settings**
   - Preview de intensidade ao ajustar slider
   - Visual demonstration (shake box animado)
   - Toggle quick: "Sem shake" / "Shake cinemático"

3. **Follow Settings**
   - Dead zone visualization
   - Camera smoothness preview
   - Toggle: "Seguir suave" / "Seguir rígido"

**Prioridade:** 🟢 Baixa
**Estimativa:** 4-6 horas
**Dependências:** Nenhuma

---

## 🎮 Melhorias de UX

### UX-001: Haptic Feedback Integration

**Objetivo:** Adicionar feedback tátil para ações importantes (mobile only)

**Implementações:**

1. **Vibration API Integration**
   - Implementar wrapper `useHapticFeedback.js`
   - Feature detection: `navigator.vibrate`
   - Fallback gracioso em browsers sem suporte

2. **Haptic Patterns**
   - **Light Tap (10ms):** Button press, menu navigation
   - **Medium Tap (25ms):** Attack hit, collectible pickup
   - **Heavy Tap (50ms):** Dash activation, skill cast
   - **Success Pattern ([10, 50, 10]):** Level up, evolution
   - **Warning Pattern ([30, 30, 30]):** Low HP, boss enrage
   - **Error Pattern ([100]):** Invalid action, não tem energia

3. **Settings Integration**
   - Toggle: "Vibração" (on/off)
   - Slider: "Intensidade de Vibração" (0.5x - 1.5x)
   - Test button para preview

4. **Performance Considerations**
   - Debounce rapid events (max 10 vibrations/segundo)
   - Disable durante cutscenes/onboarding
   - Battery saver mode: reduce intensity

**Prioridade:** 🔴 Alta
**Estimativa:** 6-8 horas
**Arquivos:**
- `web/src/hooks/useHapticFeedback.js` (novo)
- `web/src/ui/components/TouchControls.jsx`
- `web/src/ui/components/GameHud.jsx`

---

### UX-002: Gesture Support para Ações Comuns

**Objetivo:** Adicionar gestos alternativos para reduzir dependência de botões

**Implementações:**

1. **Swipe Gestures**
   - **Swipe Up (2 dedos):** Abrir skill wheel
   - **Swipe Down (2 dedos):** Fechar menus
   - **Swipe Left/Right (2 dedos):** Cycle skills
   - **Pinch In:** Zoom out camera
   - **Pinch Out:** Zoom in camera

2. **Gesture Detection**
   - Implementar `useGestureDetector.js` hook
   - Usar Pointer Events API para multi-touch
   - Thresholds configuráveis (min distance, velocity)
   - Visual feedback durante gesture (trail effect)

3. **Gesture Tutorial**
   - First-time overlay mostrando gestos disponíveis
   - Animated hands demonstrando cada gesture
   - Skip button + "não mostrar novamente"
   - Acessível via settings ("Revisar Gestos")

4. **Conflicts Prevention**
   - Disable gestures durante combat se configurado
   - Priority system: touch buttons > gestures
   - Dead zones perto de botões críticos

**Prioridade:** 🟡 Média
**Estimativa:** 10-12 horas
**Arquivos:**
- `web/src/hooks/useGestureDetector.js` (novo)
- `web/src/game/input/useInputController.js`
- `web/src/ui/components/GestureTutorial.jsx` (novo)

---

### UX-003: Onboarding Interativo

**Objetivo:** Tornar tutorial mais engajante e efetivo

**Implementações:**

1. **Interactive Controls Guide**
   - Em vez de tabela estática, permitir "testar controles"
   - Sandbox mode: practice movement, attack, dash
   - Objetivos guiados: "Mova para o alvo", "Ataque 3 vezes"
   - Progress tracking: 5/7 ações completadas

2. **Tooltips Contextuais**
   - First-time tooltips aparecem durante gameplay real
   - "Você pode evoluir!" quando XP suficiente
   - "Tente usar Dash para esquivar!" em boss fight
   - Dismiss + "não mostrar novamente" option

3. **Progressive Skill Introduction**
   - Unlock skills gradualmente durante primeiros níveis
   - Tutorial pop-up quando nova skill disponível
   - Preview de skill com demo visual
   - Incentivo para usar: "Teste sua nova skill Toxic Burst!"

4. **Onboarding Analytics**
   - Track completion rate de cada passo
   - Identify drop-off points
   - A/B test diferentes flows (futuro)

**Prioridade:** 🟡 Média
**Estimativa:** 14-16 horas
**Arquivos:**
- `web/src/ui/onboarding/InteractiveControlsGuide.jsx` (novo)
- `web/src/ui/components/ContextualTooltip.jsx` (novo)
- `web/src/game/systems/tutorialSystem.js` (novo)

---

### UX-004: Visual Feedback para Resource Changes

**Objetivo:** Melhorar awareness de gastos de XP, Energy, Genetic Material

**Implementações:**

1. **Resource Drain Animation**
   - Flash da barra quando recurso consumido
   - Floating "-50 Energy" number no HUD
   - Color code: red para drain, green para gain
   - Shake animation se ação falhar por falta de recurso

2. **Cost Preview**
   - Ao pressionar skill button, highlight cost no HUD
   - Dim button se recursos insuficientes
   - Tooltip: "Precisa de 80 Energy (você tem 50)"

3. **Evolution Affordability**
   - Evolution button:
     - Green pulse: pode evoluir
     - Yellow: quase (80%+ XP)
     - Gray disabled: longe ainda
   - Badge com XP faltante: "150 XP para evoluir"

4. **Resource Gain Celebration**
   - Burst particle effect ao coletar organic matter
   - Sound effect + haptic
   - Combo counter para coletas consecutivas

**Prioridade:** 🔴 Alta
**Estimativa:** 8-10 horas
**Arquivos:**
- `web/src/ui/components/HudBar.jsx`
- `web/src/ui/components/FloatingNumbers.jsx` (novo)
- `web/src/ui/components/TouchControls.jsx`

---

### UX-005: Performance Indicators para Jogadores

**Objetivo:** Dar visibilidade de FPS, latência, e issues de conexão

**Implementações:**

1. **Performance Overlay (Toggle)**
   - FPS counter (top-left corner)
   - Ping/Latency para server (WebSocket)
   - Packet loss indicator
   - Memory usage (opcional, debug only)

2. **Visual States**
   - FPS:
     - Green (>50 fps): Ótimo
     - Yellow (30-50 fps): Aceitável
     - Red (<30 fps): Ruim
   - Ping:
     - Green (<50ms): Excelente
     - Yellow (50-100ms): Bom
     - Orange (100-200ms): Aceitável
     - Red (>200ms): Ruim

3. **Auto-Quality Adjustment**
   - Detectar FPS baixo consistente (<40 fps)
   - Prompt: "Reduzir qualidade gráfica para melhorar performance?"
   - Quick toggles: Disable particles, reduce blur, simplify backgrounds

4. **Network Diagnostics**
   - Connection quality indicator no HUD
   - Warning quando latência alta ou packet loss
   - Auto-reconnect com feedback visual

**Prioridade:** 🟡 Média
**Estimativa:** 8-10 horas
**Arquivos:**
- `web/src/ui/components/PerformanceOverlay.jsx` (novo)
- `web/src/hooks/usePerformanceMonitor.js` (novo)
- `web/src/hooks/useNetworkQuality.js` (novo)

---

### UX-006: Sidebar Swipe-to-Open

**Objetivo:** Permitir abrir sidebar com gesto natural

**Implementações:**

1. **Swipe Detection**
   - Swipe from right edge (>80% viewport width)
   - Minimum swipe distance: 50px
   - Velocity threshold para trigger
   - Works both directions: open + close

2. **Peek Preview**
   - Sidebar segue dedo durante swipe
   - Partial reveal durante gesture
   - Snap to open/close baseado em velocity + distance

3. **Visual Feedback**
   - Edge glow indicator quando perto de trigger zone
   - Pull-to-open arrow hint (first-time only)
   - Elastic bounce se swipe cancelado

4. **Accessibility**
   - Não interferir com touch controls
   - Configurável: disable em settings
   - Dead zone clara: swipe só funciona em edge region

**Prioridade:** 🟢 Baixa
**Estimativa:** 6-8 horas
**Arquivos:**
- `web/src/ui/components/GameHud.jsx`
- `web/src/hooks/useSwipeGesture.js` (novo)

---

## ♿ Aprimoramentos de Acessibilidade

### A11Y-001: High Contrast Mode

**Objetivo:** Melhorar visibilidade para jogadores com baixa visão

**Implementações:**

1. **Color Scheme Overrides**
   - Increase contrast ratios para WCAG AAA (7:1)
   - Background: Pure black (#000)
   - Text: Pure white (#fff)
   - Borders: Bright white (2px thick)
   - Interactive elements: Bright yellow (#ffeb3b)

2. **Outline Enhancements**
   - Thick borders em todos os elementos clicáveis
   - Focus indicators ultra-visíveis (4px yellow)
   - Remove gradients e shadows (flat design)

3. **Toggle Implementation**
   - Settings: "Modo Alto Contraste"
   - Apply CSS class `.high-contrast` to root
   - Persist preference em localStorage
   - Respect `prefers-contrast: high` media query

**Prioridade:** 🟡 Média
**Estimativa:** 6-8 horas
**Arquivos:**
- `web/src/styles/high-contrast.css` (novo)
- `web/src/contexts/SettingsContext.jsx`

---

### A11Y-002: Colorblind-Friendly Status Effects

**Objetivo:** Diferenciar status effects sem depender apenas de cor

**Implementações:**

1. **Icon System**
   - Cada status effect tem ícone único
   - Poison: Skull icon
   - Burn: Flame icon
   - Freeze: Snowflake icon
   - Stun: Lightning icon
   - Slow: Hourglass icon

2. **Pattern Overlays**
   - Adicionar texturas/patterns além de cores
   - Poison: Dots pattern
   - Burn: Diagonal stripes
   - Freeze: Crystalline pattern

3. **Colorblind Simulation Modes**
   - Settings: "Modo Daltônico"
   - Options: Protanopia, Deuteranopia, Tritanopia
   - Apply shader filters (CSS filter or canvas)

4. **Testing**
   - Validar com colorblind simulators
   - Test com jogadores real com daltonismo

**Prioridade:** 🔴 Alta
**Estimativa:** 8-10 horas
**Arquivos:**
- `web/src/ui/components/StatusEffectBadge.jsx` (novo)
- `web/src/styles/colorblind-modes.css` (novo)
- `web/assets/icons/status-effects/` (novos SVGs)

---

### A11Y-003: Customizable Button Layout

**Objetivo:** Permitir jogadores reorganizarem controles touch

**Implementações:**

1. **Drag-and-Drop Interface**
   - Settings: "Personalizar Layout de Botões"
   - Enter edit mode: botões ficam draggable
   - Grid overlay para snap positioning
   - Preview em tempo real

2. **Preset Layouts**
   - Default: Joystick left, buttons right
   - Left-handed: Joystick right, buttons left
   - Compact: Botões agrupados
   - Spread: Máximo espaçamento
   - Custom: Save user layout

3. **Size Customization**
   - Per-button size adjustment (0.5x - 2x)
   - Opacity customization (50% - 100%)
   - Color tint options (para identification)

4. **Export/Import**
   - Share layout code com amigos
   - Import community layouts
   - Cloud sync (futuro)

**Prioridade:** 🟢 Baixa (Nice-to-have)
**Estimativa:** 16-20 horas
**Arquivos:**
- `web/src/ui/components/TouchControlsEditor.jsx` (novo)
- `web/src/contexts/ControlLayoutContext.jsx` (novo)

---

### A11Y-004: Reduced Motion Mode Enhancements

**Objetivo:** Respeitar preferência de animações reduzidas

**Implementações:**

1. **Media Query Implementation**
   - Detect `@media (prefers-reduced-motion: reduce)`
   - Apply CSS class `.reduced-motion` to root
   - Override animations com instantâneas transitions

2. **Selective Animation Disable**
   - Keep critical feedback (health drain, damage taken)
   - Disable decorative animations (pulse, shimmer, float)
   - Reduce particle effects (50% count)
   - Simplify screen shake (eliminate ou reduce 80%)

3. **Settings Override**
   - Manual toggle: "Reduzir Movimentos"
   - Independent de system preference
   - Options: Auto (respect OS), Always, Never

4. **Testing**
   - Validate all transitions work sem motion
   - Ensure feedback ainda é compreensível
   - Performance testing (reduced motion pode ser mais leve)

**Prioridade:** 🟡 Média
**Estimativa:** 6-8 horas
**Arquivos:**
- `web/src/styles/reduced-motion.css` (novo)
- `web/src/game/render/effectsRenderer.js`

---

### A11Y-005: Screen Reader Enhancements

**Objetivo:** Melhorar experiência para screen readers

**Implementações:**

1. **Live Region Announcements**
   - Announce: Level up, evolution, boss spawned
   - Announce: Critical health, skill ready
   - Use `aria-live="assertive"` para urgentes
   - Use `aria-live="polite"` para informativos

2. **Descriptive Labels**
   - All buttons: Clear, action-oriented labels
   - "Atacar (Espaço)" → "Atacar inimigo próximo (tecla Espaço ou toque no botão)"
   - Include state in label: "Dash (em cooldown, 3 segundos restantes)"

3. **Keyboard Navigation Improvements**
   - Full keyboard access a todos os menus
   - Skip links: "Pular para gameplay", "Pular para configurações"
   - Tab order lógico e intuitivo
   - Escape sempre fecha modals/menus

4. **Focus Management**
   - Auto-focus em elementos importantes após screen transitions
   - Focus trap em dialogs modais
   - Restore focus ao fechar modals
   - Visible focus indicators (já implementado, mas revisar)

**Prioridade:** 🟡 Média
**Estimativa:** 8-10 horas
**Arquivos:**
- `web/src/ui/components/LiveAnnouncer.jsx` (novo)
- Todos os componentes UI (atualizar aria-labels)

---

## ⚡ Otimizações de Performance Visual

### PERF-001: Backdrop Filter Optimization

**Objetivo:** Reduzir impacto de backdrop-filter em performance

**Implementações:**

1. **Conditional Blur**
   - Detect device performance (GPU tier)
   - Low-end: Disable blur, use solid background
   - Mid-end: Reduce blur (22px → 8px)
   - High-end: Full blur effects

2. **CSS Containment**
   - Add `contain: layout style paint` to blurred elements
   - Isolate render layers com `will-change: backdrop-filter`
   - Remove blur durante animações (sidebar opening)

3. **Fallback Strategy**
   - `@supports not (backdrop-filter: blur())`: Use solid bg
   - Progressive enhancement approach
   - Feature detection script

**Prioridade:** 🔴 Alta
**Estimativa:** 4-6 horas
**Arquivos:**
- `web/src/ui/components/GameHud.module.css`
- `web/src/utils/devicePerformance.js` (novo)

---

### PERF-002: Animation GPU Acceleration

**Objetivo:** Forçar GPU acceleration para animações críticas

**Implementações:**

1. **Transform-Based Animations**
   - Replace width/height animations com `scale()`
   - Replace top/left com `translate()`
   - Use `transform` e `opacity` exclusivamente

2. **Will-Change Hints**
   - Add `will-change: transform` a elementos animados
   - Remove após animation completa (memory)
   - Strategic placement: buttons, modals, particles

3. **Layer Promotion**
   - Force layer creation: `transform: translateZ(0)`
   - Use `backface-visibility: hidden` para prevent flickering
   - Composite layers: isolate complex animations

**Prioridade:** 🟡 Média
**Estimativa:** 6-8 horas
**Arquivos:**
- Todos os CSS modules com animations

---

### PERF-003: Particle Effect Optimization

**Objetivo:** Melhorar FPS durante efeitos visuais intensos

**Implementações:**

1. **Object Pooling**
   - Reuse particle objects em vez de criar novos
   - Pre-allocate pool de 500 particles
   - Recycle ao invés de destroy

2. **LOD (Level of Detail)**
   - High FPS (>50): Full particle count
   - Medium FPS (30-50): 50% particles
   - Low FPS (<30): 25% particles, simplified rendering

3. **Culling**
   - Não renderizar particles fora da viewport
   - Distance-based culling (too far = skip)
   - Limit concurrent particle systems (max 5)

4. **Simplified Rendering**
   - Use rectangles em vez de circles quando possível
   - Reduce blur/glow em particles
   - Batch draw calls

**Prioridade:** 🟡 Média
**Estimativa:** 10-12 horas
**Arquivos:**
- `web/src/game/render/effectsRenderer.js`
- `web/src/game/systems/ParticlePool.js` (novo)

---

### PERF-004: Canvas Rendering Optimization

**Objetivo:** Otimizar loop de renderização principal

**Implementações:**

1. **Dirty Rectangle Rendering**
   - Só re-render áreas que mudaram
   - Track dirty regions por frame
   - Full redraw só quando necessário (camera move)

2. **Layered Canvas**
   - Separate canvas para background (static)
   - Separate canvas para entities (dynamic)
   - Separate canvas para UI overlay
   - Composite final com minimal redraws

3. **Draw Call Batching**
   - Batch similar entities (all enemies juntos)
   - Minimize context state changes
   - Sort by texture/color para reduce switches

4. **Offscreen Canvas**
   - Pre-render complex shapes to offscreen canvas
   - Reuse cached renders quando possível
   - Invalidate cache só quando entity changes

**Prioridade:** 🟢 Baixa (Optimization)
**Estimativa:** 16-20 horas
**Arquivos:**
- `web/src/game/render/renderFrame.js`
- `web/src/game/render/LayeredRenderer.js` (novo)

---

## 📅 Roadmap de Implementação

### Sprint 1 - Bugs Críticos & Feedback Visual (2 semanas)

**Semana 1:**
- [ ] BUG-001: Touch Controls - Sobreposição em telas ultra-pequenas
- [ ] BUG-002: HUD Bar - Overflow horizontal em landscape
- [ ] UX-001: Haptic Feedback Integration
- [ ] UX-004: Visual Feedback para Resource Changes

**Semana 2:**
- [ ] UI-001: Touch Controls - Feedback Visual Aprimorado
- [ ] A11Y-002: Colorblind-Friendly Status Effects
- [ ] PERF-001: Backdrop Filter Optimization

**Entregáveis:**
- Touch controls totalmente responsivos em todos os devices
- Haptic feedback funcional
- Feedback visual de recursos claro
- Suporte a daltonismo

---

### Sprint 2 - HUD & UI Polish (2 semanas)

**Semana 3:**
- [ ] BUG-003: Boss Health Bar - Texto sobreposto
- [ ] BUG-004: Skill Wheel - Cooldown overlay desalinhado
- [ ] UI-002: HUD Bar - Redesign para densidade de informação
- [ ] UI-003: Skill Wheel - Aprimoramento visual

**Semana 4:**
- [ ] UI-004: Boss Health Bar - Enhanced visual feedback
- [ ] BUG-005: Touch Controls - Legends cortadas
- [ ] BUG-007: Notifications - Z-index conflict

**Entregáveis:**
- HUD otimizado para mobile
- Skill wheel visualmente polido
- Boss fights mais épicos
- Zero overlapping visual bugs

---

### Sprint 3 - UX & Gestures (2 semanas)

**Semana 5:**
- [ ] UX-002: Gesture Support para ações comuns
- [ ] UX-003: Onboarding Interativo
- [ ] UI-005: Settings Panel - Organização

**Semana 6:**
- [ ] UX-005: Performance Indicators
- [ ] UX-006: Sidebar Swipe-to-Open
- [ ] BUG-006: Sidebar backdrop blur performance

**Entregáveis:**
- Sistema de gestos funcional
- Onboarding interativo
- Settings panel reorganizado
- Performance overlay para debugging

---

### Sprint 4 - Acessibilidade & Performance (2 semanas)

**Semana 7:**
- [ ] A11Y-001: High Contrast Mode
- [ ] A11Y-004: Reduced Motion Mode Enhancements
- [ ] A11Y-005: Screen Reader Enhancements

**Semana 8:**
- [ ] PERF-002: Animation GPU Acceleration
- [ ] PERF-003: Particle Effect Optimization
- [ ] BUG-008: Evolution button pulse animation reflow

**Entregáveis:**
- Modo alto contraste
- Suporte completo a reduced motion
- Screen reader melhorado
- Performance otimizada

---

### Sprint 5 - Polish & Nice-to-Haves (1-2 semanas)

**Semana 9-10:**
- [ ] UI-006: Camera Controls - Visual enhancement
- [ ] A11Y-003: Customizable Button Layout (se tempo permitir)
- [ ] PERF-004: Canvas Rendering Optimization (se tempo permitir)
- [ ] Testing abrangente em devices reais
- [ ] Bug fixes finais

**Entregáveis:**
- Todos os items de polish concluídos
- Testing completo
- Documentação atualizada
- Release candidate

---

## 📊 Métricas de Sucesso

### Performance
- [ ] FPS médio >50 em devices mid-range (Snapdragon 600 series)
- [ ] Frame time <16ms (60 FPS target) em 90% do gameplay
- [ ] Sidebar opening <200ms em todos os devices
- [ ] Touch input latency <50ms

### Usabilidade
- [ ] 90% dos novos jogadores completam onboarding
- [ ] Tempo médio para entender controles <2 minutos
- [ ] Taxa de erro em ações touch <5%
- [ ] Satisfação com controles touch >4/5 em survey

### Acessibilidade
- [ ] WCAG 2.1 Level AA compliance
- [ ] Keyboard navigation completa em todos os menus
- [ ] Screen reader suportado em elementos críticos
- [ ] Contraste mínimo 4.5:1 em texto (7:1 em high contrast mode)

### Bugs Visuais
- [ ] Zero overlap issues em devices 320px-428px width
- [ ] Zero text truncation em landscape orientation
- [ ] 100% dos elementos clicáveis têm 44x44px touch target

---

## 🛠️ Ferramentas e Testing

### Devices para Testing Real
- **iOS:** iPhone SE (1st gen), iPhone 12 Pro, iPad Air
- **Android:** Samsung Galaxy S21, Pixel 5, Budget device (Snapdragon 600)
- **Browsers:** Chrome, Safari, Firefox, Samsung Internet

### Testing Tools
- Chrome DevTools Device Emulation
- BrowserStack para cross-device testing
- Lighthouse para accessibility audits
- WebPageTest para performance profiling
- Color Oracle para colorblind simulation

### Accessibility Testing
- NVDA screen reader (Windows)
- VoiceOver (iOS/macOS)
- Axe DevTools browser extension
- WAVE accessibility tool

---

## 📝 Notas de Implementação

### Guidelines de Código

1. **Performance:**
   - Always prefer `transform` e `opacity` para animations
   - Use `will-change` strategically (e remova após animation)
   - Debounce rapid events (resize, scroll, input)
   - Lazy load componentes não-críticos

2. **Acessibilidade:**
   - Sempre adicionar `aria-label` em elementos interativos
   - Usar `role` apropriado para elementos customizados
   - Garantir keyboard navigation lógica
   - Test com screen readers durante development

3. **Responsividade:**
   - Mobile-first CSS approach
   - Use `clamp()` para responsive sizing
   - Test em viewports 320px - 1920px width
   - Considerar safe area insets sempre

4. **Testing:**
   - Unit tests para utility functions
   - Integration tests para hooks complexos
   - Visual regression tests para components críticos
   - Manual testing em devices reais antes de merge

### Convenções de Naming

- **CSS Classes:** BEM methodology (`block__element--modifier`)
- **Components:** PascalCase (`TouchControls.jsx`)
- **Hooks:** camelCase com `use` prefix (`useHapticFeedback.js`)
- **Utilities:** camelCase (`devicePerformance.js`)

### Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `perf:`, `a11y:`
- Reference issue numbers: `fix: BUG-001 - Touch controls overlap`
- Include before/after screenshots para UI changes

---

## 🔗 Referências e Recursos

### Design Inspiration
- [Material Design Motion](https://m3.material.io/styles/motion/overview)
- [Apple HIG - Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
- [Game UI Database](https://www.gameuidatabase.com/)

### Acessibilidade
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Inclusive Components](https://inclusive-components.design/)

### Performance
- [Web.dev Performance](https://web.dev/performance/)
- [CSS Triggers](https://csstriggers.com/)
- [HTML5 Canvas Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

---

**Última Atualização:** 2025-10-24
**Próxima Revisão:** Após Sprint 1

---

## ✅ Quick Actions

```bash
# Iniciar Sprint 1
git checkout -b sprint-1/bugs-and-feedback

# Run development
npm run dev:worker
npm run dev:web

# Testing
npm run test -w web
npm run lint
```
