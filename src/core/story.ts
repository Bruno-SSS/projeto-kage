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
 * Modo história: capítulos com fases em sequência, energia, estrelas por fase
 * e prêmios de primeira vitória, de capítulo concluído e de capítulo com 3★.
 * Puro, como progression.ts.
 */

export interface StageBonus {
  comida?: FoodBag;
  pergaminho?: number;
  ryo?: number;
  cupom?: number;
  fragmentos?: Record<string, number>;
}

export interface StageDef {
  id: string;
  nome: string;
  nivelInimigo: number;
  /** Multiplicador extra de vida/ataque/defesa (chefes). */
  forca?: number;
  chefe?: boolean;
  inimigos: { id: string; row: number; col: number }[];
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
  estrelas: { maxMortesPara2: number };
  capitulos: ChapterDef[];
}

export interface StoryProgress {
  /** Melhor número de estrelas por fase (ausente = nunca vencida). */
  stars: Record<string, number>;
  /** Capítulos cujo prêmio de conclusão já foi pago. */
  rewarded: string[];
  /** Capítulos cujo bônus de 3★ já foi pago. */
  perfect: string[];
}

export function newStoryProgress(): StoryProgress {
  return { stars: {}, rewarded: [], perfect: [] };
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
  const { chapter, index } = findStage(sc, stageId);
  const closed = chapterBlocker(state, chapter.id, sc);
  if (closed) return closed;
  if (index > 0 && !(state.story.stars[chapter.fases[index - 1].id] > 0)) {
    return 'Vença a fase anterior primeiro.';
  }
  if (currentStamina(state, now, sc) < sc.energia.custoFase) {
    return `Energia insuficiente (precisa de ${sc.energia.custoFase}).`;
  }
  return null;
}

/** Time inimigo da fase, no nível da fase (e mais forte se for chefe). */
export function stageEnemies(
  stage: StageDef,
  ninjas: Record<string, NinjaTemplate>,
  pc: ProgressionConfig,
): FormationSlot[] {
  const f = (stage.forca ?? 1) * (1 + pc.ninjas.crescimentoPorNivel * (stage.nivelInimigo - 1));
  return stage.inimigos.map(({ id, row, col }) => {
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

export function starsFor(deaths: number, sc: StoryConfig): number {
  if (deaths === 0) return 3;
  return deaths <= sc.estrelas.maxMortesPara2 ? 2 : 1;
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

/**
 * Registra o resultado de uma fase. Derrota não gasta energia (ela "volta").
 * Vitória gasta a energia, paga XP e ryo proporcionais à energia (com o bônus
 * do dia), o prêmio de primeira vez e, se for o caso, os prêmios do capítulo.
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
  const none = {
    state,
    reward: {},
    levelUps: [],
    stars: 0,
    firstClear: false,
    chapterCompleted: false,
    chapterPerfect: false,
  };
  if (!won) return none;

  const { chapter } = findStage(sc, stageId);
  let s = syncStamina(state, now, sc);
  s = structuredClone(s);
  s.stamina.value -= sc.energia.custoFase;

  const stars = starsFor(deaths, sc);
  const firstClear = !(s.story.stars[stageId] > 0);
  s.story.stars[stageId] = Math.max(s.story.stars[stageId] ?? 0, stars);
  s.daily.progress.historia = (s.daily.progress.historia ?? 0) + 1;
  s.daily.progress.vitoria = (s.daily.progress.vitoria ?? 0) + 1;

  const energy = sc.energia.custoFase;
  const xp = energy * sc.premioPorEnergia.xp * bonusMultiplier(now, 'historia', 'xp', pc);
  const reward: Grant = {
    xp,
    ryo: energy * sc.premioPorEnergia.ryo * bonusMultiplier(now, 'historia', 'ryo', pc),
    teamXp: { ids: teamIds, amount: xp },
  };
  const stageDef = chapter.fases.find((f) => f.id === stageId)!;
  if (firstClear) addBonus(reward, stageDef.primeiraVez);

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
