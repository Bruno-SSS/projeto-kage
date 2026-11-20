import type { ProgressionConfig } from '../core/progression';
import raw from './progressao.json';

/** Números da progressão (nível, quadro D–S, diárias, bônus). Edite progressao.json. */
export const PROGRESSAO = raw as unknown as ProgressionConfig;
