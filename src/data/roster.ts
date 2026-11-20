import { ELEMENTS } from '../core/elements';
import type { ChaseState, NinjaTemplate, TargetPattern } from '../core/types';

/**
 * Validação do arquivo de elenco (src/data/ninjas.json).
 *
 * Erros impedem o jogo de abrir e fazem os testes falharem, com mensagens que
 * apontam o ninja e o campo. Avisos não bloqueiam, mas indicam algo estranho,
 * como uma perseguição que nenhum golpe do elenco consegue disparar.
 */

const PATTERNS: TargetPattern[] = ['single', 'row', 'column', 'back', 'all'];
const STATES: ChaseState[] = ['derrubado', 'no_ar', 'repelido'];
const RARITIES = ['raro', 'epico', 'lendario'];
export const MAX_CHAKRA_COST = 100;

const NINJA_KEYS = [
  'id',
  'name',
  'element',
  'rarity',
  'stats',
  'basic',
  'special',
  'chase',
  'observacao',
  'visual',
];
const STAT_KEYS = ['hp', 'atk', 'def', 'spd'];
const SKILL_KEYS = ['id', 'name', 'power', 'pattern', 'applies', 'stuns'];
const SPECIAL_KEYS = [...SKILL_KEYS, 'chakraCost'];
const CHASE_KEYS = ['id', 'name', 'power', 'trigger', 'applies'];
const VISUAL_KEYS = ['cor', 'modelo', 'retrato', 'animacoes'];

export interface RosterReport {
  ninjas: NinjaTemplate[];
  errors: string[];
  warnings: string[];
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateRoster(raw: unknown): RosterReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const list = isObj(raw) ? raw.ninjas : undefined;
  if (!Array.isArray(list) || list.length === 0) {
    return {
      ninjas: [],
      errors: ['O arquivo precisa de uma lista "ninjas" com pelo menos 1 ninja.'],
      warnings,
    };
  }

  const ninjaIds = new Set<string>();
  const skillIds = new Set<string>();

  list.forEach((n, i) => {
    const where = isObj(n) && isText(n.id) ? `Ninja "${n.id}"` : `Ninja nº ${i + 1}`;
    const err = (msg: string) => errors.push(`${where}: ${msg}`);
    if (!isObj(n)) return err('precisa ser um objeto { ... }.');

    unknownKeys(n, NINJA_KEYS, '', err);

    if (!isText(n.id) || !/^[a-z0-9-]+$/.test(n.id)) {
      err('"id" deve usar só letras minúsculas sem acento, números e hífen (ex. "boitata").');
    } else if (ninjaIds.has(n.id)) {
      err('"id" repetido; cada ninja precisa de um id único.');
    } else {
      ninjaIds.add(n.id);
    }
    if (!isText(n.name)) err('"name" é obrigatório.');
    if (!ELEMENTS.includes(n.element as never)) {
      err(`"element" deve ser um de: ${ELEMENTS.join(', ')}.`);
    }
    if (n.rarity !== undefined && !RARITIES.includes(n.rarity as string)) {
      err(`"rarity" deve ser um de: ${RARITIES.join(', ')}.`);
    }
    if (n.observacao !== undefined && typeof n.observacao !== 'string') {
      err('"observacao" deve ser um texto.');
    }

    if (!isObj(n.stats)) {
      err('"stats" é obrigatório: { "hp", "atk", "def", "spd" }.');
    } else {
      unknownKeys(n.stats, STAT_KEYS, 'stats.', err);
      if (!isNum(n.stats.hp) || !Number.isInteger(n.stats.hp) || n.stats.hp <= 0) {
        err('"stats.hp" deve ser um número inteiro maior que 0.');
      }
      for (const k of ['atk', 'def', 'spd']) {
        const v = n.stats[k];
        if (!isNum(v) || v < 0) err(`"stats.${k}" deve ser um número maior ou igual a 0.`);
      }
    }

    checkSkill(n.basic, 'basic', SKILL_KEYS, err, skillIds);
    if (checkSkill(n.special, 'special', SPECIAL_KEYS, err, skillIds)) {
      const cost = (n.special as Obj).chakraCost;
      if (!isNum(cost) || cost <= 0 || cost > MAX_CHAKRA_COST) {
        err(`"special.chakraCost" deve ser um número entre 1 e ${MAX_CHAKRA_COST}.`);
      }
    }

    if (n.chase !== undefined) {
      if (!isObj(n.chase)) {
        err('"chase" deve ser um objeto ou ser removido.');
      } else {
        const c = n.chase;
        unknownKeys(c, CHASE_KEYS, 'chase.', err);
        checkId(c.id, 'chase', err, skillIds);
        if (!isText(c.name)) err('"chase.name" é obrigatório.');
        if (!isNum(c.power) || c.power <= 0) err('"chase.power" deve ser maior que 0.');
        if (!STATES.includes(c.trigger as ChaseState)) {
          err(`"chase.trigger" deve ser um de: ${STATES.join(', ')}.`);
        }
        if (c.applies !== undefined && !STATES.includes(c.applies as ChaseState)) {
          err(`"chase.applies" deve ser um de: ${STATES.join(', ')}, ou ser removido.`);
        }
      }
    }

    if (n.visual !== undefined) {
      if (!isObj(n.visual)) {
        err('"visual" deve ser um objeto.');
      } else {
        unknownKeys(n.visual, VISUAL_KEYS, 'visual.', err);
        const { cor, modelo, retrato, animacoes } = n.visual;
        if (cor !== undefined && !(typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor))) {
          err('"visual.cor" deve estar no formato "#RRGGBB".');
        }
        for (const [k, v] of [
          ['modelo', modelo],
          ['retrato', retrato],
        ] as const) {
          if (v !== undefined && typeof v !== 'string') err(`"visual.${k}" deve ser um texto.`);
        }
        if (
          animacoes !== undefined &&
          !(isObj(animacoes) && Object.values(animacoes).every((v) => typeof v === 'string'))
        ) {
          err('"visual.animacoes" deve ser um objeto { "clipe": "arquivo" }.');
        }
      }
    }
  });

  if (errors.length > 0) return { ninjas: [], errors, warnings };

  const ninjas = list as NinjaTemplate[];
  const applied = new Set<ChaseState>();
  for (const n of ninjas) {
    for (const s of [n.basic.applies, n.special.applies, n.chase?.applies]) if (s) applied.add(s);
  }
  for (const n of ninjas) {
    if (n.chase && !applied.has(n.chase.trigger)) {
      warnings.push(
        `Ninja "${n.id}": a perseguição "${n.chase.name}" reage a "${n.chase.trigger}", ` +
          'mas nenhum golpe do elenco aplica esse estado. Ela nunca vai disparar.',
      );
    }
  }
  return { ninjas, errors, warnings };
}

function unknownKeys(o: Obj, allowed: string[], prefix: string, err: (m: string) => void): void {
  for (const k of Object.keys(o)) {
    if (k === '$schema') continue;
    if (!allowed.includes(k)) {
      err(`campo desconhecido "${prefix}${k}" (permitidos: ${allowed.join(', ')}).`);
    }
  }
}

function checkId(id: unknown, field: string, err: (m: string) => void, seen: Set<string>): void {
  if (!isText(id)) return err(`"${field}.id" é obrigatório.`);
  if (seen.has(id)) return err(`"${field}.id" = "${id}" já é usado por outro golpe.`);
  seen.add(id);
}

/** Valida um golpe básico ou especial. Devolve true se é um objeto (para checagens extras). */
function checkSkill(
  s: unknown,
  field: string,
  allowed: string[],
  err: (m: string) => void,
  skillIds: Set<string>,
): s is Obj {
  if (!isObj(s)) {
    err(`"${field}" é obrigatório.`);
    return false;
  }
  unknownKeys(s, allowed, `${field}.`, err);
  checkId(s.id, field, err, skillIds);
  if (!isText(s.name)) err(`"${field}.name" é obrigatório.`);
  if (!isNum(s.power) || s.power <= 0) err(`"${field}.power" deve ser maior que 0.`);
  if (!PATTERNS.includes(s.pattern as TargetPattern)) {
    err(`"${field}.pattern" deve ser um de: ${PATTERNS.join(', ')}.`);
  }
  if (s.applies !== undefined && !STATES.includes(s.applies as ChaseState)) {
    err(`"${field}.applies" deve ser um de: ${STATES.join(', ')}, ou ser removido.`);
  }
  if (s.stuns !== undefined && typeof s.stuns !== 'boolean') {
    err(`"${field}.stuns" deve ser true ou false.`);
  }
  return true;
}
