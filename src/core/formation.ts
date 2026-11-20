import type { FormationSlot, Position, TargetPattern, Unit } from './types';

export const GRID_SIZE = 3;
export const MAX_TEAM_SIZE = 4;

/** Lista os problemas de uma formação; vazia quando ela é válida. */
export function validateFormation(slots: FormationSlot[]): string[] {
  const errors: string[] = [];
  if (slots.length === 0) errors.push('A formação precisa de pelo menos 1 ninja.');
  if (slots.length > MAX_TEAM_SIZE) {
    errors.push(`A formação aceita no máximo ${MAX_TEAM_SIZE} ninjas.`);
  }

  const cells = new Set<string>();
  const ids = new Set<string>();
  for (const { ninja, position } of slots) {
    if (!isInsideGrid(position)) {
      errors.push(`${ninja.name} está fora do grid (${position.row},${position.col}).`);
    }
    const key = `${position.row},${position.col}`;
    if (cells.has(key)) errors.push(`Duas unidades ocupam a casa ${key}.`);
    cells.add(key);
    if (ids.has(ninja.id)) errors.push(`${ninja.name} aparece mais de uma vez.`);
    ids.add(ninja.id);
  }
  return errors;
}

function isInsideGrid({ row, col }: Position): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < GRID_SIZE &&
    col >= 0 &&
    col < GRID_SIZE
  );
}

/** O inimigo da coluna `col` mais próximo da linha do atacante (empate: linha de cima). */
function closestInColumn(enemies: Unit[], col: number, row: number): Unit {
  const inColumn = enemies.filter((e) => e.position.col === col);
  return inColumn.reduce((best, e) => {
    const d = Math.abs(e.position.row - row);
    const bestD = Math.abs(best.position.row - row);
    if (d < bestD || (d === bestD && e.position.row < best.position.row)) return e;
    return best;
  });
}

/**
 * Escolhe os alvos de um golpe a partir do padrão, da posição do atacante e
 * dos inimigos vivos. A ordem do retorno é estável (linha, depois coluna).
 */
export function selectTargets(pattern: TargetPattern, attacker: Unit, enemies: Unit[]): Unit[] {
  const alive = enemies.filter((e) => e.hp > 0);
  if (alive.length === 0) return [];

  const front = Math.min(...alive.map((e) => e.position.col));
  const back = Math.max(...alive.map((e) => e.position.col));
  const row = attacker.position.row;

  let targets: Unit[];
  switch (pattern) {
    case 'single':
      targets = [closestInColumn(alive, front, row)];
      break;
    case 'back':
      targets = [closestInColumn(alive, back, row)];
      break;
    case 'row': {
      const primary = closestInColumn(alive, front, row);
      targets = alive.filter((e) => e.position.row === primary.position.row);
      break;
    }
    case 'column':
      targets = alive.filter((e) => e.position.col === front);
      break;
    case 'all':
      targets = alive;
      break;
  }
  return [...targets].sort(
    (a, b) => a.position.row - b.position.row || a.position.col - b.position.col,
  );
}
