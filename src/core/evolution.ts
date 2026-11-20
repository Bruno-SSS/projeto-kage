import {
  addNinjaXpInPlace,
  newNinjaProgress,
  ninjaLevelCap,
  xpToNext,
  type NinjaProgress,
  type PlayerState,
  type ProgressionConfig,
} from './progression';
import type { NinjaTemplate } from './types';

/**
 * Evolução dos ninjas: nível (XP de luta e comida), estrelas (fragmentos) e o
 * efeito disso nos atributos usados na batalha. Puro, como progression.ts.
 */

export function ninjaProgress(
  state: PlayerState,
  id: string,
  cfg: ProgressionConfig,
): NinjaProgress {
  return state.ninjas[id] ?? newNinjaProgress(cfg);
}

/** Multiplicador de vida, ataque e defesa pelo nível e pelas estrelas. */
export function statMultiplier(p: NinjaProgress, cfg: ProgressionConfig): number {
  const { crescimentoPorNivel, multiplicadorEstrela } = cfg.ninjas;
  return (1 + crescimentoPorNivel * (p.level - 1)) * (multiplicadorEstrela[String(p.stars)] ?? 1);
}

/** O ninja com os atributos do nível e das estrelas. Velocidade não muda. */
export function effectiveTemplate(
  base: NinjaTemplate,
  p: NinjaProgress,
  cfg: ProgressionConfig,
): NinjaTemplate {
  const m = statMultiplier(p, cfg);
  return {
    ...base,
    stats: {
      ...base.stats,
      hp: Math.max(1, Math.round(base.stats.hp * m)),
      atk: Math.round(base.stats.atk * m),
      def: Math.round(base.stats.def * m),
    },
  };
}

/** Motivo pelo qual o ninja não pode comer agora, ou `null`. */
export function feedBlocker(
  state: PlayerState,
  id: string,
  food: string,
  cfg: ProgressionConfig,
): string | null {
  if (!state.owned[id]) return 'Você não tem esse ninja.';
  if (!cfg.ninjas.comida[food]) return `Comida desconhecida: ${food}.`;
  if ((state.food[food] ?? 0) <= 0) return `Sem ${cfg.ninjas.comida[food].nome}.`;
  const p = ninjaProgress(state, id, cfg);
  if (p.level >= ninjaLevelCap(state, cfg) && p.xp >= xpToNext(p.level, cfg) - 1) {
    return 'Ninja no limite de nível. Suba o nível da conta.';
  }
  return null;
}

/** Usa uma comida no ninja. Devolve o estado novo e quantos níveis ele subiu. */
export function feed(
  state: PlayerState,
  id: string,
  food: string,
  cfg: ProgressionConfig,
): { state: PlayerState; levels: number } {
  const blocker = feedBlocker(state, id, food, cfg);
  if (blocker) throw new Error(blocker);
  const s = structuredClone(state);
  s.food[food] -= 1;
  const levels = addNinjaXpInPlace(s, id, cfg.ninjas.comida[food].xp, cfg);
  return { state: s, levels };
}

/** Fragmentos para a próxima estrela, ou `null` se já está no máximo. */
export function starUpCost(p: NinjaProgress, cfg: ProgressionConfig): number | null {
  if (p.stars >= cfg.ninjas.estrelaMaxima) return null;
  return cfg.ninjas.custoEstrela[String(p.stars + 1)] ?? null;
}

export function starUp(state: PlayerState, id: string, cfg: ProgressionConfig): PlayerState {
  if (!state.owned[id]) throw new Error('Você não tem esse ninja.');
  const p = ninjaProgress(state, id, cfg);
  const cost = starUpCost(p, cfg);
  if (cost === null) throw new Error('Estrela máxima.');
  const have = state.fragments[id] ?? 0;
  if (have < cost) throw new Error(`Fragmentos insuficientes: ${have}/${cost}.`);
  const s = structuredClone(state);
  s.fragments[id] = have - cost;
  s.ninjas[id] = { ...p, stars: p.stars + 1 };
  return s;
}
