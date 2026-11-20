import type { ChaseSkill, NinjaTemplate, Skill, SpecialSkill } from '../core/types';
import { ELEMENT_LABELS, PATTERN_LABELS, STATUS_NOUNS, STATUS_VERBS } from './theme';

/** "Golpe Flamejante (um alvo, derruba)" */
export function describeSkill(skill: Skill | SpecialSkill): string {
  const parts: string[] = [PATTERN_LABELS[skill.pattern]];
  if (skill.applies) parts.push(STATUS_VERBS[skill.applies]);
  if (skill.stuns) parts.push('atordoa');
  if ('chakraCost' in skill) parts.push(`${skill.chakraCost} chakra`);
  return `${skill.name} (${parts.join(', ')})`;
}

/** "Queda em Brasa (alvo no ar → derruba)" */
export function describeChase(chase: ChaseSkill): string {
  const then = chase.applies ? STATUS_VERBS[chase.applies] : 'finaliza';
  return `${chase.name} (alvo ${STATUS_NOUNS[chase.trigger]} → ${then})`;
}

export function describeNinja(n: NinjaTemplate): string[] {
  const { hp, atk, def, spd } = n.stats;
  return [
    `${n.name} · ${ELEMENT_LABELS[n.element]}   VIDA ${hp}  ATQ ${atk}  DEF ${def}  VEL ${spd}`,
    `Básico: ${describeSkill(n.basic)}   Especial: ${describeSkill(n.special)}`,
    n.chase ? `Perseguição: ${describeChase(n.chase)}` : 'Sem perseguição',
  ];
}
