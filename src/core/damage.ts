import { elementMultiplier } from './elements';
import type { NinjaTemplate } from './types';

/** Quanto a defesa reduz: com DEF 100 o alvo recebe metade do dano. */
export const DEFENSE_SCALE = 100;

export interface DamageResult {
  amount: number;
  elementMultiplier: number;
}

/**
 * Dano = ATK × poder × elemento × 100 / (100 + DEF), arredondado, mínimo 1.
 * Determinístico de propósito: facilita testar e balancear.
 */
export function computeDamage(
  attacker: NinjaTemplate,
  defender: NinjaTemplate,
  power: number,
): DamageResult {
  const mult = elementMultiplier(attacker.element, defender.element);
  const raw =
    (attacker.stats.atk * power * mult * DEFENSE_SCALE) / (DEFENSE_SCALE + defender.stats.def);
  return { amount: Math.max(1, Math.round(raw)), elementMultiplier: mult };
}
