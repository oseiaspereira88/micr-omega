import React, { useMemo } from 'react';
import {
  AFFINITY_LABELS,
  ELEMENT_LABELS,
} from '../../shared/combat';
import { archetypeList } from '../../game/config/archetypes';
import styles from './ArchetypeSelection.module.css';

const formatStat = (label, value) => `${label}: ${value}`;

const ArchetypeSelection = ({
  selection,
  selected,
  onSelect,
}) => {
  const pending = selection?.pending;
  const allowed = Array.isArray(selection?.options)
    ? selection.options.filter((option) => typeof option === 'string' && option.trim().length > 0)
    : null;

  const options = useMemo(() => {
    return archetypeList.filter((entry) => {
      if (!allowed) return true;
      return allowed.includes(entry.key);
    });
  }, [allowed]);

  if (!pending) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Escolha seu arquétipo inicial</h2>
        <p className={styles.subtitle}>
          Cada arquétipo define afinidades elementares, passivas únicas e habilidades
          iniciais. Escolha com sabedoria: evoluções futuras expandirão essas
          características.
        </p>

        <div className={styles.grid} role="listbox" aria-label="Opções de arquétipo">
          {options.map((entry) => {
            const isSelected = selected === entry.key;
            const affinities = [
              ELEMENT_LABELS[entry.affinities.element] ?? entry.affinities.element,
              AFFINITY_LABELS[entry.affinities.affinity] ?? entry.affinities.affinity,
            ];

            return (
              <button
                key={entry.key}
                type="button"
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => onSelect?.(entry.key)}
                role="option"
                aria-selected={isSelected}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>{entry.icon}</span>
                  <div className={styles.cardTitleBlock}>
                    <span className={styles.cardTitle}>{entry.name}</span>
                    <span className={styles.cardAffinity}>{affinities.join(' • ')}</span>
                  </div>
                </div>
                <p className={styles.description}>{entry.description}</p>

                <div className={styles.statLine}>
                  <span>{formatStat('ATQ', entry.baseStats.attack)}</span>
                  <span>{formatStat('DEF', entry.baseStats.defense)}</span>
                  <span>{formatStat('VEL', entry.baseStats.speed)}</span>
                  <span>{formatStat('PV', entry.baseStats.maxHealth)}</span>
                </div>

                <div className={styles.sectionLabel}>Passivas iniciais</div>
                <ul className={styles.passiveList}>
                  {entry.passives.map((passive, index) => (
                    <li key={`${entry.key}-passive-${index}`}> 
                      {passive.type === 'multiplicative'
                        ? `× ${(1 + passive.value).toFixed(2)} ${passive.stat}`
                        : `+ ${passive.value} ${passive.stat}`}
                    </li>
                  ))}
                </ul>

                <div className={styles.sectionLabel}>Habilidades iniciais</div>
                <div className={styles.skillList}>
                  {entry.startingSkills.map((skill) => (
                    <span key={`${entry.key}-skill-${skill}`} className={styles.skillBadge}>
                      {skill}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArchetypeSelection;
