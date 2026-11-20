import type { Placement } from '../ui/formationState';

/** Formação sugerida para o jogador ao abrir o jogo. */
export const DEFAULT_FORMATION: Placement[] = [
  { id: 'kaen', row: 0, col: 0 },
  { id: 'hayate', row: 1, col: 0 },
  { id: 'iwao', row: 2, col: 0 },
  { id: 'raiga', row: 1, col: 2 },
];

/** Primeiro desafio. A campanha completa chega na Fase 4. */
export const ENEMY_FORMATION: Placement[] = [
  { id: 'minase', row: 0, col: 0 },
  { id: 'iwao', row: 1, col: 0 },
  { id: 'raiga', row: 2, col: 1 },
  { id: 'hayate', row: 1, col: 2 },
];
