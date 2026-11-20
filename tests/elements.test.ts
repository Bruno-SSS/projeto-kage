import { describe, expect, it } from 'vitest';
import {
  ADVANTAGE_MULTIPLIER,
  DISADVANTAGE_MULTIPLIER,
  ELEMENTS,
  elementMultiplier,
} from '../src/core/elements';

describe('elementMultiplier', () => {
  it('fogo vence vento', () => {
    expect(elementMultiplier('fogo', 'vento')).toBe(ADVANTAGE_MULTIPLIER);
  });

  it('água vence fogo (o ciclo fecha)', () => {
    expect(elementMultiplier('agua', 'fogo')).toBe(ADVANTAGE_MULTIPLIER);
  });

  it('vento perde para fogo', () => {
    expect(elementMultiplier('vento', 'fogo')).toBe(DISADVANTAGE_MULTIPLIER);
  });

  it('mesmo elemento e elementos sem relação são neutros', () => {
    expect(elementMultiplier('raio', 'raio')).toBe(1);
    expect(elementMultiplier('fogo', 'terra')).toBe(1);
  });

  it('todo elemento tem exatamente uma vantagem e uma desvantagem', () => {
    for (const a of ELEMENTS) {
      const results = ELEMENTS.map((d) => elementMultiplier(a, d));
      expect(results.filter((m) => m === ADVANTAGE_MULTIPLIER)).toHaveLength(1);
      expect(results.filter((m) => m === DISADVANTAGE_MULTIPLIER)).toHaveLength(1);
    }
  });
});
