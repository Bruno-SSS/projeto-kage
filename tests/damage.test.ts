import { describe, expect, it } from 'vitest';
import { computeDamage } from '../src/core/damage';
import { ninja } from './fixtures';

describe('computeDamage', () => {
  it('sem defesa e elementos neutros, dano = ATK × poder', () => {
    const a = ninja('a', { stats: { atk: 100 } });
    expect(computeDamage(a, ninja('d'), 1.5)).toEqual({ amount: 150, elementMultiplier: 1 });
  });

  it('DEF 100 corta o dano pela metade', () => {
    const a = ninja('a', { stats: { atk: 100 } });
    const d = ninja('d', { stats: { def: 100 } });
    expect(computeDamage(a, d, 1).amount).toBe(50);
  });

  it('aplica vantagem e desvantagem de elemento', () => {
    const fogo = ninja('f', { element: 'fogo', stats: { atk: 100 } });
    const vento = ninja('v', { element: 'vento', stats: { atk: 100 } });
    expect(computeDamage(fogo, vento, 1)).toEqual({ amount: 125, elementMultiplier: 1.25 });
    expect(computeDamage(vento, fogo, 1)).toEqual({ amount: 80, elementMultiplier: 0.8 });
  });

  it('causa pelo menos 1 de dano', () => {
    const a = ninja('a', { stats: { atk: 1 } });
    const d = ninja('d', { stats: { def: 10000 } });
    expect(computeDamage(a, d, 0.1).amount).toBe(1);
  });
});
