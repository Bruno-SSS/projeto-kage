import { describe, expect, it } from 'vitest';
import { CELL_3D, easeInOut, FRONT_GAP_3D, gridToWorld, ndcToScreen } from '../src/render3d/layout';

describe('layout da arena 3D', () => {
  it('os times ficam espelhados, com a frente perto do centro', () => {
    const a = gridToWorld('A', 1, 0);
    const b = gridToWorld('B', 1, 0);
    expect(a.x).toBe(-FRONT_GAP_3D);
    expect(b.x).toBe(FRONT_GAP_3D);
    expect(gridToWorld('A', 1, 2).x).toBe(-(FRONT_GAP_3D + 2 * CELL_3D));
  });

  it('a linha do meio fica em z = 0 e as outras a uma casa de distância', () => {
    expect(gridToWorld('A', 1, 0).z).toBe(0);
    expect(gridToWorld('B', 0, 1).z).toBe(-CELL_3D);
    expect(gridToWorld('B', 2, 1).z).toBe(CELL_3D);
  });

  it('converte coordenadas normalizadas para a tela 960×540', () => {
    expect(ndcToScreen(0, 0)).toEqual({ x: 480, y: 270 });
    expect(ndcToScreen(-1, 1)).toEqual({ x: 0, y: 0 });
    expect(ndcToScreen(1, -1)).toEqual({ x: 960, y: 540 });
  });

  it('a facilitação começa em 0, termina em 1 e passa por 0,5 no meio', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
  });
});
