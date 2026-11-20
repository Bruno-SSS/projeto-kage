import { createGacha } from '../core/gacha';
import { ROSTER } from './ninjas';

/**
 * Configuração do recrutamento, derivada do elenco: cada ninja entra no pool
 * pela `rarity` em ninjas.json, e cada lendário ganha um banner em destaque.
 */
export const GACHA = createGacha(ROSTER);
