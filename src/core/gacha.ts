/**
 * Gacha e calendário de eventos com rotação (Projeto Kage).
 *
 * Módulo puro: sem Phaser, sem `Math.random` direto (o RNG é injetado) e sem elenco fixo.
 * O pool e os banners em destaque são DERIVADOS do elenco (`rarity` em `ninjas.json`):
 *
 *   import { GACHA } from '../data/gacha';   // createGacha(ROSTER)
 *   getSchedule(GACHA, new Date());
 *   pull(GACHA, banner, state, rng);
 *
 * Ninja novo no JSON com `rarity` entra no pool sozinho; um lendário novo ganha
 * um banner de destaque na rotação.
 *
 * Rotação:
 * - A semana começa na segunda-feira 00:00 no horário de Brasília (UTC-3).
 * - Banners em destaque giram por semana: cada lendário uma vez, depois as reprises.
 * - Eventos semanais giram num ciclo de 4 semanas em `WEEKLY_EVENT_CYCLE`.
 * - Modos diários dependem do dia da semana em `DAILY_MODES`.
 */

import type { Rarity } from './types';

export type { Rarity };
export type Currency = 'pergaminho' | 'lingote' | 'cupom';

/** O mínimo que o gacha precisa de um ninja (`NinjaTemplate` já satisfaz). */
export interface RosterEntry {
  id: string;
  name: string;
  rarity?: Rarity;
}

export interface Pool {
  lendario: string[];
  epico: string[];
  /** Todos os ids, para fragmentos das tiragens raras. */
  todos: string[];
}

export interface Banner {
  id: string;
  name: string;
  kind: 'destaque' | 'permanente' | 'iniciante';
  /** Ninja com 50% dos lendários e garantia após perder o 50/50. */
  featured?: string;
  cost: { currency: Currency; single: number; multi10: number };
  /** Tiragens acumuladas → recompensa fixa. */
  milestones?: { pulls: number; reward: Reward }[];
}

export type Reward =
  | { type: 'ninja'; ninjaId: string; rarity: Rarity }
  | { type: 'fragmentos'; ninjaId: string; amount: number }
  | { type: 'moeda'; currency: Currency; amount: number };

export const RATES = { lendario: 0.03, epico: 0.15 } as const; // resto = raro (82%)
export const SOFT_PITY_START = 60;
export const SOFT_PITY_STEP = 0.06;
export const HARD_PITY = 80;
export const EPIC_EVERY = 10;
/** Ninja repetido vira fragmentos. */
export const DUPLICATE_FRAGMENTS: Record<Exclude<Rarity, 'raro'>, number> = {
  epico: 20,
  lendario: 50,
};
export const RARE_FRAGMENTS = 5;
export const FRAGMENTS_TO_RECRUIT = 60;

// ---------------------------------------------------------------- config

export interface GachaConfig {
  pool: Pool;
  permanent: Banner;
  beginner: Banner;
  /** Um destaque por semana; ao fim da lista recomeça. */
  featuredRotation: Banner[];
}

const SCROLL_COST = { currency: 'pergaminho', single: 1, multi10: 10 } as const;

/** Ninjas sem `rarity` contam como épicos. */
export function buildPool(roster: readonly RosterEntry[]): Pool {
  const lendario = roster.filter((n) => n.rarity === 'lendario').map((n) => n.id);
  const epico = roster
    .filter((n) => n.rarity !== 'lendario' && n.rarity !== 'raro')
    .map((n) => n.id);
  return { lendario, epico, todos: roster.map((n) => n.id) };
}

export function createGacha(roster: readonly RosterEntry[]): GachaConfig {
  const pool = buildPool(roster);
  if (pool.lendario.length === 0 || pool.epico.length === 0) {
    throw new Error('gacha: o elenco precisa de ao menos 1 ninja lendário e 1 épico');
  }
  const byId = new Map(roster.map((n) => [n.id, n]));
  const legends = pool.lendario.map((id) => byId.get(id)!);
  const featuredRotation = [
    ...legends.map((n) => featuredBanner(n, `Chamado de ${n.name}`)),
    ...legends.map((n) => featuredBanner(n, `${n.name} (reprise)`)),
  ];
  return {
    pool,
    featuredRotation,
    permanent: {
      id: 'permanente',
      name: 'Recrutamento Padrão',
      kind: 'permanente',
      cost: SCROLL_COST,
    },
    beginner: {
      id: 'iniciante',
      name: 'Abertura (8 dias)',
      kind: 'iniciante',
      featured: pool.lendario[0],
      cost: { currency: 'pergaminho', single: 1, multi10: 8 },
    },
  };
}

function featuredBanner(n: RosterEntry, name: string): Banner {
  return {
    id: `destaque-${slug(name)}`,
    name,
    kind: 'destaque',
    featured: n.id,
    cost: SCROLL_COST,
    milestones: [
      { pulls: 10, reward: { type: 'moeda', currency: 'cupom', amount: 100 } },
      { pulls: 30, reward: { type: 'fragmentos', ninjaId: n.id, amount: 20 } },
      { pulls: 60, reward: { type: 'fragmentos', ninjaId: n.id, amount: 40 } },
    ],
  };
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------- eventos

export type EventId =
  | 'roda-dos-selos'
  | 'trilha-do-pergaminho'
  | 'torneio-da-sorte'
  | 'feira-do-mercador'
  | 'festival-de-recrutas';

export interface EventDef {
  id: EventId;
  name: string;
  description: string;
}

export const EVENTS: Record<EventId, EventDef> = {
  'roda-dos-selos': {
    id: 'roda-dos-selos',
    name: 'Roda dos Selos',
    description: 'Cada giro custa cupons; prêmios fixos em 10/30/50 giros acumulados.',
  },
  'trilha-do-pergaminho': {
    id: 'trilha-do-pergaminho',
    name: 'Trilha do Pergaminho',
    description:
      'Dados ganhos em missões diárias andam num tabuleiro. Os dados expiram no domingo.',
  },
  'torneio-da-sorte': {
    id: 'torneio-da-sorte',
    name: 'Torneio da Sorte',
    description: 'Sorteios acumulam pontos; o top 50 da semana ganha prêmios por faixa.',
  },
  'feira-do-mercador': {
    id: 'feira-do-mercador',
    name: 'Feira do Mercador',
    description: 'Pergaminhos com 10–40% de desconto (limite por conta).',
  },
  'festival-de-recrutas': {
    id: 'festival-de-recrutas',
    name: 'Festival de Recrutas',
    description: 'Prêmios por número de recrutamentos feitos na semana, em qualquer banner.',
  },
};

/** Ciclo de 4 semanas; cada semana tem 2 eventos, e nunca repete par em semanas seguidas. */
export const WEEKLY_EVENT_CYCLE: EventId[][] = [
  ['roda-dos-selos', 'festival-de-recrutas'],
  ['trilha-do-pergaminho', 'feira-do-mercador'],
  ['torneio-da-sorte', 'festival-de-recrutas'],
  ['trilha-do-pergaminho', 'roda-dos-selos'],
];

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo

/** Modos com dia fixo (alternam por dia da semana). */
export const DAILY_MODES: Record<Weekday, string[]> = {
  0: ['trilha-moedas', 'trilha-experiencia', 'campo-de-faccoes'],
  1: ['trilha-moedas', 'desafio-do-festival'],
  2: ['trilha-experiencia', 'campo-de-faccoes'],
  3: ['trilha-moedas'],
  4: ['trilha-experiencia', 'campo-de-faccoes'],
  5: ['trilha-moedas', 'desafio-do-festival'],
  6: ['trilha-experiencia', 'prova-de-sobrevivencia-maxima'],
};

// ---------------------------------------------------------------- calendário

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BEGINNER_MS = 8 * 24 * 60 * 60 * 1000;
/** Segunda-feira 2026-01-05 00:00 BRT: semana 0 da rotação. */
export const ROTATION_EPOCH = Date.UTC(2026, 0, 5, 3, 0, 0);

export function weekIndex(now: Date): number {
  return Math.floor((now.getTime() - ROTATION_EPOCH) / WEEK_MS);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export interface Schedule {
  week: number;
  /** Início/fim da semana corrente (fim exclusivo). */
  startsAt: Date;
  endsAt: Date;
  banners: Banner[];
  events: EventDef[];
  dailyModes: string[];
}

/**
 * O que está ativo em `now`.
 * `accountCreatedAt` liga o banner de iniciante nos 8 primeiros dias da conta.
 */
export function getSchedule(config: GachaConfig, now: Date, accountCreatedAt?: Date): Schedule {
  const week = weekIndex(now);
  const startsAt = new Date(ROTATION_EPOCH + week * WEEK_MS);
  const banners = [
    config.featuredRotation[mod(week, config.featuredRotation.length)],
    config.permanent,
  ];
  if (accountCreatedAt && now.getTime() - accountCreatedAt.getTime() < BEGINNER_MS) {
    banners.unshift(config.beginner);
  }
  const weekday = new Date(now.getTime() + BRT_OFFSET_MS).getUTCDay() as Weekday;
  return {
    week,
    startsAt,
    endsAt: new Date(startsAt.getTime() + WEEK_MS),
    banners,
    events: WEEKLY_EVENT_CYCLE[mod(week, WEEKLY_EVENT_CYCLE.length)].map((id) => EVENTS[id]),
    dailyModes: DAILY_MODES[weekday],
  };
}

// ---------------------------------------------------------------- tiragem

/** Estado de pity do jogador (destaques compartilham o mesmo contador). */
export interface PityState {
  sinceLegendary: number;
  sinceEpic: number;
  /** Perdeu o 50/50: o próximo lendário é o destaque. */
  featuredGuaranteed: boolean;
  /** Tiragens por banner id, para os marcos. */
  pullsByBanner: Record<string, number>;
  owned: Record<string, boolean>;
}

export function newPityState(): PityState {
  return {
    sinceLegendary: 0,
    sinceEpic: 0,
    featuredGuaranteed: false,
    pullsByBanner: {},
    owned: {},
  };
}

export function legendaryChance(sinceLegendary: number): number {
  const n = sinceLegendary + 1; // número desta tiragem desde o último lendário
  if (n >= HARD_PITY) return 1;
  if (n <= SOFT_PITY_START) return RATES.lendario;
  return Math.min(1, RATES.lendario + (n - SOFT_PITY_START) * SOFT_PITY_STEP);
}

export interface PullResult {
  rarity: Rarity;
  rewards: Reward[];
  state: PityState;
}

/** Uma tiragem. `rng` retorna [0, 1). Não muta `state`. */
export function pull(
  config: GachaConfig,
  banner: Banner,
  state: PityState,
  rng: () => number,
): PullResult {
  const { pool } = config;
  const s: PityState = {
    ...state,
    pullsByBanner: { ...state.pullsByBanner },
    owned: { ...state.owned },
  };
  const roll = rng();
  const legChance = legendaryChance(s.sinceLegendary);
  let rarity: Rarity;
  if (roll < legChance) rarity = 'lendario';
  else if (s.sinceEpic + 1 >= EPIC_EVERY || roll < legChance + RATES.epico) rarity = 'epico';
  else rarity = 'raro';

  const rewards: Reward[] = [];
  if (rarity === 'raro') {
    rewards.push({ type: 'fragmentos', ninjaId: pick(pool.todos, rng), amount: RARE_FRAGMENTS });
    s.sinceLegendary++;
    s.sinceEpic++;
  } else {
    let ninjaId: string;
    if (rarity === 'lendario' && banner.featured) {
      const others = pool.lendario.filter((id) => id !== banner.featured);
      const wins = s.featuredGuaranteed || others.length === 0 || rng() < 0.5;
      ninjaId = wins ? banner.featured : pick(others, rng);
      s.featuredGuaranteed = !wins;
    } else {
      ninjaId = pick(pool[rarity], rng);
    }
    if (s.owned[ninjaId]) {
      rewards.push({ type: 'fragmentos', ninjaId, amount: DUPLICATE_FRAGMENTS[rarity] });
    } else {
      s.owned[ninjaId] = true;
      rewards.push({ type: 'ninja', ninjaId, rarity });
    }
    if (rarity === 'lendario') s.sinceLegendary = 0;
    else s.sinceLegendary++;
    s.sinceEpic = 0;
  }

  const count = (s.pullsByBanner[banner.id] ?? 0) + 1;
  s.pullsByBanner[banner.id] = count;
  for (const m of banner.milestones ?? []) if (m.pulls === count) rewards.push(m.reward);

  return { rarity, rewards, state: s };
}

export function pullMany(
  config: GachaConfig,
  banner: Banner,
  state: PityState,
  n: number,
  rng: () => number,
) {
  const results: Omit<PullResult, 'state'>[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    const r = pull(config, banner, s, rng);
    results.push({ rarity: r.rarity, rewards: r.rewards });
    s = r.state;
  }
  return { results, state: s };
}

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length)];
}

/** RNG determinístico para testes e replays (mulberry32). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
