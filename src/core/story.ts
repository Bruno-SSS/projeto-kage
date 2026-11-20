import {
  bonusMultiplier,
  grant,
  type FoodBag,
  type Grant,
  type PlayerState,
  type ProgressionConfig,
} from './progression';
import type { FormationSlot, NinjaTemplate } from './types';

/**
 * Modo história: capítulos com fases em sequência. Cada fase tem algumas lutas
 * (a última é o objetivo) e um desafio opcional mais forte. Estrelas (máx. 3):
 * ★ vencer o objetivo, ★ no máximo N baixas somando as lutas da fase,
 * ★ vencer o desafio. Com 3★ a fase pode ser varrida. Puro, como progression.ts.
 */

export interface StageBonus {
  comida?: FoodBag;
  pergaminho?: number;
  ryo?: number;
  cupom?: number;
  fragmentos?: Record<string, number>;
}

export interface Fight {
  /** Multiplicador extra de vida/ataque/defesa desta luta. */
  forca?: number;
  inimigos: { id: string; row: number; col: number }[];
}

export interface StageDef {
  id: string;
  nome: string;
  chefe?: boolean;
  /** Nível da conta para jogar a fase. */
  nivelMinimo?: number;
  nivelInimigo: number;
  /** Multiplicador extra aplicado a todas as lutas (chefes). */
  forca?: number;
  /** Lutas em sequência; a última é o objetivo da fase. */
  lutas: Fight[];
  /** Luta opcional mais forte (vale uma estrela). */
  desafio?: Fight;
  primeiraVez?: StageBonus;
}

export interface ChapterDef {
  id: string;
  nome: string;
  nivelMinimo: number;
  texto: string;
  conclusao: StageBonus;
  bonus3Estrelas: StageBonus;
  fases: StageDef[];
}

export interface StoryConfig {
  energia: {
    inicial: number;
    regenMinutos: number;
    /** A regeneração natural para neste valor. */
    tetoRegen: number;
    /** Energia dada no primeiro acesso de cada dia. */
    diaria: number;
    /** Ninguém acumula mais que isso. */
    maximo: number;
    custoFase: number;
  };
  premioPorEnergia: { xp: number; ryo: number };
  estrelas: { maxMortes: number };
  varredura: { exige3Estrelas: boolean; maxPorVez: number };
  /** Rodadas por batalha antes do empate (empate = derrota). */
  limiteRodadas: number;
  capitulos: ChapterDef[];
}

export interface StoryProgress {
  /** Estrelas atuais de cada fase (ausente = objetivo nunca vencido). */
  stars: Record<string, number>;
  /** Menor número de baixas numa passagem completa da fase. */
  bestDeaths: Record<string, number>;
  /** Fases com o desafio vencido. */
  challenges: string[];
  /** Capítulos cujo prêmio de conclusão já foi pago. */
  rewarded: string[];
  /** Capítulos cujo bônus de 3★ já foi pago. */
  perfect: string[];
}

export function newStoryProgress(): StoryProgress {
  return { stars: {}, bestDeaths: {}, challenges: [], rewarded: [], perfect: [] };
}

// -------------------------------------------------------------- energia

/** Energia atual, contando a regeneração desde a última atualização. */
export function currentStamina(state: PlayerState, now: Date, sc: StoryConfig): number {
  const { value, at } = state.stamina;
  if (value >= sc.energia.tetoRegen) return value;
  const ticks = Math.floor((now.getTime() - at) / (sc.energia.regenMinutos * 60_000));
  return Math.min(sc.energia.tetoRegen, value + Math.max(0, ticks));
}

/** Grava a regeneração no estado, guardando a fração de tempo que sobrou. */
export function syncStamina(state: PlayerState, now: Date, sc: StoryConfig): PlayerState {
  const value = currentStamina(state, now, sc);
  const tick = sc.energia.regenMinutos * 60_000;
  let at = now.getTime();
  if (value < sc.energia.tetoRegen) {
    const gained = value - state.stamina.value;
    at = state.stamina.at + gained * tick;
  }
  return { ...state, stamina: { value, at } };
}

/** Minutos até o próximo ponto de energia, ou null se não regenera agora. */
export function minutesToNextStamina(
  state: PlayerState,
  now: Date,
  sc: StoryConfig,
): number | null {
  const s = syncStamina(state, now, sc);
  if (s.stamina.value >= sc.energia.tetoRegen) return null;
  const next = s.stamina.at + sc.energia.regenMinutos * 60_000;
  return Math.ceil((next - now.getTime()) / 60_000);
}

export function addStamina(
  state: PlayerState,
  amount: number,
  now: Date,
  sc: StoryConfig,
): PlayerState {
  const s = syncStamina(state, now, sc);
  return {
    ...s,
    stamina: { ...s.stamina, value: Math.min(sc.energia.maximo, s.stamina.value + amount) },
  };
}

// -------------------------------------------------------------- acesso

export function findStage(
  sc: StoryConfig,
  stageId: string,
): { chapter: ChapterDef; stage: StageDef; index: number } {
  for (const chapter of sc.capitulos) {
    const index = chapter.fases.findIndex((f) => f.id === stageId);
    if (index >= 0) return { chapter, stage: chapter.fases[index], index };
  }
  throw new Error(`Fase desconhecida: ${stageId}`);
}

export function chapterCleared(state: PlayerState, chapter: ChapterDef): boolean {
  return chapter.fases.every((f) => (state.story.stars[f.id] ?? 0) > 0);
}

/** Motivo pelo qual o capítulo está fechado, ou null. */
export function chapterBlocker(
  state: PlayerState,
  chapterId: string,
  sc: StoryConfig,
): string | null {
  const i = sc.capitulos.findIndex((c) => c.id === chapterId);
  if (i < 0) return 'Capítulo desconhecido.';
  const chapter = sc.capitulos[i];
  if (i > 0 && !chapterCleared(state, sc.capitulos[i - 1])) {
    return `Conclua "${sc.capitulos[i - 1].nome}" primeiro.`;
  }
  if (state.level < chapter.nivelMinimo) return `Requer nível ${chapter.nivelMinimo}.`;
  return null;
}

/** Motivo pelo qual a fase não pode ser jogada agora, ou null. */
export function stageBlocker(
  state: PlayerState,
  stageId: string,
  now: Date,
  sc: StoryConfig,
): string | null {
  const { chapter, stage, index } = findStage(sc, stageId);
  const closed = chapterBlocker(state, chapter.id, sc);
  if (closed) return closed;
  if (index > 0 && !(state.story.stars[chapter.fases[index - 1].id] > 0)) {
    return 'Vença a fase anterior primeiro.';
  }
  if (stage.nivelMinimo && state.level < stage.nivelMinimo) {
    return `Requer nível ${stage.nivelMinimo}.`;
  }
  if (currentStamina(state, now, sc) < sc.energia.custoFase) {
    return `Energia insuficiente (precisa de ${sc.energia.custoFase}).`;
  }
  return null;
}

/** Motivo pelo qual o desafio não pode ser jogado, ou null. Não custa energia. */
export function challengeBlocker(
  state: PlayerState,
  stageId: string,
  sc: StoryConfig,
): string | null {
  const { stage } = findStage(sc, stageId);
  if (!stage.desafio) return 'Esta fase não tem desafio.';
  if (!(state.story.stars[stageId] > 0)) return 'Vença o objetivo da fase primeiro.';
  if (state.story.challenges.includes(stageId)) return 'Desafio já vencido.';
  return null;
}

function fightEnemies(
  stage: StageDef,
  fight: Fight,
  ninjas: Record<string, NinjaTemplate>,
  pc: ProgressionConfig,
): FormationSlot[] {
  const f =
    (stage.forca ?? 1) *
    (fight.forca ?? 1) *
    (1 + pc.ninjas.crescimentoPorNivel * (stage.nivelInimigo - 1));
  return fight.inimigos.map(({ id, row, col }) => {
    const base = ninjas[id];
    if (!base) throw new Error(`Fase ${stage.id}: ninja desconhecido "${id}".`);
    return {
      ninja: {
        ...base,
        stats: {
          ...base.stats,
          hp: Math.max(1, Math.round(base.stats.hp * f)),
          atk: Math.round(base.stats.atk * f),
          def: Math.round(base.stats.def * f),
        },
      },
      position: { row, col },
    };
  });
}

/** Inimigos da luta `wave` (0 = primeira) da fase. */
export function stageEnemies(
  stage: StageDef,
  ninjas: Record<string, NinjaTemplate>,
  pc: ProgressionConfig,
  wave = stage.lutas.length - 1,
): FormationSlot[] {
  const fight = stage.lutas[wave];
  if (!fight) throw new Error(`Fase ${stage.id}: luta ${wave} não existe.`);
  return fightEnemies(stage, fight, ninjas, pc);
}

export function challengeEnemies(
  stage: StageDef,
  ninjas: Record<string, NinjaTemplate>,
  pc: ProgressionConfig,
): FormationSlot[] {
  if (!stage.desafio) throw new Error(`Fase ${stage.id} não tem desafio.`);
  return fightEnemies(stage, stage.desafio, ninjas, pc);
}

/** ★ objetivo + ★ baixas dentro do limite + ★ desafio. */
export function starsFor(bestDeaths: number, challenge: boolean, sc: StoryConfig): number {
  return 1 + (bestDeaths <= sc.estrelas.maxMortes ? 1 : 0) + (challenge ? 1 : 0);
}

// -------------------------------------------------------------- resultado

function addBonus(g: Grant, b: StageBonus | undefined): void {
  if (!b) return;
  g.ryo = (g.ryo ?? 0) + (b.ryo ?? 0);
  g.cupom = (g.cupom ?? 0) + (b.cupom ?? 0);
  g.pergaminho = (g.pergaminho ?? 0) + (b.pergaminho ?? 0);
  for (const [food, n] of Object.entries(b.comida ?? {})) {
    g.food = { ...g.food, [food]: (g.food?.[food] ?? 0) + n };
  }
  for (const [ninjaId, amount] of Object.entries(b.fragmentos ?? {})) {
    g.fragments = [...(g.fragments ?? []), { ninjaId, amount }];
  }
}

export interface StageResult {
  state: PlayerState;
  reward: Grant;
  levelUps: number[];
  stars: number;
  firstClear: boolean;
  chapterCompleted: boolean;
  chapterPerfect: boolean;
}

/** Recalcula as estrelas da fase e paga os prêmios de capítulo que ficaram devidos. */
function updateStarsAndChapter(s: PlayerState, stageId: string, reward: Grant, sc: StoryConfig) {
  const { chapter } = findStage(sc, stageId);
  const stars = starsFor(
    s.story.bestDeaths[stageId] ?? Infinity,
    s.story.challenges.includes(stageId),
    sc,
  );
  s.story.stars[stageId] = Math.max(s.story.stars[stageId] ?? 0, stars);

  let chapterCompleted = false;
  if (!s.story.rewarded.includes(chapter.id) && chapterCleared(s, chapter)) {
    s.story.rewarded.push(chapter.id);
    addBonus(reward, chapter.conclusao);
    chapterCompleted = true;
  }
  let chapterPerfect = false;
  if (
    !s.story.perfect.includes(chapter.id) &&
    chapter.fases.every((f) => s.story.stars[f.id] === 3)
  ) {
    s.story.perfect.push(chapter.id);
    addBonus(reward, chapter.bonus3Estrelas);
    chapterPerfect = true;
  }
  return { stars: s.story.stars[stageId], chapterCompleted, chapterPerfect };
}

/** XP e ryo de uma passagem pela fase (com o bônus do dia). */
function passReward(now: Date, sc: StoryConfig, pc: ProgressionConfig, teamIds: string[]): Grant {
  const energy = sc.energia.custoFase;
  const xp = energy * sc.premioPorEnergia.xp * bonusMultiplier(now, 'historia', 'xp', pc);
  return {
    xp,
    ryo: energy * sc.premioPorEnergia.ryo * bonusMultiplier(now, 'historia', 'ryo', pc),
    teamXp: { ids: teamIds, amount: xp },
  };
}

/**
 * Registra uma passagem completa pela fase (todas as lutas). `deaths` é a soma
 * das baixas em todas as lutas. Derrota não gasta energia. Vitória gasta a
 * energia, paga XP e ryo, o prêmio de primeira vez e os do capítulo.
 */
export function completeStage(
  state: PlayerState,
  stageId: string,
  won: boolean,
  deaths: number,
  now: Date,
  sc: StoryConfig,
  pc: ProgressionConfig,
  teamIds: string[] = [],
): StageResult {
  const blocker = stageBlocker(state, stageId, now, sc);
  if (blocker) throw new Error(blocker);
  if (!won) {
    return {
      state,
      reward: {},
      levelUps: [],
      stars: state.story.stars[stageId] ?? 0,
      firstClear: false,
      chapterCompleted: false,
      chapterPerfect: false,
    };
  }

  const { stage } = findStage(sc, stageId);
  const s = structuredClone(syncStamina(state, now, sc));
  s.stamina.value -= sc.energia.custoFase;
  const firstClear = !(s.story.stars[stageId] > 0);
  s.story.bestDeaths[stageId] = Math.min(s.story.bestDeaths[stageId] ?? Infinity, deaths);
  s.daily.progress.historia = (s.daily.progress.historia ?? 0) + 1;
  s.daily.progress.vitoria = (s.daily.progress.vitoria ?? 0) + 1;

  const reward = passReward(now, sc, pc, teamIds);
  if (firstClear) addBonus(reward, stage.primeiraVez);
  const { stars, chapterCompleted, chapterPerfect } = updateStarsAndChapter(s, stageId, reward, sc);

  const r = grant(s, reward, pc);
  return {
    state: r.state,
    reward,
    levelUps: r.levelUps,
    stars,
    firstClear,
    chapterCompleted,
    chapterPerfect,
  };
}

/** Registra o desafio da fase. Vitória vale a estrela do desafio (e talvez o bônus de 3★). */
export function completeChallenge(
  state: PlayerState,
  stageId: string,
  won: boolean,
  sc: StoryConfig,
  pc: ProgressionConfig,
): StageResult {
  const blocker = challengeBlocker(state, stageId, sc);
  if (blocker) throw new Error(blocker);
  const none = {
    state,
    reward: {},
    levelUps: [],
    stars: state.story.stars[stageId] ?? 0,
    firstClear: false,
    chapterCompleted: false,
    chapterPerfect: false,
  };
  if (!won) return none;
  const s = structuredClone(state);
  s.story.challenges.push(stageId);
  const reward: Grant = {};
  const { stars, chapterCompleted, chapterPerfect } = updateStarsAndChapter(s, stageId, reward, sc);
  const r = grant(s, reward, pc);
  return {
    state: r.state,
    reward,
    levelUps: r.levelUps,
    stars,
    firstClear: false,
    chapterCompleted,
    chapterPerfect,
  };
}

/** Motivo pelo qual a varredura não pode ser feita, ou null. */
export function sweepBlocker(
  state: PlayerState,
  stageId: string,
  times: number,
  now: Date,
  sc: StoryConfig,
): string | null {
  if (!Number.isInteger(times) || times < 1 || times > sc.varredura.maxPorVez) {
    return `Varra de 1 a ${sc.varredura.maxPorVez} vezes.`;
  }
  if (sc.varredura.exige3Estrelas && state.story.stars[stageId] !== 3) {
    return 'Varredura exige 3★ na fase.';
  }
  const blocker = stageBlocker(state, stageId, now, sc);
  if (blocker && !blocker.startsWith('Energia')) return blocker;
  if (currentStamina(state, now, sc) < sc.energia.custoFase * times) {
    return `Energia insuficiente (precisa de ${sc.energia.custoFase * times}).`;
  }
  return null;
}

/** Repete a fase sem lutar: mesma energia e mesmo XP/ryo por passagem (sem prêmio de primeira vez). */
export function sweepStage(
  state: PlayerState,
  stageId: string,
  times: number,
  now: Date,
  sc: StoryConfig,
  pc: ProgressionConfig,
  teamIds: string[] = [],
): { state: PlayerState; reward: Grant; levelUps: number[] } {
  const blocker = sweepBlocker(state, stageId, times, now, sc);
  if (blocker) throw new Error(blocker);
  const s = structuredClone(syncStamina(state, now, sc));
  s.stamina.value -= sc.energia.custoFase * times;
  s.daily.progress.historia = (s.daily.progress.historia ?? 0) + times;
  const one = passReward(now, sc, pc, teamIds);
  const reward: Grant = {
    xp: (one.xp ?? 0) * times,
    ryo: (one.ryo ?? 0) * times,
    teamXp: { ids: teamIds, amount: (one.xp ?? 0) * times },
  };
  const r = grant(s, reward, pc);
  return { state: r.state, reward, levelUps: r.levelUps };
}
