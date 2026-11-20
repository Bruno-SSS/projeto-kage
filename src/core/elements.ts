/**
 * Ciclo de elementos: cada elemento vence o próximo da lista.
 * fogo > vento > raio > terra > água > fogo
 */
export const ELEMENTS = ['fogo', 'vento', 'raio', 'terra', 'agua'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ADVANTAGE_MULTIPLIER = 1.25;
export const DISADVANTAGE_MULTIPLIER = 0.8;

/** Multiplicador de dano de um ataque `attacker` contra um alvo `defender`. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const a = ELEMENTS.indexOf(attacker);
  const d = ELEMENTS.indexOf(defender);
  const n = ELEMENTS.length;
  if ((a + 1) % n === d) return ADVANTAGE_MULTIPLIER;
  if ((d + 1) % n === a) return DISADVANTAGE_MULTIPLIER;
  return 1;
}
