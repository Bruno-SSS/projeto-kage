import { FRAGMENTS_TO_RECRUIT, seededRng, type Reward } from './gacha';
import type { StoryProgress } from './story';
import type { FormationSlot, NinjaTemplate, Position } from './types';

/**
 * Progressão do jogador: nível e XP, moedas, fragmentos, missões diárias,
 * quadro de missões D–S e bônus por dia da semana.
 *
 * Módulo puro: toda função recebe o estado e devolve um estado novo (nunca
 * altera o recebido). Datas e RNG são injetados, então tudo é testável.
 * Os números vêm de src/data/progressao.json.
 */

export type Activity = 'vitoria' | 'missao' | 'recrutamento' | 'historia';
export type MissionRank = 'D' | 'C' | 'B' | 'A' | 'S';
export const MISSION_RANKS: MissionRank[] = ['D', 'C', 'B', 'A', 'S'];
type Resource = 'xp' | 'ryo';

export interface RankConfig {
  chance: number;
  xp: number;
  ryo: number;
  fragmentos: number;
  inimigos: number;
  forcaInimigo: number;
  comida?: FoodBag;
}

/** Quantidade de cada comida, ex. { "pao": 2 }. */
export type FoodBag = Record<string, number>;

export interface NinjaProgress {
  level: number;
  /** XP dentro do nível atual. */
  xp: number;
  stars: number;
}

export interface EvolutionConfig {
  /** Atributos (vida, ataque, defesa) +N por nível acima do 1 (0.04 = +4%). */
  crescimentoPorNivel: number;
  /** Quantos níveis o ninja pode passar do nível da conta. */
  folgaSobreNivelConta: number;
  /** Estrelas com que um ninja chega ao jogador. */
  estrelaInicial: number;
  /** Multiplicador de vida, ataque e defesa por estrela: { "3": 1.1, ... }. */
  multiplicadorEstrela: Record<string, number>;
  estrelaMaxima: number;
  /** Fragmentos para chegar a cada estrela: { "2": 20, ... }. */
  custoEstrela: Record<string, number>;
  comida: Record<string, { nome: string; xp: number }>;
}

export interface DailyTaskConfig {
  id: string;
  nome: string;
  atividade: Activity;
  quantidade: number;
  xp?: number;
  ryo?: number;
  cupom?: number;
  pergaminho?: number;
  comida?: FoodBag;
}

export interface ProgressionConfig {
  nivel: {
    maximo: number;
    /** XP para passar do nível N, por nível. Níveis faltando são interpolados. */
    tabelaXp: Record<string, number>;
    /** Crescimento por nível depois do último da tabela (0.076 = +7,6%). */
    crescimentoAposTabela: number;
    presentes: { nivel: number; ryo?: number; cupom?: number; pergaminho?: number }[];
  };
  dia: { horaReset: number; loginRyo: number };
  quadro: {
    tamanho: number;
    renovaMinutos: number;
    maxPorDia: number;
    maxRankSPorDia: number;
    ranks: Record<MissionRank, RankConfig>;
  };
  diarias: DailyTaskConfig[];
  bonusSemanal: Record<string, { atividade: Activity; recurso: Resource; multiplicador: number }[]>;
  ninjas: EvolutionConfig;
}

export interface Wallet {
  ryo: number;
  cupom: number;
  pergaminho: number;
  lingote: number;
}

export interface Mission {
  id: string;
  rank: MissionRank;
  done: boolean;
  /** Semente para montar sempre o mesmo time inimigo. */
  seed: number;
}

export interface PlayerState {
  level: number;
  /** XP acumulado dentro do nível atual. */
  xp: number;
  wallet: Wallet;
  fragments: Record<string, number>;
  owned: Record<string, boolean>;
  /** Nível, XP e estrelas de cada ninja que o jogador tem. */
  ninjas: Record<string, NinjaProgress>;
  food: FoodBag;
  story: StoryProgress;
  /** Energia do modo história e o instante da última atualização (ms). */
  stamina: { value: number; at: number };
  /** Dia de jogo corrente (vira às `horaReset` de Brasília), ex. "2026-11-20". */
  day: string;
  daily: {
    missionsDone: number;
    rankSDone: number;
    progress: Partial<Record<Activity, number>>;
    claimed: string[];
  };
  board: { slot: number; missions: Mission[] };
}

/** O que uma ação rende. Tudo opcional. */
export interface Grant {
  xp?: number;
  ryo?: number;
  cupom?: number;
  pergaminho?: number;
  lingote?: number;
  fragments?: { ninjaId: string; amount: number }[];
  ninjas?: string[];
  food?: FoodBag;
  /** XP para os ninjas do time (cada um recebe o valor inteiro). */
  teamXp?: { ids: string[]; amount: number };
}

export interface GrantResult {
  state: PlayerState;
  /** Níveis alcançados nesta concessão, em ordem. */
  levelUps: number[];
}

const BRT_OFFSET_MS = -3 * 3600_000;

// -------------------------------------------------------------- nível

/**
 * XP para passar do nível `level`. Usa a tabela; entre dois níveis conhecidos
 * interpola em escala logarítmica (crescimento percentual constante), e depois
 * do último cresce `crescimentoAposTabela` por nível.
 */
export function xpToNext(level: number, cfg: ProgressionConfig): number {
  const points = Object.entries(cfg.nivel.tabelaXp)
    .map(([lv, xp]) => [Number(lv), xp] as const)
    .sort((a, b) => a[0] - b[0]);
  const exact = points.find(([lv]) => lv === level);
  if (exact) return exact[1];
  const first = points[0];
  if (level < first[0]) return first[1];
  const last = points[points.length - 1];
  if (level > last[0]) {
    return Math.round(last[1] * Math.pow(1 + cfg.nivel.crescimentoAposTabela, level - last[0]));
  }
  const upper = points.findIndex(([lv]) => lv > level);
  const [lv0, xp0] = points[upper - 1];
  const [lv1, xp1] = points[upper];
  const t = (level - lv0) / (lv1 - lv0);
  return Math.round(xp0 * Math.pow(xp1 / xp0, t));
}

export function newPlayer(starters: string[], now: Date, cfg: ProgressionConfig): PlayerState {
  return {
    level: 1,
    xp: 0,
    wallet: { ryo: 0, cupom: 0, pergaminho: 0, lingote: 0 },
    fragments: {},
    owned: Object.fromEntries(starters.map((id) => [id, true])),
    ninjas: Object.fromEntries(starters.map((id) => [id, newNinjaProgress(cfg)])),
    food: {},
    story: { stars: {}, bestDeaths: {}, challenges: [], rewarded: [], perfect: [] },
    stamina: { value: 0, at: now.getTime() },
    day: dayKey(now, cfg),
    daily: { missionsDone: 0, rankSDone: 0, progress: {}, claimed: [] },
    board: { slot: -1, missions: [] },
  };
}

/** Aplica recompensas: moedas, fragmentos, ninjas e XP (com subida de nível e presentes). */
export function grant(state: PlayerState, g: Grant, cfg: ProgressionConfig): GrantResult {
  const s = structuredClone(state);
  s.wallet.ryo += g.ryo ?? 0;
  s.wallet.cupom += g.cupom ?? 0;
  s.wallet.pergaminho += g.pergaminho ?? 0;
  s.wallet.lingote += g.lingote ?? 0;
  for (const f of g.fragments ?? [])
    s.fragments[f.ninjaId] = (s.fragments[f.ninjaId] ?? 0) + f.amount;
  for (const id of g.ninjas ?? []) {
    s.owned[id] = true;
    s.ninjas[id] ??= newNinjaProgress(cfg);
  }
  for (const [food, n] of Object.entries(g.food ?? {})) s.food[food] = (s.food[food] ?? 0) + n;

  const levelUps: number[] = [];
  s.xp += g.xp ?? 0;
  while (s.level < cfg.nivel.maximo && s.xp >= xpToNext(s.level, cfg)) {
    s.xp -= xpToNext(s.level, cfg);
    s.level += 1;
    levelUps.push(s.level);
    const gift = cfg.nivel.presentes.find((p) => p.nivel === s.level);
    if (gift) {
      s.wallet.ryo += gift.ryo ?? 0;
      s.wallet.cupom += gift.cupom ?? 0;
      s.wallet.pergaminho += gift.pergaminho ?? 0;
    }
  }
  if (s.level >= cfg.nivel.maximo) s.xp = 0;

  // Ninjas depois da conta: o limite deles depende do nível da conta.
  for (const id of g.teamXp?.ids ?? []) {
    if (s.owned[id]) addNinjaXpInPlace(s, id, g.teamXp!.amount, cfg);
  }
  return { state: s, levelUps };
}

export function newNinjaProgress(cfg: ProgressionConfig): NinjaProgress {
  return { level: 1, xp: 0, stars: cfg.ninjas.estrelaInicial };
}

/** Nível máximo que um ninja pode ter agora. */
export function ninjaLevelCap(state: PlayerState, cfg: ProgressionConfig): number {
  return Math.min(cfg.nivel.maximo, state.level + cfg.ninjas.folgaSobreNivelConta);
}

/**
 * Soma XP a um ninja (mesma curva da conta). No limite de nível o XP para em
 * "quase subindo" e o excedente se perde. Devolve quantos níveis subiu.
 */
export function addNinjaXpInPlace(
  s: PlayerState,
  id: string,
  amount: number,
  cfg: ProgressionConfig,
): number {
  const p = (s.ninjas[id] ??= newNinjaProgress(cfg));
  const cap = ninjaLevelCap(s, cfg);
  const start = p.level;
  p.xp += amount;
  while (p.level < cap && p.xp >= xpToNext(p.level, cfg)) {
    p.xp -= xpToNext(p.level, cfg);
    p.level += 1;
  }
  if (p.level >= cap) p.xp = Math.min(p.xp, xpToNext(p.level, cfg) - 1);
  return p.level - start;
}

/** Converte o resultado do gacha em concessão. */
export function grantFromRewards(rewards: Reward[]): Grant {
  const g: Required<Pick<Grant, 'fragments' | 'ninjas'>> & Grant = { fragments: [], ninjas: [] };
  for (const r of rewards) {
    if (r.type === 'ninja') g.ninjas.push(r.ninjaId);
    else if (r.type === 'fragmentos') g.fragments.push({ ninjaId: r.ninjaId, amount: r.amount });
    else g[r.currency] = (g[r.currency] ?? 0) + r.amount;
  }
  return g;
}

/** Troca fragmentos por um ninja que o jogador ainda não tem. */
export function recruitWithFragments(
  state: PlayerState,
  ninjaId: string,
  cfg: ProgressionConfig,
  needed = FRAGMENTS_TO_RECRUIT,
): PlayerState {
  if (state.owned[ninjaId]) throw new Error(`Você já tem ${ninjaId}.`);
  const have = state.fragments[ninjaId] ?? 0;
  if (have < needed) throw new Error(`Fragmentos insuficientes: ${have}/${needed}.`);
  const s = structuredClone(state);
  s.fragments[ninjaId] = have - needed;
  s.owned[ninjaId] = true;
  s.ninjas[ninjaId] ??= newNinjaProgress(cfg);
  return s;
}

// -------------------------------------------------------------- dia

/** Dia de jogo: o dia vira às `horaReset` no horário de Brasília. */
export function dayKey(now: Date, cfg: ProgressionConfig): string {
  const t = now.getTime() + BRT_OFFSET_MS - cfg.dia.horaReset * 3600_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Dia da semana do dia de jogo (0 = domingo). */
export function gameWeekday(now: Date, cfg: ProgressionConfig): number {
  return new Date(`${dayKey(now, cfg)}T12:00:00Z`).getUTCDay();
}

/**
 * Chame ao abrir o jogo e periodicamente. Se o dia virou, zera as diárias e
 * dá o ryo de login. `loginGranted` diz se houve virada.
 */
export function startDay(
  state: PlayerState,
  now: Date,
  cfg: ProgressionConfig,
): { state: PlayerState; loginGranted: boolean } {
  const today = dayKey(now, cfg);
  if (state.day === today && state.daily.claimed.includes('__login')) {
    return { state, loginGranted: false };
  }
  const s = structuredClone(state);
  if (s.day !== today) {
    s.day = today;
    s.daily = { missionsDone: 0, rankSDone: 0, progress: {}, claimed: [] };
  }
  s.daily.claimed.push('__login');
  s.wallet.ryo += cfg.dia.loginRyo;
  return { state: s, loginGranted: true };
}

export function bonusMultiplier(
  now: Date,
  activity: Activity,
  resource: Resource,
  cfg: ProgressionConfig,
): number {
  const today = cfg.bonusSemanal[String(gameWeekday(now, cfg))] ?? [];
  return today
    .filter((b) => b.atividade === activity && b.recurso === resource)
    .reduce((m, b) => m * b.multiplicador, 1);
}

// -------------------------------------------------------------- diárias

export function recordActivity(state: PlayerState, activity: Activity, amount = 1): PlayerState {
  const s = structuredClone(state);
  s.daily.progress[activity] = (s.daily.progress[activity] ?? 0) + amount;
  return s;
}

export interface DailyStatus {
  task: DailyTaskConfig;
  progress: number;
  claimable: boolean;
  claimed: boolean;
}

export function dailyStatus(state: PlayerState, cfg: ProgressionConfig): DailyStatus[] {
  return cfg.diarias.map((task) => {
    const progress = Math.min(task.quantidade, state.daily.progress[task.atividade] ?? 0);
    const claimed = state.daily.claimed.includes(task.id);
    return { task, progress, claimed, claimable: !claimed && progress >= task.quantidade };
  });
}

export function claimDaily(
  state: PlayerState,
  taskId: string,
  cfg: ProgressionConfig,
): GrantResult {
  const status = dailyStatus(state, cfg).find((d) => d.task.id === taskId);
  if (!status) throw new Error(`Missão diária desconhecida: ${taskId}`);
  if (!status.claimable) throw new Error(`"${status.task.nome}" não pode ser resgatada.`);
  const { xp, ryo, cupom, pergaminho, comida } = status.task;
  const s = structuredClone(state);
  s.daily.claimed.push(taskId);
  return grant(s, { xp, ryo, cupom, pergaminho, food: comida }, cfg);
}

// -------------------------------------------------------------- quadro D–S

export function boardSlot(now: Date, cfg: ProgressionConfig): number {
  return Math.floor(now.getTime() / (cfg.quadro.renovaMinutos * 60_000));
}

export function rollRank(roll: number, cfg: ProgressionConfig): MissionRank {
  let acc = 0;
  for (const rank of MISSION_RANKS) {
    acc += cfg.quadro.ranks[rank].chance;
    if (roll < acc) return rank;
  }
  return 'D';
}

/** Gera um quadro novo quando a janela de renovação mudou. */
export function refreshBoard(
  state: PlayerState,
  now: Date,
  cfg: ProgressionConfig,
  rng: () => number,
): PlayerState {
  const slot = boardSlot(now, cfg);
  if (state.board.slot === slot) return state;
  const s = structuredClone(state);
  s.board = {
    slot,
    missions: Array.from({ length: cfg.quadro.tamanho }, (_, i) => ({
      id: `m${slot}-${i}`,
      rank: rollRank(rng(), cfg),
      done: false,
      seed: Math.floor(rng() * 2 ** 31),
    })),
  };
  return s;
}

/** Motivo pelo qual a missão não pode ser feita agora, ou `null` se pode. */
export function missionBlocker(
  state: PlayerState,
  missionId: string,
  cfg: ProgressionConfig,
): string | null {
  const m = state.board.missions.find((x) => x.id === missionId);
  if (!m) return 'Missão não está no quadro.';
  if (m.done) return 'Missão já concluída.';
  if (state.daily.missionsDone >= cfg.quadro.maxPorDia) {
    return `Limite de ${cfg.quadro.maxPorDia} missões por dia atingido.`;
  }
  if (m.rank === 'S' && state.daily.rankSDone >= cfg.quadro.maxRankSPorDia) {
    return `Limite de ${cfg.quadro.maxRankSPorDia} missões rank S por dia atingido.`;
  }
  return null;
}

const ENEMY_POSITIONS: Position[] = [
  { row: 1, col: 0 },
  { row: 0, col: 0 },
  { row: 2, col: 0 },
  { row: 1, col: 1 },
];

/**
 * Time inimigo da missão: ninjas sorteados do elenco, no nível `enemyLevel`
 * (normalmente o nível da conta), mais fracos ou mais fortes conforme o rank.
 */
export function missionEnemies(
  mission: Mission,
  roster: NinjaTemplate[],
  cfg: ProgressionConfig,
  enemyLevel = 1,
): FormationSlot[] {
  const rank = cfg.quadro.ranks[mission.rank];
  const rng = seededRng(mission.seed);
  const pool = [...roster];
  const count = Math.min(rank.inimigos, pool.length, ENEMY_POSITIONS.length);
  return Array.from({ length: count }, (_, i) => {
    const [base] = pool.splice(Math.floor(rng() * pool.length), 1);
    const f = rank.forcaInimigo * (1 + cfg.ninjas.crescimentoPorNivel * (enemyLevel - 1));
    const ninja: NinjaTemplate = {
      ...base,
      stats: {
        ...base.stats,
        hp: Math.max(1, Math.round(base.stats.hp * f)),
        atk: Math.round(base.stats.atk * f),
        def: Math.round(base.stats.def * f),
      },
    };
    return { ninja, position: ENEMY_POSITIONS[i] };
  });
}

/**
 * Registra o resultado de uma missão. Vitória conclui a missão e paga as
 * recompensas do rank (com o bônus do dia); derrota não muda nada.
 */
export function completeMission(
  state: PlayerState,
  missionId: string,
  won: boolean,
  now: Date,
  cfg: ProgressionConfig,
  roster: NinjaTemplate[],
  rng: () => number,
  /** Ninjas do time, que ganham o mesmo XP da conta. */
  teamIds: string[] = [],
): GrantResult & { reward: Grant } {
  const blocker = missionBlocker(state, missionId, cfg);
  if (blocker) throw new Error(blocker);
  if (!won) return { state, levelUps: [], reward: {} };

  const s = structuredClone(state);
  const mission = s.board.missions.find((m) => m.id === missionId)!;
  const rank = cfg.quadro.ranks[mission.rank];
  mission.done = true;
  s.daily.missionsDone += 1;
  if (mission.rank === 'S') s.daily.rankSDone += 1;
  s.daily.progress.missao = (s.daily.progress.missao ?? 0) + 1;
  s.daily.progress.vitoria = (s.daily.progress.vitoria ?? 0) + 1;

  const xp = rank.xp * bonusMultiplier(now, 'missao', 'xp', cfg);
  const reward: Grant = {
    xp,
    ryo: rank.ryo * bonusMultiplier(now, 'missao', 'ryo', cfg),
    teamXp: { ids: teamIds, amount: xp },
  };
  if (rank.comida) reward.food = { ...rank.comida };
  if (rank.fragmentos > 0 && roster.length > 0) {
    const ninjaId = roster[Math.floor(rng() * roster.length)].id;
    reward.fragments = [{ ninjaId, amount: rank.fragmentos }];
  }
  return { ...grant(s, reward, cfg), reward };
}
