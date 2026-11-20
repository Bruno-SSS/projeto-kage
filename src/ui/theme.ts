import type Phaser from 'phaser';
import type { Element } from '../core/elements';
import type { ChaseState, TargetPattern } from '../core/types';

export const WIDTH = 960;
export const HEIGHT = 540;

export const COLORS = {
  bg: 0x0f1420,
  panel: 0x1a2233,
  panelLight: 0x26324a,
  border: 0x3a4a6b,
  accent: 0xf2a541,
  teamA: 0x4ea8de,
  teamB: 0xe05263,
  hp: 0x5cc977,
  hpLow: 0xe05263,
  chakra: 0x7b8cff,
};

export const TEXT = {
  main: '#f5f5f5',
  muted: '#9aa4b2',
  accent: '#f2a541',
  good: '#ffd166',
  bad: '#8a93a3',
  teamA: '#4ea8de',
  teamB: '#e05263',
};

export const ELEMENT_COLORS: Record<Element, number> = {
  fogo: 0xe4572e,
  vento: 0x76b041,
  raio: 0xe8b80c,
  terra: 0xa0522d,
  agua: 0x17a3bb,
};

export const ELEMENT_LABELS: Record<Element, string> = {
  fogo: 'Fogo',
  vento: 'Vento',
  raio: 'Raio',
  terra: 'Terra',
  agua: 'Água',
};

export const STATUS_LABELS: Record<ChaseState | 'atordoado', string> = {
  derrubado: 'Derrubado!',
  no_ar: 'No ar!',
  repelido: 'Repelido!',
  atordoado: 'Atordoado!',
};

/** Estado em minúsculas, para descrições ("derruba", "lança ao ar"...). */
export const STATUS_VERBS: Record<ChaseState, string> = {
  derrubado: 'derruba',
  no_ar: 'lança ao ar',
  repelido: 'repele',
};

export const STATUS_NOUNS: Record<ChaseState, string> = {
  derrubado: 'derrubado',
  no_ar: 'no ar',
  repelido: 'repelido',
};

export const PATTERN_LABELS: Record<TargetPattern, string> = {
  single: 'um alvo',
  row: 'linha',
  column: 'coluna',
  back: 'retaguarda',
  all: 'todos',
};

export function textStyle(
  size: number,
  color: string = TEXT.main,
  bold = false,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
  };
}
