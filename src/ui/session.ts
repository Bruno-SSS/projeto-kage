import { effectiveTemplate, ninjaProgress } from '../core/evolution';
import { newPityState, type PityState } from '../core/gacha';
import { GRID_SIZE } from '../core/formation';
import {
  newNinjaProgress,
  newPlayer,
  refreshBoard,
  startDay,
  type PlayerState,
  type ProgressionConfig,
} from '../core/progression';
import type { NinjaTemplate } from '../core/types';
import { DEFAULT_FORMATION } from '../data/formations';
import { NINJAS, ROSTER } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { placeNinja, toSlots, type Placement } from './formationState';
import { loadJSON, saveJSON } from './storage';

/**
 * Estado salvo do jogador (no navegador). Tudo que muda o progresso passa por
 * `updateSave`, que já grava.
 */

const SAVE_KEY = 'kage.save';
const FORMATION_KEY = 'kage.formation';
export const SAVE_VERSION = 1;
export const STARTING_SCROLLS = 10;

export interface SaveData {
  version: number;
  createdAt: number;
  player: PlayerState;
  pity: PityState;
}

/** Ninjas iniciais: todos os épicos (ou sem raridade). Os lendários vêm do recrutamento. */
export function starterIds(roster: NinjaTemplate[]): string[] {
  return roster.filter((n) => n.rarity !== 'lendario' && n.rarity !== 'raro').map((n) => n.id);
}

export function freshSave(now: Date, roster: NinjaTemplate[], cfg: ProgressionConfig): SaveData {
  const player = newPlayer(starterIds(roster), now, cfg);
  player.wallet.pergaminho = STARTING_SCROLLS;
  return { version: SAVE_VERSION, createdAt: now.getTime(), player, pity: newPityState() };
}

/**
 * Aceita o que veio do armazenamento ou recomeça do zero se estiver ausente
 * ou num formato antigo. Remove ninjas que não existem mais no elenco.
 */
export function parseSave(
  raw: unknown,
  now: Date,
  roster: NinjaTemplate[],
  cfg: ProgressionConfig,
): SaveData {
  const r = raw as Partial<SaveData> | null;
  if (
    !r ||
    r.version !== SAVE_VERSION ||
    typeof r.createdAt !== 'number' ||
    typeof r.player?.level !== 'number' ||
    typeof r.player?.wallet !== 'object' ||
    typeof r.pity?.sinceLegendary !== 'number'
  ) {
    return freshSave(now, roster, cfg);
  }
  const ids = new Set(roster.map((n) => n.id));
  const owned = Object.fromEntries(
    Object.keys(r.player.owned ?? {})
      .filter((id) => ids.has(id))
      .map((id) => [id, true]),
  );
  // Campos que surgiram depois (evolução dos ninjas): completa saves antigos.
  const ninjas = Object.fromEntries(
    Object.keys(owned).map((id) => [id, r.player!.ninjas?.[id] ?? newNinjaProgress()]),
  );
  return {
    ...(r as SaveData),
    player: { ...r.player, owned, ninjas, food: r.player.food ?? {} },
  };
}

let current: SaveData | undefined;

export function getSave(): SaveData {
  current ??= parseSave(loadJSON<unknown>(SAVE_KEY, null), new Date(), ROSTER, PROGRESSAO);
  return current;
}

export function updateSave(change: (s: SaveData) => SaveData): SaveData {
  current = change(getSave());
  saveJSON(SAVE_KEY, current);
  return current;
}

/** Vira o dia (login e diárias) e renova o quadro de missões se for a hora. */
export function tick(now = new Date()): { loginGranted: boolean } {
  let loginGranted = false;
  updateSave((s) => {
    const day = startDay(s.player, now, PROGRESSAO);
    loginGranted = day.loginGranted;
    return { ...s, player: refreshBoard(day.state, now, PROGRESSAO, Math.random) };
  });
  return { loginGranted };
}

export function ownedRoster(): NinjaTemplate[] {
  const { owned } = getSave().player;
  return ROSTER.filter((n) => owned[n.id]).map((n) => evolved(n.id));
}

/** Mantém só ninjas que o jogador tem, em casas válidas, até o limite do time. */
export function sanitizePlacements(saved: unknown, isOwned: (id: string) => boolean): Placement[] {
  if (!Array.isArray(saved)) return [];
  let result: Placement[] = [];
  for (const p of saved as Placement[]) {
    if (typeof p?.id !== 'string' || !isOwned(p.id)) continue;
    if (![p.row, p.col].every((v) => Number.isInteger(v) && v >= 0 && v < GRID_SIZE)) continue;
    const next = placeNinja(result, p.id, p.row, p.col);
    if (next) result = next;
  }
  return result;
}

export function loadFormation(): Placement[] {
  const { owned } = getSave().player;
  return sanitizePlacements(
    loadJSON<unknown>(FORMATION_KEY, DEFAULT_FORMATION),
    (id) => !!owned[id],
  );
}

export function saveFormation(placements: Placement[]): void {
  saveJSON(FORMATION_KEY, placements);
}

/** O ninja com nível e estrelas do jogador aplicados. */
export function evolved(id: string): NinjaTemplate {
  return effectiveTemplate(NINJAS[id], ninjaProgress(getSave().player, id), PROGRESSAO);
}

/** Time do jogador pronto para a batalha, com a evolução de cada ninja. */
export function playerTeam() {
  const evolvedRoster = Object.fromEntries(loadFormation().map((p) => [p.id, evolved(p.id)]));
  return toSlots(loadFormation(), evolvedRoster);
}
