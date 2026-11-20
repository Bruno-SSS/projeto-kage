import { computeDamage } from './damage';
import { selectTargets, validateFormation } from './formation';
import type {
  Action,
  BattleEvent,
  BattleOutcome,
  ChaseState,
  FormationSlot,
  Skill,
  TeamId,
  Unit,
} from './types';

export interface BattleOptions {
  /** Chakra de cada time no início da batalha. */
  startingChakra: number;
  /** Chakra ganho por cada time no início de cada rodada (a partir da 2ª). */
  chakraPerRound: number;
  maxChakra: number;
  /** Máximo de perseguições encadeadas a partir de uma ação. */
  comboLimit: number;
  /** Depois desta rodada a batalha termina empatada. */
  maxRounds: number;
}

export const DEFAULT_OPTIONS: BattleOptions = {
  startingChakra: 50,
  chakraPerRound: 25,
  maxChakra: 100,
  comboLimit: 4,
  maxRounds: 30,
};

/**
 * Motor de batalha em turnos, sem gráficos.
 *
 * Uso:
 *   const battle = new Battle(timeA, timeB);
 *   while (!battle.outcome) {
 *     events.push(...battle.nextTurn());       // avança até o próximo ninja que pode agir
 *     if (battle.outcome) break;
 *     events.push(...battle.act(escolha));     // executa a ação dele
 *   }
 *
 * Cada chamada devolve eventos que a interface pode animar em ordem.
 */
export class Battle {
  readonly units: Unit[];
  readonly chakra: Record<TeamId, number>;
  readonly options: BattleOptions;
  round = 0;
  outcome?: BattleOutcome;
  /** Ninja que deve agir agora (definido por `nextTurn`). */
  actor?: Unit;

  private queue: Unit[] = [];

  constructor(teamA: FormationSlot[], teamB: FormationSlot[], options?: Partial<BattleOptions>) {
    for (const [team, slots] of [
      ['A', teamA],
      ['B', teamB],
    ] as const) {
      const errors = validateFormation(slots);
      if (errors.length > 0) throw new Error(`Formação ${team} inválida: ${errors.join(' ')}`);
    }
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.chakra = { A: this.options.startingChakra, B: this.options.startingChakra };
    this.units = [...createUnits('A', teamA), ...createUnits('B', teamB)];
  }

  unit(uid: string): Unit {
    const u = this.units.find((x) => x.uid === uid);
    if (!u) throw new Error(`Unidade desconhecida: ${uid}`);
    return u;
  }

  alive(team: TeamId): Unit[] {
    return this.units.filter((u) => u.team === team && u.hp > 0);
  }

  canUseSpecial(unit: Unit): boolean {
    return this.chakra[unit.team] >= unit.template.special.chakraCost;
  }

  /** Avança até o próximo ninja apto a agir, iniciando rodadas e pulando atordoados. */
  nextTurn(): BattleEvent[] {
    if (this.outcome) return [];
    if (this.actor) throw new Error(`${this.actor.uid} ainda não agiu.`);

    const events: BattleEvent[] = [];
    for (;;) {
      if (this.queue.length === 0) {
        if (this.round >= this.options.maxRounds) {
          this.outcome = 'draw';
          events.push({ type: 'battle_end', outcome: 'draw' });
          return events;
        }
        events.push(this.startRound());
      }
      const next = this.queue.shift()!;
      if (next.hp <= 0) continue;
      if (next.stunned) {
        next.stunned = false;
        events.push({ type: 'skip', actor: next.uid, reason: 'stunned' });
        continue;
      }
      this.actor = next;
      events.push({ type: 'turn_start', actor: next.uid });
      return events;
    }
  }

  /** Executa a ação do ninja da vez, incluindo os combos que ela disparar. */
  act(action: Action): BattleEvent[] {
    const actor = this.actor;
    if (!actor) throw new Error('Nenhum ninja aguardando ação; chame nextTurn() antes.');

    const events: BattleEvent[] = [];
    const { template } = actor;
    let skill: Skill;
    let kind: 'basic' | 'special';
    if (action.type === 'special') {
      if (!this.canUseSpecial(actor)) {
        throw new Error(`Chakra insuficiente para ${template.special.name}.`);
      }
      const cost = template.special.chakraCost;
      skill = template.special;
      kind = 'special';
      this.chakra[actor.team] -= cost;
      events.push({
        type: 'chakra',
        team: actor.team,
        amount: -cost,
        total: this.chakra[actor.team],
      });
    } else {
      skill = template.basic;
      kind = 'basic';
    }

    const targets = selectTargets(skill.pattern, actor, this.alive(enemyOf(actor.team)));
    events.push({
      type: 'skill',
      actor: actor.uid,
      skillId: skill.id,
      kind,
      targets: targets.map((t) => t.uid),
    });

    for (const target of targets) {
      this.hit(actor, target, skill.power, skill.applies, events);
      if (skill.stuns && target.hp > 0) {
        target.stunned = true;
        events.push({ type: 'status', target: target.uid, status: 'atordoado' });
      }
    }

    const comboTarget = targets.find((t) => t.hp > 0 && t.chaseState);
    if (comboTarget) this.runCombo(actor.team, comboTarget, events);

    // Estados de perseguição só valem durante a ação que os criou.
    for (const u of this.units) u.chaseState = undefined;
    this.actor = undefined;
    this.checkEnd(events);
    return events;
  }

  private startRound(): BattleEvent {
    this.round += 1;
    if (this.round > 1) {
      for (const team of ['A', 'B'] as const) {
        this.chakra[team] = Math.min(
          this.options.maxChakra,
          this.chakra[team] + this.options.chakraPerRound,
        );
      }
    }
    for (const u of this.units) u.chaseUsedThisRound = false;
    this.queue = turnOrder(this.units.filter((u) => u.hp > 0));
    return { type: 'round_start', round: this.round, chakra: { ...this.chakra } };
  }

  private hit(
    source: Unit,
    target: Unit,
    power: number,
    applies: ChaseState | undefined,
    events: BattleEvent[],
  ): void {
    const { amount, elementMultiplier } = computeDamage(source.template, target.template, power);
    target.hp = Math.max(0, target.hp - amount);
    events.push({
      type: 'damage',
      source: source.uid,
      target: target.uid,
      amount,
      hpAfter: target.hp,
      elementMultiplier,
    });
    if (target.hp === 0) {
      target.chaseState = undefined;
      target.stunned = false;
      events.push({ type: 'death', unit: target.uid });
    } else if (applies) {
      target.chaseState = applies;
      events.push({ type: 'status', target: target.uid, status: applies });
    }
  }

  /**
   * Encadeia perseguições: enquanto o alvo estiver vivo e com um estado, o
   * aliado mais rápido que reage a esse estado (e ainda não perseguiu nesta
   * rodada) ataca, consumindo o estado e possivelmente aplicando outro.
   */
  private runCombo(team: TeamId, target: Unit, events: BattleEvent[]): void {
    let count = 0;
    while (count < this.options.comboLimit && target.hp > 0 && target.chaseState) {
      const state = target.chaseState;
      const chaser = turnOrder(
        this.alive(team).filter(
          (u) => !u.stunned && !u.chaseUsedThisRound && u.template.chase?.trigger === state,
        ),
      )[0];
      if (!chaser) break;

      const chase = chaser.template.chase!;
      chaser.chaseUsedThisRound = true;
      target.chaseState = undefined;
      count += 1;
      events.push({
        type: 'skill',
        actor: chaser.uid,
        skillId: chase.id,
        kind: 'chase',
        targets: [target.uid],
      });
      events.push({ type: 'combo', actor: chaser.uid, target: target.uid, count });
      this.hit(chaser, target, chase.power, chase.applies, events);
    }
  }

  private checkEnd(events: BattleEvent[]): void {
    const aAlive = this.alive('A').length > 0;
    const bAlive = this.alive('B').length > 0;
    if (aAlive && bAlive) return;
    this.outcome = aAlive ? 'A' : bAlive ? 'B' : 'draw';
    events.push({ type: 'battle_end', outcome: this.outcome });
  }
}

export function enemyOf(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

/** Mais rápido primeiro; empate decidido pelo time A e depois pelo id. */
export function turnOrder(units: Unit[]): Unit[] {
  return [...units].sort(
    (a, b) =>
      b.template.stats.spd - a.template.stats.spd ||
      a.team.localeCompare(b.team) ||
      a.uid.localeCompare(b.uid),
  );
}

function createUnits(team: TeamId, slots: FormationSlot[]): Unit[] {
  return slots.map(({ ninja, position }) => ({
    uid: `${team}:${ninja.id}`,
    team,
    template: ninja,
    position: { ...position },
    hp: ninja.stats.hp,
    maxHp: ninja.stats.hp,
    stunned: false,
    chaseUsedThisRound: false,
  }));
}
