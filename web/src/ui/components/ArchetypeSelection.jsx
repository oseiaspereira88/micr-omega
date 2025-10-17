import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const allowedSet = useMemo(() => {
    if (!Array.isArray(selection?.options)) {
      return null;
    }

    const filtered = selection.options.filter(
      (option) => typeof option === 'string' && option.trim().length > 0,
    );

    if (filtered.length === 0) {
      return null;
    }

    return new Set(filtered);
  }, [selection?.options]);

  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const previousFocusRef = useRef(null);
  const optionRefs = useRef(new Map());
  const [activeKey, setActiveKey] = useState(null);

  const options = useMemo(() => {
    return archetypeList.filter((entry) => !allowedSet || allowedSet.has(entry.key));
  }, [allowedSet]);

  const focusOptionElement = useCallback((key) => {
    if (!key) return false;
    const element = optionRefs.current.get(key);
    if (element instanceof HTMLElement) {
      element.focus();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!pending) {
      setActiveKey(null);
      return undefined;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const dialogNode = dialogRef.current;
    const focusable = dialogNode
      ? Array.from(dialogNode.querySelectorAll(focusableSelectors)).filter(
          (element) =>
            element instanceof HTMLElement &&
            !element.hasAttribute('disabled') &&
            element.getAttribute('aria-hidden') !== 'true',
        )
      : [];

    const hasSelected = options.some((entry) => entry.key === selected);
    const targetKey = hasSelected ? selected : options[0]?.key;

    setActiveKey(targetKey ?? null);

    if (!focusOptionElement(targetKey)) {
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (dialogNode instanceof HTMLElement) {
        dialogNode.focus();
      } else if (overlayRef.current instanceof HTMLElement) {
        overlayRef.current.focus();
      }
    }

    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [focusOptionElement, options, pending, selected]);

  const handleKeyDown = (event) => {
    if (!dialogRef.current) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(dialogRef.current.querySelectorAll(focusableSelectors)).filter(
      (element) =>
        element instanceof HTMLElement &&
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true',
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else if (active === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const focusOptionByIndex = (index) => {
    if (!Array.isArray(options) || options.length === 0) {
      return;
    }

    const normalizedIndex = ((index % options.length) + options.length) % options.length;
    const entry = options[normalizedIndex];
    if (!entry) {
      return;
    }

    setActiveKey(entry.key);
    focusOptionElement(entry.key);

    if (selected !== entry.key) {
      onSelect?.(entry.key);
    }
  };

  const handleCardKeyDown = (event, index) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusOptionByIndex(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusOptionByIndex(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOptionByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusOptionByIndex(options.length - 1);
        break;
      default:
        break;
    }
  };

  const handleCardSelect = (key) => {
    setActiveKey(key);
    focusOptionElement(key);
    if (selected !== key) {
      onSelect?.(key);
    }
  };

  const setOptionRef = (key) => (element) => {
    if (!optionRefs.current) {
      optionRefs.current = new Map();
    }

    if (element) {
      optionRefs.current.set(key, element);
    } else {
      optionRefs.current.delete(key);
    }
  };

  if (!pending) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      tabIndex={-1}
      ref={overlayRef}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h2 className={styles.title}>Escolha seu arquétipo inicial</h2>
        <p className={styles.subtitle}>
          Cada arquétipo define afinidades elementares, passivas únicas e habilidades
          iniciais. Escolha com sabedoria: evoluções futuras expandirão essas
          características.
        </p>

        <div className={styles.grid}>
          {options.map((entry, index) => {
            const isSelected = selected === entry.key;
            const isActive = activeKey === entry.key;
            const affinities = [
              ELEMENT_LABELS[entry.affinities.element] ?? entry.affinities.element,
              AFFINITY_LABELS[entry.affinities.affinity] ?? entry.affinities.affinity,
            ];

            return (
              <button
                key={entry.key}
                type="button"
                className={`${styles.card} ${isSelected || isActive ? styles.cardSelected : ''}`}
                onClick={() => handleCardSelect(entry.key)}
                aria-pressed={isSelected}
                onKeyDown={(event) => handleCardKeyDown(event, index)}
                onFocus={() => setActiveKey(entry.key)}
                ref={setOptionRef(entry.key)}
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
