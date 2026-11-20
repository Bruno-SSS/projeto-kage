import type { Battle } from './battle';
import type { Action, BattleEvent, TeamId, Unit } from './types';

export type ActionChooser = (battle: Battle, actor: Unit) => Action;

/** IA simples: usa o especial sempre que o time tem chakra; senão, ataque básico. */
export const greedyAI: ActionChooser = (battle, actor) =>
  battle.canUseSpecial(actor) ? { type: 'special' } : { type: 'basic' };

/** Roda a batalha até o fim com uma IA para cada time e devolve todos os eventos. */
export function runAutoBattle(
  battle: Battle,
  choosers: Partial<Record<TeamId, ActionChooser>> = {},
): BattleEvent[] {
  const events: BattleEvent[] = [];
  while (!battle.outcome) {
    events.push(...battle.nextTurn());
    if (battle.outcome || !battle.actor) break;
    const choose = choosers[battle.actor.team] ?? greedyAI;
    events.push(...battle.act(choose(battle, battle.actor)));
  }
  return events;
}
