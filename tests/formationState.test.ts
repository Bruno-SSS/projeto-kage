import { describe, expect, it } from 'vitest';
import { validateFormation } from '../src/core/formation';
import { DEFAULT_FORMATION, ENEMY_FORMATION } from '../src/data/formations';
import { NINJAS } from '../src/data/ninjas';
import { describeChase, describeSkill } from '../src/ui/describe';
import {
  firstFreeCell,
  placeNinja,
  removeNinja,
  toSlots,
  type Placement,
} from '../src/ui/formationState';

const p = (id: string, row: number, col: number): Placement => ({ id, row, col });
const sorted = (list: Placement[] | null) =>
  list && [...list].sort((a, b) => a.id.localeCompare(b.id));

describe('placeNinja', () => {
  it('coloca um ninja do elenco numa casa vazia', () => {
    expect(placeNinja([], 'a', 1, 0)).toEqual([p('a', 1, 0)]);
  });

  it('move um ninja já escalado para uma casa vazia', () => {
    expect(placeNinja([p('a', 1, 0)], 'a', 2, 2)).toEqual([p('a', 2, 2)]);
  });

  it('troca de lugar quando solta um ninja do grid sobre outro', () => {
    const result = placeNinja([p('a', 0, 0), p('b', 1, 1)], 'a', 1, 1);
    expect(sorted(result)).toEqual([p('a', 1, 1), p('b', 0, 0)]);
  });

  it('substitui quem está na casa quando vem do elenco', () => {
    expect(sorted(placeNinja([p('a', 0, 0)], 'b', 0, 0))).toEqual([p('b', 0, 0)]);
  });

  it('soltar na própria casa não muda nada', () => {
    const list = [p('a', 0, 0)];
    expect(placeNinja(list, 'a', 0, 0)).toBe(list);
  });

  it('recusa o 5º ninja, mas permite substituir com o time cheio', () => {
    const full = [p('a', 0, 0), p('b', 1, 0), p('c', 2, 0), p('d', 0, 1)];
    expect(placeNinja(full, 'e', 2, 2)).toBeNull();
    expect(placeNinja(full, 'e', 0, 0)).toHaveLength(4);
  });
});

describe('removeNinja e firstFreeCell', () => {
  it('remove pelo id', () => {
    expect(removeNinja([p('a', 0, 0), p('b', 1, 0)], 'a')).toEqual([p('b', 1, 0)]);
  });

  it('prioriza frente e centro', () => {
    expect(firstFreeCell([])).toEqual({ row: 1, col: 0 });
    expect(firstFreeCell([p('a', 1, 0)])).toEqual({ row: 0, col: 0 });
    expect(firstFreeCell([p('a', 1, 0), p('b', 0, 0), p('c', 2, 0)])).toEqual({ row: 1, col: 1 });
  });
});

describe('dados das formações', () => {
  it('formações padrão e inimiga são válidas', () => {
    expect(validateFormation(toSlots(DEFAULT_FORMATION, NINJAS))).toEqual([]);
    expect(validateFormation(toSlots(ENEMY_FORMATION, NINJAS))).toEqual([]);
  });

  it('toSlots falha com ninja desconhecido', () => {
    expect(() => toSlots([p('ninguem', 0, 0)], NINJAS)).toThrow(/desconhecido/);
  });
});

describe('descrições', () => {
  it('descreve golpes e perseguições', () => {
    expect(describeSkill(NINJAS.boitata.basic)).toBe('Mordida de Fogo (um alvo, derruba)');
    expect(describeSkill(NINJAS.cuca.special)).toBe(
      'Raio do Caldeirão (um alvo, atordoa, 75 chakra)',
    );
    expect(describeChase(NINJAS.boitata.chase!)).toBe('Queda Flamejante (alvo no ar → derruba)');
    expect(describeChase(NINJAS.curupira.chase!)).toBe('Raízes (alvo derrubado → finaliza)');
  });
});
