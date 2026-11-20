import type { NinjaTemplate } from '../core/types';

/**
 * Elenco inicial, provisório, para testar o motor. Personagens originais.
 *
 * Combo pensado: Kaen derruba → Hayate persegue e lança ao ar → Kaen persegue
 * e derruba → Iwao persegue no chão.
 */
export const NINJAS = {
  kaen: {
    id: 'kaen',
    name: 'Kaen',
    element: 'fogo',
    stats: { hp: 300, atk: 60, def: 30, spd: 90 },
    basic: {
      id: 'kaen-golpe',
      name: 'Golpe Flamejante',
      power: 1.0,
      pattern: 'single',
      applies: 'derrubado',
    },
    special: {
      id: 'kaen-lotus',
      name: 'Lótus Carmesim',
      power: 1.6,
      pattern: 'row',
      chakraCost: 50,
    },
    chase: {
      id: 'kaen-queda',
      name: 'Queda em Brasa',
      power: 0.8,
      trigger: 'no_ar',
      applies: 'derrubado',
    },
  },
  hayate: {
    id: 'hayate',
    name: 'Hayate',
    element: 'vento',
    stats: { hp: 270, atk: 55, def: 25, spd: 110 },
    basic: { id: 'hayate-golpe', name: 'Lâmina Leve', power: 1.0, pattern: 'single' },
    special: {
      id: 'hayate-vendaval',
      name: 'Corte do Vendaval',
      power: 1.4,
      pattern: 'column',
      applies: 'no_ar',
      chakraCost: 50,
    },
    chase: {
      id: 'hayate-ascensao',
      name: 'Ascensão do Vento',
      power: 0.7,
      trigger: 'derrubado',
      applies: 'no_ar',
    },
  },
  raiga: {
    id: 'raiga',
    name: 'Raiga',
    element: 'raio',
    stats: { hp: 250, atk: 65, def: 20, spd: 95 },
    basic: { id: 'raiga-golpe', name: 'Agulha Elétrica', power: 0.9, pattern: 'back' },
    special: {
      id: 'raiga-lanca',
      name: 'Lança Trovão',
      power: 2.2,
      pattern: 'single',
      stuns: true,
      chakraCost: 75,
    },
    chase: {
      id: 'raiga-faisca',
      name: 'Faísca Perseguidora',
      power: 0.9,
      trigger: 'repelido',
      applies: 'derrubado',
    },
  },
  iwao: {
    id: 'iwao',
    name: 'Iwao',
    element: 'terra',
    stats: { hp: 430, atk: 45, def: 60, spd: 60 },
    basic: {
      id: 'iwao-golpe',
      name: 'Punho de Pedra',
      power: 0.9,
      pattern: 'single',
      applies: 'repelido',
    },
    special: {
      id: 'iwao-tremor',
      name: 'Grande Tremor',
      power: 0.8,
      pattern: 'all',
      applies: 'repelido',
      chakraCost: 75,
    },
    chase: { id: 'iwao-esmagar', name: 'Esmagar', power: 0.6, trigger: 'derrubado' },
  },
  minase: {
    id: 'minase',
    name: 'Minase',
    element: 'agua',
    stats: { hp: 330, atk: 50, def: 35, spd: 80 },
    basic: { id: 'minase-golpe', name: 'Onda Cortante', power: 0.7, pattern: 'row' },
    special: {
      id: 'minase-mare',
      name: 'Maré Alta',
      power: 1.0,
      pattern: 'all',
      stuns: true,
      chakraCost: 100,
    },
    chase: {
      id: 'minase-corrente',
      name: 'Corrente Ascendente',
      power: 0.7,
      trigger: 'repelido',
      applies: 'no_ar',
    },
  },
} satisfies Record<string, NinjaTemplate>;
