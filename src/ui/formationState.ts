import { GRID_SIZE, MAX_TEAM_SIZE } from '../core/formation';
import type { FormationSlot, NinjaTemplate } from '../core/types';

/** Formação em edição: qual ninja (por id) está em qual casa. */
export interface Placement {
  id: string;
  row: number;
  col: number;
}

/**
 * Coloca (ou move) um ninja em uma casa.
 * - Casa vazia: ocupa. Se o ninja já estava em outra casa, ele se move.
 * - Casa ocupada por outro: se o ninja veio de outra casa, os dois trocam;
 *   se veio do elenco, substitui quem estava lá.
 * Devolve `null` quando a jogada estouraria o limite de ninjas.
 */
export function placeNinja(
  placements: Placement[],
  id: string,
  row: number,
  col: number,
): Placement[] | null {
  const from = placements.find((p) => p.id === id);
  const occupant = placements.find((p) => p.row === row && p.col === col);
  if (from && occupant && from === occupant) return placements;

  let next = placements.filter((p) => p.id !== id && p !== occupant);
  if (occupant && from) next.push({ id: occupant.id, row: from.row, col: from.col });
  next = [...next, { id, row, col }];
  return next.length > MAX_TEAM_SIZE ? null : next;
}

export function removeNinja(placements: Placement[], id: string): Placement[] {
  return placements.filter((p) => p.id !== id);
}

/** Primeira casa livre, priorizando a frente e o centro. */
export function firstFreeCell(placements: Placement[]): { row: number; col: number } | null {
  const rows = [1, 0, 2];
  for (let col = 0; col < GRID_SIZE; col++) {
    for (const row of rows) {
      if (!placements.some((p) => p.row === row && p.col === col)) return { row, col };
    }
  }
  return null;
}

export function toSlots(
  placements: Placement[],
  roster: Record<string, NinjaTemplate>,
): FormationSlot[] {
  return placements.map(({ id, row, col }) => {
    const ninja = roster[id];
    if (!ninja) throw new Error(`Ninja desconhecido: ${id}`);
    return { ninja, position: { row, col } };
  });
}
