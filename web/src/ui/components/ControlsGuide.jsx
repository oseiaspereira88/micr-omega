import React from 'react';
import styles from './ControlsGuide.module.css';

export const CONTROLS_GUIDE_ITEMS = [
  {
    id: 'movement',
    action: 'Mover-se',
    keyboardMouse: 'W, A, S, D ou teclas direcionais',
    touch: 'Arraste o joystick virtual para definir a direção.',
  },
  {
    id: 'attack',
    action: 'Ataque básico',
    keyboardMouse: 'Barra de espaço ou clique no botão Ataque (pressione para atacar).',
    touch: 'Toque e segure o botão Ataque.',
  },
  {
    id: 'dash',
    action: 'Dash',
    keyboardMouse: 'Tecla Shift ou clique no botão Dash (quando a carga estiver completa).',
    touch: 'Toque no botão Dash quando estiver pronto.',
  },
  {
    id: 'use-skill',
    action: 'Usar habilidade equipada',
    keyboardMouse: 'Tecla Q ou clique no botão Habilidade.',
    touch: 'Toque no botão Habilidade.',
  },
  {
    id: 'cycle-skill',
    action: 'Trocar habilidade equipada',
    keyboardMouse: 'Tecla R ou Tab; clique no botão Trocar habilidade.',
    touch: 'Toque no botão Trocar habilidade.',
  },
  {
    id: 'evolution',
    action: 'Abrir menu de evolução',
    keyboardMouse: 'Tecla E ou clique no botão Evoluir.',
    touch: 'Toque no botão Evoluir quando disponível.',
  },
];

const ControlsGuide = ({
  className,
  title = 'Guia de controles',
  description = 'Veja como acionar cada ação usando teclado/mouse ou toques na tela.',
  titleId,
  descriptionId,
  items = CONTROLS_GUIDE_ITEMS,
  actions,
  ...props
}) => {
  const containerClassName = [styles.container, className].filter(Boolean).join(' ');

  return (
    <section className={containerClassName} {...props}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.actionColumn}>
                Ação
              </th>
              <th scope="col" className={styles.keyboardColumn}>
                Teclado / Mouse
              </th>
              <th scope="col" className={styles.touchColumn}>
                Toque
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <th scope="row" className={styles.actionCell}>
                  {item.action}
                </th>
                <td className={styles.keyboardCell}>{item.keyboardMouse}</td>
                <td className={styles.touchCell}>{item.touch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ControlsGuide;
