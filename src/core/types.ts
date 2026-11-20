import type { Element } from './elements';

export type TeamId = 'A' | 'B';

/**
 * Estados que abrem perseguição (combo). Um golpe aplica o estado no alvo e
 * um aliado cuja perseguição reage a esse estado pode atacar em seguida.
 */
export type ChaseState = 'derrubado' | 'no_ar' | 'repelido';

/**
 * Posição no grid 3×3. `col` 0 é a linha de frente e 2 é a retaguarda;
 * `row` vai de 0 (cima) a 2 (baixo).
 */
export interface Position {
  row: number;
  col: number;
}

/**
 * Quem um golpe atinge:
 * - single: um inimigo da coluna mais à frente (preferindo a mesma linha do atacante)
 * - row: todos os inimigos na linha do alvo principal
 * - column: todos os inimigos da coluna mais à frente
 * - back: um inimigo da coluna mais ao fundo (assassino)
 * - all: todos os inimigos
 */
export type TargetPattern = 'single' | 'row' | 'column' | 'back' | 'all';

export interface Skill {
  id: string;
  name: string;
  /** Multiplicador sobre o ataque do usuário. */
  power: number;
  pattern: TargetPattern;
  /** Estado de perseguição aplicado em cada alvo atingido. */
  applies?: ChaseState;
  /** Atordoa os alvos: eles perdem a próxima ação. */
  stuns?: boolean;
}

export interface SpecialSkill extends Skill {
  /** Custo em chakra do time. */
  chakraCost: number;
}

export interface ChaseSkill {
  id: string;
  name: string;
  power: number;
  /** Estado no alvo que dispara esta perseguição. */
  trigger: ChaseState;
  /** Novo estado aplicado, permitindo continuar o combo. */
  applies?: ChaseState;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Definição estática de um ninja (dados do jogo). */
export interface NinjaTemplate {
  id: string;
  name: string;
  element: Element;
  stats: Stats;
  basic: Skill;
  special: SpecialSkill;
  chase?: ChaseSkill;
}

/** Um ninja escalado em uma formação. */
export interface FormationSlot {
  ninja: NinjaTemplate;
  position: Position;
}

/** Estado de um ninja durante a batalha. */
export interface Unit {
  /** Identificador único na batalha, ex. "A:kaen". */
  uid: string;
  team: TeamId;
  template: NinjaTemplate;
  position: Position;
  hp: number;
  maxHp: number;
  stunned: boolean;
  chaseState?: ChaseState;
  chaseUsedThisRound: boolean;
}

export type Action = { type: 'basic' } | { type: 'special' };

export type BattleOutcome = TeamId | 'draw';

export type BattleEvent =
  | { type: 'round_start'; round: number; chakra: Record<TeamId, number> }
  | { type: 'turn_start'; actor: string }
  | { type: 'skip'; actor: string; reason: 'stunned' }
  | {
      type: 'skill';
      actor: string;
      skillId: string;
      kind: 'basic' | 'special' | 'chase';
      targets: string[];
    }
  | { type: 'chakra'; team: TeamId; amount: number; total: number }
  | {
      type: 'damage';
      source: string;
      target: string;
      amount: number;
      hpAfter: number;
      elementMultiplier: number;
    }
  | { type: 'status'; target: string; status: ChaseState | 'atordoado' }
  | { type: 'combo'; actor: string; target: string; count: number }
  | { type: 'death'; unit: string }
  | { type: 'battle_end'; outcome: BattleOutcome };
