import type { NinjaTemplate } from '../core/types';
import raw from './ninjas.json';
import { validateRoster } from './roster';

/**
 * Elenco do jogo, carregado de `ninjas.json`. Para editar os ninjas, mexa só
 * no JSON (veja docs/elenco.md). Um arquivo inválido impede o jogo de abrir e
 * a mensagem diz exatamente o que corrigir.
 */
const report = validateRoster(raw);
if (report.errors.length > 0) {
  throw new Error(`ninjas.json inválido:\n- ${report.errors.join('\n- ')}`);
}
for (const w of report.warnings) console.warn(`[ninjas.json] ${w}`);

export const ROSTER: NinjaTemplate[] = report.ninjas;

export const NINJAS: Record<string, NinjaTemplate> = Object.fromEntries(
  ROSTER.map((n) => [n.id, n]),
);
