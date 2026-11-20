import { describe, expect, it } from 'vitest';
import {
  buildPool,
  createGacha,
  DUPLICATE_FRAGMENTS,
  EPIC_EVERY,
  getSchedule,
  HARD_PITY,
  legendaryChance,
  newPityState,
  pull,
  pullMany,
  RATES,
  ROTATION_EPOCH,
  seededRng,
  SOFT_PITY_START,
  SOFT_PITY_STEP,
  type RosterEntry,
} from '../src/core/gacha';
import { GACHA } from '../src/data/gacha';

const roster: RosterEntry[] = [
  { id: 'l1', name: 'Lenda Um', rarity: 'lendario' },
  { id: 'l2', name: 'Lenda Dois', rarity: 'lendario' },
  { id: 'e1', name: 'Épico', rarity: 'epico' },
  { id: 'e2', name: 'Sem raridade' },
  { id: 'r1', name: 'Raro', rarity: 'raro' },
];
const config = createGacha(roster);
const featured = config.featuredRotation[0]; // destaque de l1

/** RNG que devolve os valores da lista em ordem e depois repete o último. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('pool e configuração', () => {
  it('separa por raridade; sem raridade conta como épico; raro só dá fragmentos', () => {
    expect(buildPool(roster)).toEqual({
      lendario: ['l1', 'l2'],
      epico: ['e1', 'e2'],
      todos: ['l1', 'l2', 'e1', 'e2', 'r1'],
    });
  });

  it('um destaque por lendário, depois as reprises', () => {
    expect(config.featuredRotation.map((b) => b.featured)).toEqual(['l1', 'l2', 'l1', 'l2']);
    expect(config.featuredRotation[0].id).toBe('destaque-chamado-de-lenda-um');
    expect(config.beginner.featured).toBe('l1');
  });

  it('exige ao menos 1 lendário e 1 épico', () => {
    expect(() => createGacha([{ id: 'a', name: 'A', rarity: 'epico' }])).toThrow(/lendário/);
  });

  it('a configuração do jogo sai do elenco real', () => {
    expect(GACHA.pool.lendario).toEqual(['iara', 'cuca']);
    expect(GACHA.pool.epico).toEqual(['boitata', 'saci', 'curupira', 'mapinguari']);
  });
});

describe('chance de lendário (pity)', () => {
  it('base até o início do pity suave, sobe depois e é garantido no pity duro', () => {
    expect(legendaryChance(0)).toBe(RATES.lendario);
    expect(legendaryChance(SOFT_PITY_START - 1)).toBe(RATES.lendario);
    expect(legendaryChance(SOFT_PITY_START)).toBeGreaterThan(RATES.lendario);
    expect(legendaryChance(HARD_PITY - 1)).toBe(1);
  });

  it('o pity suave chega a 100% exatamente na tiragem do pity duro', () => {
    // sinceLegendary 78 = 79ª tiragem; 79 = 80ª
    expect(legendaryChance(HARD_PITY - 2)).toBeLessThan(1);
    expect(legendaryChance(HARD_PITY - 1)).toBe(1);
    expect(RATES.lendario + (HARD_PITY - SOFT_PITY_START) * SOFT_PITY_STEP).toBeCloseTo(1, 9);
  });
});

describe('pull', () => {
  it('não altera o estado recebido', () => {
    const state = newPityState();
    const snapshot = JSON.stringify(state);
    pull(config, featured, state, seededRng(1));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('sem sorte: épico a cada 10 e lendário exatamente no pity duro', () => {
    const { results } = pullMany(config, config.permanent, newPityState(), HARD_PITY, () => 0.99);
    const rarities = results.map((r) => r.rarity);
    // Com o pity suave (+4,85% por tiragem a partir da 61ª) a chance chega a 100% na 80ª,
    // junto com o pity duro.
    const firstLegendary = rarities.indexOf('lendario') + 1;
    expect(firstLegendary).toBe(HARD_PITY);
    let sinceEpic = 0;
    for (const r of rarities.slice(0, firstLegendary)) {
      sinceEpic = r === 'raro' ? sinceEpic + 1 : 0;
      expect(sinceEpic).toBeLessThan(EPIC_EVERY);
    }
  });

  it('perde o 50/50 e o próximo lendário é o destaque', () => {
    // tiragem 1: rola lendário (0), perde o 50/50 (0.9), escolhe o outro lendário (0)
    const lost = pull(config, featured, newPityState(), scripted(0, 0.9, 0));
    expect(lost.rewards[0]).toEqual({ type: 'ninja', ninjaId: 'l2', rarity: 'lendario' });
    expect(lost.state.featuredGuaranteed).toBe(true);

    // tiragem 2: lendário de novo, agora garantido, mesmo com 0.9 no 50/50
    const won = pull(config, featured, lost.state, scripted(0, 0.9));
    expect(won.rewards[0]).toEqual({ type: 'ninja', ninjaId: 'l1', rarity: 'lendario' });
    expect(won.state.featuredGuaranteed).toBe(false);
  });

  it('ninja repetido vira fragmentos', () => {
    const first = pull(config, featured, newPityState(), scripted(0, 0));
    const again = pull(config, featured, first.state, scripted(0, 0));
    expect(again.rewards[0]).toEqual({
      type: 'fragmentos',
      ninjaId: 'l1',
      amount: DUPLICATE_FRAGMENTS.lendario,
    });
  });

  it('marcos do banner em destaque saem na tiragem exata', () => {
    const { results } = pullMany(config, featured, newPityState(), 60, seededRng(7));
    const milestonePulls = results
      .map((r, i) => ({ n: i + 1, extra: r.rewards.slice(1) }))
      .filter((r) => r.extra.length > 0)
      .map((r) => r.n);
    expect(milestonePulls).toEqual([10, 30, 60]);
  });

  it('é determinístico com a mesma semente', () => {
    const a = pullMany(config, featured, newPityState(), 50, seededRng(42));
    const b = pullMany(config, featured, newPityState(), 50, seededRng(42));
    expect(a).toEqual(b);
  });
});

describe('simulação de 100 mil tiragens no elenco real', () => {
  const banner = GACHA.featuredRotation[0];
  const { results } = pullMany(GACHA, banner, newPityState(), 100_000, seededRng(2026));

  let gapLeg = 0;
  let gapEpic = 0;
  let maxGapLeg = 0;
  let maxGapEpic = 0;
  let legendaries = 0;
  let onFeatured = 0;
  const seen = new Set<string>();
  for (const r of results) {
    for (const rw of r.rewards) if (rw.type !== 'moeda') seen.add(rw.ninjaId);
    gapLeg++;
    gapEpic++;
    if (r.rarity === 'lendario') {
      legendaries++;
      const id = r.rewards[0].type === 'moeda' ? '' : r.rewards[0].ninjaId;
      if (id === banner.featured) onFeatured++;
      maxGapLeg = Math.max(maxGapLeg, gapLeg);
      gapLeg = 0;
    }
    if (r.rarity !== 'raro') {
      maxGapEpic = Math.max(maxGapEpic, gapEpic);
      gapEpic = 0;
    }
  }

  it('taxa efetiva de lendário perto de 3,5%', () => {
    const rate = legendaries / results.length;
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.04);
  });

  it('nunca passa do pity duro nem de 10 sem épico', () => {
    expect(maxGapLeg).toBeLessThanOrEqual(HARD_PITY);
    expect(maxGapEpic).toBeLessThanOrEqual(EPIC_EVERY);
  });

  it('cerca de 2/3 dos lendários são o destaque (50/50 com garantia)', () => {
    const share = onFeatured / legendaries;
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(0.72);
  });

  it('todos os ninjas do elenco aparecem', () => {
    expect(seen.size).toBe(6);
  });
});

describe('calendário', () => {
  const HOUR = 3600_000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;

  it('a semana vira na segunda 00:00 de Brasília', () => {
    const monday = new Date(ROTATION_EPOCH);
    const sundayNight = new Date(ROTATION_EPOCH - 60_000);
    expect(getSchedule(config, monday).week).toBe(0);
    expect(getSchedule(config, sundayNight).week).toBe(-1);
    expect(getSchedule(config, monday).startsAt.getTime()).toBe(ROTATION_EPOCH);
  });

  it('o destaque gira por semana e recomeça no fim da lista', () => {
    const featuredAt = (w: number) =>
      getSchedule(config, new Date(ROTATION_EPOCH + w * WEEK + DAY)).banners[0].featured;
    expect([0, 1, 2, 3, 4].map(featuredAt)).toEqual(['l1', 'l2', 'l1', 'l2', 'l1']);
  });

  it('banner de iniciante só nos 8 primeiros dias da conta', () => {
    const now = new Date(ROTATION_EPOCH + 10 * DAY);
    const recent = new Date(now.getTime() - 7 * DAY);
    const old = new Date(now.getTime() - 9 * DAY);
    expect(getSchedule(config, now, recent).banners[0].kind).toBe('iniciante');
    expect(getSchedule(config, now, old).banners.map((b) => b.kind)).toEqual([
      'destaque',
      'permanente',
    ]);
  });

  it('modos diários seguem o dia da semana em Brasília', () => {
    const mondayBrt = getSchedule(config, new Date(ROTATION_EPOCH + HOUR));
    const sundayBrt = getSchedule(config, new Date(ROTATION_EPOCH - HOUR));
    expect(mondayBrt.dailyModes).toContain('desafio-do-festival');
    expect(sundayBrt.dailyModes).toContain('campo-de-faccoes');
    expect(mondayBrt.events).toHaveLength(2);
  });
});
