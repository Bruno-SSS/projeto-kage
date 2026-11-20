import { describe, expect, it } from 'vitest';
import {
  effectiveTemplate,
  feed,
  feedBlocker,
  ninjaProgress,
  starUp,
  starUpCost,
  statMultiplier,
} from '../src/core/evolution';
import { seededRng } from '../src/core/gacha';
import {
  completeMission,
  grant,
  missionEnemies,
  newPlayer,
  refreshBoard,
  xpToNext,
  type PlayerState,
} from '../src/core/progression';
import { NINJAS, ROSTER } from '../src/data/ninjas';
import { PROGRESSAO as cfg } from '../src/data/progressao';
import { freshSave, parseSave } from '../src/ui/session';

const NOW = new Date('2026-11-20T15:00:00Z');
const player = (): PlayerState => newPlayer(['boitata', 'saci'], NOW, cfg);
const withLevel = (s: PlayerState, level: number): PlayerState => ({ ...s, level });
const withFood = (s: PlayerState, food: Record<string, number>): PlayerState => ({ ...s, food });

describe('atributos', () => {
  it('nível 1 e 1 estrela não mudam nada', () => {
    const p = { level: 1, xp: 0, stars: 1 };
    expect(statMultiplier(p, cfg)).toBe(1);
    expect(effectiveTemplate(NINJAS.boitata, p, cfg)).toEqual(NINJAS.boitata);
  });

  it('nível e estrelas multiplicam vida, ataque e defesa; velocidade não muda', () => {
    const p = { level: 11, xp: 0, stars: 3 };
    const m = (1 + cfg.ninjas.crescimentoPorNivel * 10) * (1 + cfg.ninjas.bonusPorEstrela * 2);
    const e = effectiveTemplate(NINJAS.boitata, p, cfg);
    expect(e.stats.hp).toBe(Math.round(NINJAS.boitata.stats.hp * m));
    expect(e.stats.atk).toBe(Math.round(NINJAS.boitata.stats.atk * m));
    expect(e.stats.spd).toBe(NINJAS.boitata.stats.spd);
    expect(NINJAS.boitata.stats.hp).toBe(300); // o elenco original não muda
  });
});

describe('comida e limite de nível', () => {
  it('comida dá XP e sobe o ninja até o limite (nível da conta)', () => {
    const s = withFood(withLevel(player(), 5), { churrasco: 1 });
    const { state, levels } = feed(s, 'boitata', 'churrasco', cfg);
    const p = ninjaProgress(state, 'boitata');
    expect(p.level).toBe(5);
    expect(levels).toBe(4);
    expect(p.xp).toBe(xpToNext(5, cfg) - 1); // parou "quase subindo"
    expect(state.food.churrasco).toBe(0);
  });

  it('sem comida, ninja que não tem ou no limite: bloqueia', () => {
    const s = withFood(player(), { pao: 1 });
    expect(feedBlocker(s, 'boitata', 'ramen', cfg)).toMatch(/Sem Ramen/);
    expect(feedBlocker(s, 'iara', 'pao', cfg)).toMatch(/não tem/);
    const fed = feed(
      withFood(player(), { churrasco: 1, pao: 1 }),
      'boitata',
      'churrasco',
      cfg,
    ).state;
    expect(feedBlocker(fed, 'boitata', 'pao', cfg)).toMatch(/limite de nível/);
  });

  it('não altera o estado recebido', () => {
    const s = withFood(withLevel(player(), 5), { pao: 1 });
    const snapshot = JSON.stringify(s);
    feed(s, 'saci', 'pao', cfg);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('estrelas', () => {
  it('custa fragmentos crescentes até a estrela máxima', () => {
    let s = grant(player(), { fragments: [{ ninjaId: 'saci', amount: 1000 }] }, cfg).state;
    const costs: number[] = [];
    for (let star = 1; star < cfg.ninjas.estrelaMaxima; star++) {
      costs.push(starUpCost(ninjaProgress(s, 'saci'), cfg)!);
      s = starUp(s, 'saci', cfg);
    }
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(ninjaProgress(s, 'saci').stars).toBe(cfg.ninjas.estrelaMaxima);
    expect(s.fragments.saci).toBe(1000 - costs.reduce((a, b) => a + b, 0));
    expect(() => starUp(s, 'saci', cfg)).toThrow(/máxima/);
  });

  it('sem fragmentos suficientes não sobe', () => {
    expect(() => starUp(player(), 'saci', cfg)).toThrow(/insuficientes/);
  });
});

describe('integração com missões e recrutamento', () => {
  it('ninja recrutado começa no nível 1 com 1 estrela', () => {
    const s = grant(player(), { ninjas: ['iara'] }, cfg).state;
    expect(s.ninjas.iara).toEqual({ level: 1, xp: 0, stars: 1 });
  });

  it('missão vencida dá XP da conta aos ninjas do time e comida do rank', () => {
    const s0 = refreshBoard(withLevel(player(), 30), NOW, cfg, seededRng(1));
    const s = {
      ...s0,
      board: {
        ...s0.board,
        missions: s0.board.missions.map((m) => ({ ...m, rank: 'S' as const })),
      },
    };
    const r = completeMission(s, s.board.missions[0].id, true, NOW, cfg, ROSTER, seededRng(2), [
      'boitata',
    ]);
    expect(ninjaProgress(r.state, 'boitata').level).toBeGreaterThan(1);
    expect(ninjaProgress(r.state, 'saci').level).toBe(1); // fora do time
    expect(r.state.food).toEqual(cfg.quadro.ranks.S.comida);
  });

  it('inimigos acompanham o nível da conta', () => {
    const mission = { id: 'x', rank: 'B' as const, done: false, seed: 3 };
    const lv1 = missionEnemies(mission, ROSTER, cfg, 1)[0].ninja.stats.hp;
    const lv20 = missionEnemies(mission, ROSTER, cfg, 20)[0].ninja.stats.hp;
    expect(lv20).toBeGreaterThan(lv1);
  });

  it('save antigo (sem evolução) ganha os campos novos', () => {
    const old = JSON.parse(JSON.stringify(freshSave(NOW, ROSTER, cfg)));
    delete old.player.ninjas;
    delete old.player.food;
    old.player.level = 7;
    const parsed = parseSave(old, NOW, ROSTER, cfg);
    expect(parsed.player.level).toBe(7);
    expect(parsed.player.ninjas.saci).toEqual({ level: 1, xp: 0, stars: 1 });
    expect(parsed.player.food).toEqual({});
  });
});
