# MicrΩ Roadmap: Evolução, Elementos e Combate Dinâmico

Este roadmap organiza a implementação progressiva do novo sistema de evolução e combate, integrando os pilares de recursos (Energia, XP, Material Genético), árvore evolutiva em três tamanhos, elementos em laço "pedra-papel-tesoura" (Radiação ☀️, Estrutural 🪨, Química 🧪, Mobilidade 💨) e o ecossistema de combate reativo entre NPCs e jogador.

Cada fase pode corresponder a um sprint completo; as entregas dentro da fase são listadas em ordem de execução recomendada.

## Visão geral das fases

| Fase | Objetivo macro | Entregas principais | Pré-requisitos |
| --- | --- | --- | --- |
| 1. Fundamentos de recursos e progressão | Separar Economia (Energia, XP, MG), estruturar Pontos de Característica (PC) e slots evolutivos. | Refatoração de recursos, gating por nível/PC, UI/UX de economia. | Base atual do jogo. |
| 2. Sistema elemental e afinidades | Implementar tabela RPS 4×4, afinidades por arquétipo, multiplicadores de dano/resistência. | Elementos em skills existentes, feedback visual/sonoro, registro de afinidades. | Fase 1. |
| 3. Evoluções pequenas/médias/grandes | Catálogo inicial de upgrades, habilidades e macro-saltos, anti-duplicação. | 8 evoluções pequenas, 8 médias (2 universais + 2 por arquétipo), 6 macro-saltos, gating por MG/genes. | Fases 1–2. |
| 4. Combate aprofundado | Estatísticas completas, estados (Fissura, Corrosão, Enredamento, Fotolesão) e sinergias. | Fórmula de dano revisada, efeitos de status, tuning inicial. | Fases 1–3. |
| 5. Ecossistema e IA reativa | Hostilidade NPC×NPC, threat compartilhado, evolução emergente de inimigos. | Matriz de temperamentos, XP invisível, drops escalonados, cicatrizes visuais. | Fases 1–4. |
| 6. Conteúdo & balanceamento contínuo | Ampliar habilidades, bosses elementais, telemetria. | Novos encontros, blueprint drops, dashboards de balanceamento. | Fases 1–5. |

---

## Fase 1 – Fundamentos de recursos e progressão

1. **Refatorar recursos do organismo**
   - Separar claramente Energia, XP e Material Genético (MG) nas estruturas do estado global.
   - Atualizar geração/consumo de Energia (matéria orgânica, habilidades, dash) sem permitir compras de evolução.
   - Adicionar fontes de XP (dano causado, objetivos, sobrevivência) e contadores de MG em drops atuais.

2. **Pontos de Característica (PC) e slots de evolução**
   - Implementar cálculo de PC por nível: `PC = 2 + floor(nível / 3)`.
   - Criar slots distintos para evoluções pequenas (consomem PC) e médias (desbloqueadas a cada 2 níveis).
   - Ajustar UI do menu de evolução para refletir slots e custos.

3. **Integração com gates existentes por Energia**
   - Reconciliar marcos de Energia com o novo gating por nível/MG (ex.: manter Energia como requisito narrativo, mas progressão efetiva depende de XP/MG).
   - Atualizar notificações/tutorial explicando Economia.

4. **Ferramentas de suporte**
   - Criar utilitários para formato de dados de recursos (inspirado no JSON exemplo fornecido).
   - Adicionar testes unitários para ganhos/perdas de recursos e distribuição de PC.

## Fase 2 – Sistema elemental e afinidades

1. **Tabela RPS e multiplicadores**
   - Implementar matriz 4×4 com multiplicadores básicos (+15% vantagem, −15% desvantagem).
   - Explicar visualmente no HUD quando ocorre vantagem/desvantagem.

2. **Afinidades por arquétipo**
   - Definir afinidade padrão e variações raras para cada categoria inicial (Vírus, Bactéria, Arqueia, Protozoário, Alga, Fungo).
   - Conceder bônus de +10% dano e resistência ao elemento de afinidade; penalidade equivalente à fraqueza.

3. **Atribuição de elementos às habilidades existentes**
   - Classificar skills atuais (Pulso Energético → Mobilidade, Espinhos → Estrutural ofensivo, Membrana → Estrutural defensivo, Núcleo Vital/Drain → Química).
   - Ajustar efeitos e partículas para refletir elemento.

4. **Drops condicionais**
   - Incluir bônus de MG (+25%) quando inimigos forem derrotados com vantagem elemental.
   - Registrar elemento usado no kill para futura telemetria.

## Fase 3 – Evoluções em três tamanhos

1. **Catálogo de evoluções pequenas (PC)**
   - Implementar lista inicial: Ataque Enzimático, Armadura Celular, Motilidade, Percepção/Quimiotaxia, Reparo/Antioxidantes, Capacidade Energética, Controle Osmótico, Resiliência Ambiental, Slots de Receptores.
   - Aplicar retornos decrescentes após 5 upgrades na mesma linha (+10%, +8%, +6%, +4%, +2%).
   - Garantir sinergias elementais (ex.: bônus extra se afinidade corresponder).

2. **Evoluções médias (habilidades)**
   - Selecionar 8 habilidades para v1 (2 universais + 2 por arquétipo) a partir do catálogo proposto.
   - Implementar custos (Energia, cooldown, MG para raras) e efeitos (ativas/passivas) com feedback visual.
   - Adicionar sistema de raridade e reroll consumindo MG crescente.

3. **Evoluções grandes (macro-saltos)**
   - Implementar transições de forma para cada arquétipo (p.ex. Bactéria → Colônia/Biofilme, Protozoário → Mixotrófico).
   - Ao aplicar macro-salto: recalibrar status base, ajustar afinidade elemental e conceder PC extras.
   - Criar mecanismo de “Herança” (imprint) para carregar 1 trait ao mudar de categoria, custando MG.

4. **Prevenção de duplicação**
   - Bloquear reaplicação de traits/skills já adquiridos ou converter repetição em MG.
   - Alterar multiplicadores de forma de multiplicativos para aditivos após a primeira aquisição.

5. **Testes e migração**
   - Cobertura de regressão para seleção repetida de traits/formas.
   - Scripts de migração para estados salvos existentes.

## Fase 4 – Combate aprofundado e estados

1. **Estatísticas ampliadas**
   - Introduzir atributos: PEN, ALC, CRT, MASSA, ESTABILIDADE, resistências por elemento.
   - Atualizar HUD do organismo e debug overlay para exibir novos atributos.

2. **Estados e sinergias**
   - Implementar estados: Fissura (−DEF%), Corrosão (DoT e −RES Química), Enredamento (−VEL/aceleração), Fotolesão (−regen, +crit). 
   - Codificar sinergias cruzadas (ex.: Fissura → Química +25% dano).

3. **Fórmula de dano revisada**
   - Adotar curva de DR: `DR = DEF / (DEF + K)` limitada a 65%; aplicar PEN antes da curva.
   - Integrar multiplicadores elementais da Fase 2 e bônus de crítico.
   - Incluir cálculo para DoTs e efeitos de knockback/fagocitose baseados em MASSA/ESTABILIDADE.

4. **Feedback de combate**
   - Atualizar efeitos visuais/sonoros para cada elemento e estado.
   - Implementar indicadores de status (ícones sobre as entidades, barras auxiliares).

5. **Balanceamento inicial**
   - Configurar valores padrão para cada arquétipo conforme kit de design (bases de ATQ/DEF/VEL/Energia).
   - Realizar tuning com telemetria básica (dano por elemento, tempo em estado, mortes por afinidade).

## Fase 5 – Ecossistema e IA reativa

1. **Matriz de hostilidade e temperamentos**
   - Definir relações Predador↔Presa, Competidor, Parasita↔Hospedeiro entre espécies.
   - Atribuir temperamentos (agressivo, oportunista, territorial, cooperativo, parasítico) a indivíduos.

2. **Threat compartilhado e seleção de alvos**
   - Implementar sistema de threat por dano/controle/cura.
   - Criar lógica de troca de alvo baseada em hostilidade, vantagem elemental e proximidade.
   - Permitir combates NPC×NPC quando hostilidade superar limiar.

3. **Rotinas comportamentais**
   - Construir behavior trees simplificadas com prioridades (fuga, engajar com vantagem, combos de grupo, defesa territorial, patrulha).
   - Adicionar suportes para combos cooperativos (ex.: Hifas enraizadoras → Fagocitose).

4. **Evolução emergente de NPCs**
   - Conceder XP invisível a NPCs por dano/kills.
   - Configurar patamares que rolam mutações pequenas (atributo) e médias (habilidade leve) com limites por bioma/time.
   - Aplicar “cicatriz” visual em NPC evoluído e aumentar drop de MG/fragmentos.

5. **Sistema de drops avançado**
   - Formalizar drops de MG, Fragmentos de Gene e Genes Estáveis com tabela por tier (minion, elite, boss).
   - Implementar piedade: +10% chance cumulativa após 5 kills sem drop raro.
   - Integrar com bônus de vantagem elemental (25%).

6. **Combate entre facções**
   - Criar arenas/eventos onde espécies rivais lutam entre si, influenciando spawn futuro (ex.: vitória bacteriana aumenta presença de Radiação inimiga para contra-build).

## Fase 6 – Conteúdo e balanceamento contínuo

1. **Ampliação do catálogo de habilidades**
   - Completar lista de evoluções médias (todo o catálogo apresentado) e adicionar raras exclusivas por boss.
   - Implementar blueprints de boss (drop garantido 25%) para liberar habilidades temáticas.

2. **Bosses elementais e encontros dinâmicos**
   - Criar encontros como Ninho de Biofilme, Cardume Fototrófico, Predador Mixotrófico com mecânicas elementais.
   - Integrar gatilhos de bioma para mutações específicas a cada 3 níveis do jogador.

3. **Simbiogênese e evoluções transversais**
   - Implementar fusões raras (ex.: Bactéria + Alga → Cianobactério) consumindo MG alto + Gene Estável.
   - Ajustar herança de traits ao realizar fusões.

4. **Telemetria e balanceamento vivo**
   - Registrar métricas: dano por habilidade/elemento, tempo em estados, taxa de fuga de NPCs, frequência de combates NPC×NPC.
   - Construir dashboards ou relatórios automáticos para orientar ajustes.

5. **Qualidade de vida e antigrief**
   - Stamina/energia limita spam de dash/escudo.
   - Diminishing returns para controle de grupo (100% → 60% → 30% em 10s).
   - Zonas de spawn protegidas com biofilme automático e sombreamento.

---

## Dependências cruzadas e notas adicionais

- **Documentação e UX**: cada fase deve atualizar tooltips, codex in-game e documentação externa (wiki/patch notes) para refletir novas mecânicas.
- **Migração de saves**: planejar conversões entre fases (especialmente Fases 1 e 3) para não quebrar progressos existentes.
- **Testes automatizados**: criar suites incrementais (unit, integração e testes de IA) alinhadas às novas mecânicas, garantindo que regressões em combate/evolução sejam detectadas cedo.
- **Equipe multidisciplinar**: envolver design, engenharia, arte e áudio em revisões de cada fase para manter consistência biológica e feedback claro.

Este roadmap provê uma trajetória incremental que permite validar a cada etapa: economia → elementos → evolução → combate → ecossistema → conteúdo vivo. Seguir a ordem proposta ajuda a controlar complexidade e garantir que cada camada se apoie em fundamentos sólidos.
