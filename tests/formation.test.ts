import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle';
import { selectTargets, validateFormation } from '../src/core/formation';
import type { FormationSlot, TargetPattern } from '../src/core/types';
import { ninja, slot } from './fixtures';

describe('validateFormation', () => {
  it('aceita uma formação válida', () => {
    expect(validateFormation([slot(ninja('a'), 0, 0), slot(ninja('b'), 2, 2)])).toEqual([]);
  });

  it('rejeita formação vazia e com mais de 4 ninjas', () => {
    expect(validateFormation([])).toHaveLength(1);
    const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      slot(ninja(id), i % 3, Math.floor(i / 3)),
    );
    expect(validateFormation(five).join()).toMatch(/no máximo 4/);
  });

  it('rejeita casa ocupada duas vezes, ninja repetido e posição fora do grid', () => {
    const n = ninja('a');
    expect(validateFormation([slot(n, 0, 0), slot(ninja('b'), 0, 0)]).join()).toMatch(/casa 0,0/);
    expect(validateFormation([slot(n, 0, 0), slot(n, 1, 0)]).join()).toMatch(/mais de uma vez/);
    expect(validateFormation([slot(n, 3, 0)]).join()).toMatch(/fora do grid/);
  });
});

describe('selectTargets', () => {
  /**
   * Inimigos (time B):
   *          col0  col1  col2
   *   row0         b1
   *   row1   b2          b4
   *   row2   b3
   */
  const enemies: FormationSlot[] = [
    slot(ninja('b1'), 0, 1),
    slot(ninja('b2'), 1, 0),
    slot(ninja('b3'), 2, 0),
    slot(ninja('b4'), 1, 2),
  ];

  function targets(pattern: TargetPattern, attackerRow: number, deadIds: string[] = []) {
    const battle = new Battle([slot(ninja('a'), attackerRow, 0)], enemies);
    for (const id of deadIds) battle.unit(`B:${id}`).hp = 0;
    const attacker = battle.unit('A:a');
    return selectTargets(pattern, attacker, battle.alive('B')).map((u) => u.template.id);
  }

  it('single: coluna da frente, mesma linha do atacante', () => {
    expect(targets('single', 2)).toEqual(['b3']);
    expect(targets('single', 1)).toEqual(['b2']);
  });

  it('single: sem ninguém na mesma linha, pega a linha mais próxima (empate: a de cima)', () => {
    expect(targets('single', 0)).toEqual(['b2']);
    // b2 morto: na coluna 0 só resta b3 (linha 2)
    expect(targets('single', 0, ['b2'])).toEqual(['b3']);
  });

  it('a coluna da frente avança quando ela é eliminada', () => {
    expect(targets('single', 0, ['b2', 'b3'])).toEqual(['b1']);
  });

  it('back: alvo na retaguarda', () => {
    expect(targets('back', 0)).toEqual(['b4']);
  });

  it('row: todos na linha do alvo principal', () => {
    expect(targets('row', 1)).toEqual(['b2', 'b4']);
  });

  it('column: toda a coluna da frente', () => {
    expect(targets('column', 0)).toEqual(['b2', 'b3']);
  });

  it('all: todos os vivos', () => {
    expect(targets('all', 0, ['b4'])).toEqual(['b1', 'b2', 'b3']);
  });
});
