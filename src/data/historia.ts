import type { StoryConfig } from '../core/story';
import raw from './historia.json';

/** Capítulos, energia e prêmios do modo história. Edite historia.json (docs/historia.md). */
export const HISTORIA = raw as unknown as StoryConfig;
