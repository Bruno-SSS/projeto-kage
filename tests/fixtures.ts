import type { FormationSlot, NinjaTemplate, Position, Stats } from '../src/core/types';

type NinjaOverrides = Partial<Omit<NinjaTemplate, 'stats'>> & { stats?: Partial<Stats> };

/**
 * Ninja de teste: todos do mesmo elemento (neutro entre si) e DEF 0, para que o
 * dano seja simplesmente ATK × poder.
 */
export function ninja(id: string, overrides: NinjaOverrides = {}): NinjaTemplate {
  const { stats, ...rest } = overrides;
  return {
    id,
    name: id,
    element: 'terra',
    basic: { id: `${id}-basic`, name: 'Básico', power: 1, pattern: 'single' },
    special: {
      id: `${id}-special`,
      name: 'Especial',
      power: 2,
      pattern: 'single',
      chakraCost: 50,
    },
    ...rest,
    stats: { hp: 1000, atk: 50, def: 0, spd: 50, ...stats },
  };
}

export function at(row: number, col: number): Position {
  return { row, col };
}

export function slot(n: NinjaTemplate, row = 1, col = 0): FormationSlot {
  return { ninja: n, position: at(row, col) };
}
