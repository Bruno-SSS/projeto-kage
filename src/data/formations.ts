import type { Placement } from '../ui/formationState';

/** Formação sugerida para o jogador ao abrir o jogo. */
export const DEFAULT_FORMATION: Placement[] = [
  { id: 'boitata', row: 0, col: 0 },
  { id: 'saci', row: 1, col: 0 },
  { id: 'curupira', row: 2, col: 0 },
  { id: 'cuca', row: 1, col: 2 },
];

/** Primeiro desafio. A campanha completa chega na Fase 4. */
export const ENEMY_FORMATION: Placement[] = [
  { id: 'iara', row: 0, col: 0 },
  { id: 'mapinguari', row: 1, col: 0 },
  { id: 'cuca', row: 2, col: 1 },
  { id: 'saci', row: 1, col: 2 },
];
