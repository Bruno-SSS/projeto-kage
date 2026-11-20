import type { TeamId } from '../core/types';

/** Distância entre casas do grid, em unidades 3D. */
export const CELL_3D = 2.2;
/** Distância do centro da arena até a coluna da frente de cada time. */
export const FRONT_GAP_3D = 1.8;
/** Largura e altura lógicas da tela do Phaser (o HUD usa essas coordenadas). */
export const SCREEN_W = 960;
export const SCREEN_H = 540;

/**
 * Posição 3D (x, z) de uma casa do grid. O time A fica à esquerda (x < 0) e o
 * B à direita; a coluna 0 (frente) é a mais perto do centro; a linha 0 fica ao
 * fundo (z menor) e a 2 mais perto da câmera.
 */
export function gridToWorld(team: TeamId, row: number, col: number): { x: number; z: number } {
  const side = team === 'A' ? -1 : 1;
  return { x: side * (FRONT_GAP_3D + col * CELL_3D), z: (row - 1) * CELL_3D };
}

/** Converte coordenadas normalizadas (-1..1, como o `project` do Three) para a tela do Phaser. */
export function ndcToScreen(ndcX: number, ndcY: number): { x: number; y: number } {
  return { x: ((ndcX + 1) / 2) * SCREEN_W, y: ((1 - ndcY) / 2) * SCREEN_H };
}

/** Facilitação suave para as animações (0..1 → 0..1). */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
