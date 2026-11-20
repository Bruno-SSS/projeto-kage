import { describe, expect, it } from 'vitest';
import { runAutoBattle } from '../src/core/ai';
import { Battle } from '../src/core/battle';
import type { BattleEvent } from '../src/core/types';
import { NINJAS } from '../src/data/ninjas';
import { ninja, slot } from './fixtures';

/** Saco de pancadas: muito HP, lento e sem combos. */
const dummy = () => ninja('dummy', { stats: { hp: 100_000, spd: 1 } });

function ofType<T extends BattleEvent['type']>(events: BattleEvent[], type: T) {
  return events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);
}

/** Avança turnos (agindo com básico) até chegar a vez de `uid`. */
function advanceTo(battle: Battle, uid: string): BattleEvent[] {
  const events = battle.nextTurn();
  while (battle.actor && battle.actor.uid !== uid) {
    events.push(...battle.act({ type: 'basic' }), ...battle.nextTurn());
  }
  return events;
}

describe('Battle: estrutura', () => {
  it('recusa formações inválidas', () => {
    expect(() => new Battle([], [slot(dummy())])).toThrow(/Formação A inválida/);
  });

  it('ordem de turno por velocidade; empate favorece o time A', () => {
    const battle = new Battle(
      [
        slot(ninja('lento', { stats: { spd: 10 } }), 0),
        slot(ninja('igual', { stats: { spd: 50 } }), 1),
      ],
      [
        slot(ninja('rapido', { stats: { spd: 99 } }), 0),
        slot(ninja('igual', { stats: { spd: 50 } }), 1),
      ],
    );
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      battle.nextTurn();
      order.push(battle.actor!.uid);
      battle.act({ type: 'basic' });
    }
    expect(order).toEqual(['B:rapido', 'A:igual', 'B:igual', 'A:lento']);
  });

  it('exige nextTurn antes de act e act antes do próximo nextTurn', () => {
    const battle = new Battle([slot(ninja('a'))], [slot(dummy())]);
    expect(() => battle.act({ type: 'basic' })).toThrow(/nextTurn/);
    battle.nextTurn();
    expect(() => battle.nextTurn()).toThrow(/ainda não agiu/);
  });
});

describe('Battle: chakra', () => {
  it('começa em 50, ganha 25 por rodada e trava em 100', () => {
    const battle = new Battle([slot(ninja('a'))], [slot(dummy())]);
    const totals: number[] = [];
    for (let i = 0; i < 4; i++) {
      totals.push(...ofType(battle.nextTurn(), 'round_start').map((e) => e.chakra.A));
      battle.act({ type: 'basic' });
      battle.nextTurn();
      battle.act({ type: 'basic' });
    }
    expect(totals).toEqual([50, 75, 100, 100]);
  });

  it('o especial consome chakra e é recusado sem chakra suficiente', () => {
    const battle = new Battle([slot(ninja('a', { stats: { spd: 99 } }))], [slot(dummy())]);
    battle.nextTurn();
    const events = battle.act({ type: 'special' });
    expect(battle.chakra.A).toBe(0);
    expect(ofType(events, 'damage')[0].amount).toBe(100); // ATK 50 × poder 2

    advanceTo(battle, 'A:a');
    expect(battle.canUseSpecial(battle.actor!)).toBe(false); // 0 + 25 < 50
    expect(() => battle.act({ type: 'special' })).toThrow(/Chakra insuficiente/);
  });
});

describe('Battle: combos', () => {
  // abre: básico derruba. Chasers: derrubado→no_ar, no_ar→derrubado, derrubado→fim
  const abre = ninja('abre', {
    stats: { spd: 120 },
    basic: { id: 'abre-b', name: 'Derrubar', power: 1, pattern: 'single', applies: 'derrubado' },
    chase: { id: 'abre-c', name: 'Cair', power: 1, trigger: 'no_ar', applies: 'derrubado' },
  });
  const lanca = ninja('lanca', {
    stats: { spd: 110 },
    chase: { id: 'lanca-c', name: 'Lançar', power: 1, trigger: 'derrubado', applies: 'no_ar' },
  });
  const fecha = ninja('fecha', {
    stats: { spd: 60 },
    basic: { id: 'fecha-b', name: 'Derrubar', power: 1, pattern: 'single', applies: 'derrubado' },
    chase: { id: 'fecha-c', name: 'Fechar', power: 1, trigger: 'derrubado' },
  });
  const team = () => [slot(abre, 0), slot(lanca, 1), slot(fecha, 2)];

  it('encadeia perseguições na ordem certa e limpa os estados no fim', () => {
    const battle = new Battle(team(), [slot(dummy())]);
    advanceTo(battle, 'A:abre');
    const events = battle.act({ type: 'basic' });

    const combos = ofType(events, 'combo');
    expect(combos.map((c) => [c.actor, c.count])).toEqual([
      ['A:lanca', 1], // derrubado → lança (mais rápido que "fecha")
      ['A:abre', 2], // no_ar → o próprio abridor persegue
      ['A:fecha', 3], // derrubado → fecha, sem novo estado
    ]);
    expect(ofType(events, 'damage')).toHaveLength(4);
    expect(battle.units.every((u) => u.chaseState === undefined)).toBe(true);
  });

  it('cada ninja persegue no máximo uma vez por rodada', () => {
    const battle = new Battle(team(), [slot(dummy())]);
    advanceTo(battle, 'A:abre');
    battle.act({ type: 'basic' });
    // "fecha" derruba mais tarde na mesma rodada, mas todos já perseguiram
    const events = advanceTo(battle, 'A:fecha');
    expect(ofType(events, 'combo')).toHaveLength(0);
    expect(ofType(battle.act({ type: 'basic' }), 'combo')).toHaveLength(0);

    // Na rodada seguinte o combo volta
    const next = advanceTo(battle, 'A:abre');
    expect(ofType(next, 'round_start')[0].round).toBe(2);
    expect(ofType(battle.act({ type: 'basic' }), 'combo')).toHaveLength(3);
  });

  it('respeita o limite de combo', () => {
    const battle = new Battle(team(), [slot(dummy())], { comboLimit: 1 });
    advanceTo(battle, 'A:abre');
    expect(ofType(battle.act({ type: 'basic' }), 'combo')).toHaveLength(1);
  });

  it('o combo para quando o alvo morre', () => {
    const fragil = ninja('fragil', { stats: { hp: 60, spd: 1 } });
    const battle = new Battle(team(), [slot(fragil), slot(dummy(), 0, 2)]);
    advanceTo(battle, 'A:abre');
    const events = battle.act({ type: 'basic' }); // 50 + 50 > 60
    expect(ofType(events, 'combo')).toHaveLength(1);
    expect(ofType(events, 'death').map((d) => d.unit)).toEqual(['B:fragil']);
  });
});

describe('Battle: controle e fim', () => {
  it('atordoado perde a próxima ação', () => {
    const atordoa = ninja('atordoa', {
      stats: { spd: 99 },
      special: {
        id: 'st',
        name: 'Choque',
        power: 0.1,
        pattern: 'single',
        stuns: true,
        chakraCost: 50,
      },
    });
    const battle = new Battle([slot(atordoa)], [slot(ninja('alvo'))]);
    battle.nextTurn();
    battle.act({ type: 'special' });
    const events = battle.nextTurn();
    expect(ofType(events, 'skip').map((e) => e.actor)).toEqual(['B:alvo']);
    expect(battle.actor!.uid).toBe('A:atordoa');
    expect(battle.unit('B:alvo').stunned).toBe(false);
  });

  it('vence quem elimina o time inimigo', () => {
    const battle = new Battle(
      [slot(ninja('forte', { stats: { atk: 500, spd: 99 } }))],
      [slot(ninja('fraco', { stats: { hp: 100 } }))],
    );
    battle.nextTurn();
    const events = battle.act({ type: 'basic' });
    expect(battle.outcome).toBe('A');
    expect(events.at(-1)).toEqual({ type: 'battle_end', outcome: 'A' });
    expect(battle.nextTurn()).toEqual([]);
  });

  it('empata ao passar do limite de rodadas', () => {
    const battle = new Battle([slot(dummy())], [slot(dummy())], { maxRounds: 2 });
    const events = runAutoBattle(battle);
    expect(battle.outcome).toBe('draw');
    expect(ofType(events, 'round_start')).toHaveLength(2);
  });
});

describe('Battle: elenco de exemplo', () => {
  const timeA = () => [
    slot(NINJAS.kaen, 0, 0),
    slot(NINJAS.hayate, 1, 0),
    slot(NINJAS.iwao, 2, 0),
    slot(NINJAS.raiga, 1, 2),
  ];
  const timeB = () => [
    slot(NINJAS.minase, 0, 0),
    slot(NINJAS.iwao, 1, 0),
    slot(NINJAS.raiga, 2, 1),
    slot(NINJAS.hayate, 1, 2),
  ];

  it('uma batalha automática termina e é determinística', () => {
    const first = runAutoBattle(new Battle(timeA(), timeB()));
    const second = runAutoBattle(new Battle(timeA(), timeB()));
    expect(first).toEqual(second);
    expect(first.at(-1)?.type).toBe('battle_end');
  });

  it('o combo planejado do elenco acontece (Kaen → Hayate → Kaen → Iwao)', () => {
    // Time A só usa básicos, para o Kaen abrir o combo com o golpe que derruba
    const events = runAutoBattle(new Battle(timeA(), timeB()), { A: () => ({ type: 'basic' }) });
    const chains: string[][] = [];
    let current: string[] = [];
    for (const e of events) {
      if (e.type === 'combo') {
        if (e.count === 1) chains.push((current = []));
        current.push(e.actor);
      }
    }
    expect(chains).toContainEqual(['A:hayate', 'A:kaen', 'A:iwao']);
  });
});
