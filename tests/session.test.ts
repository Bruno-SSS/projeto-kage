import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMATION } from '../src/data/formations';
import { ROSTER } from '../src/data/ninjas';
import { PROGRESSAO } from '../src/data/progressao';
import {
  freshSave,
  parseSave,
  sanitizePlacements,
  SAVE_VERSION,
  STARTING_SCROLLS,
  starterIds,
} from '../src/ui/session';

const NOW = new Date('2026-11-20T15:00:00Z');

describe('save do jogador', () => {
  it('começa com os épicos, 10 pergaminhos e sem lendários', () => {
    const s = freshSave(NOW, ROSTER, PROGRESSAO);
    expect(Object.keys(s.player.owned).sort()).toEqual(
      ['boitata', 'curupira', 'mapinguari', 'saci'].sort(),
    );
    expect(starterIds(ROSTER)).not.toContain('iara');
    expect(s.player.wallet.pergaminho).toBe(STARTING_SCROLLS);
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('a formação inicial usa só ninjas iniciais', () => {
    const owned = new Set(starterIds(ROSTER));
    for (const p of DEFAULT_FORMATION) expect(owned.has(p.id)).toBe(true);
  });

  it('recomeça do zero com save ausente, corrompido ou de versão antiga', () => {
    for (const raw of [null, 'lixo', { version: 0 }, { version: SAVE_VERSION, player: {} }]) {
      expect(parseSave(raw, NOW, ROSTER, PROGRESSAO).player.level).toBe(1);
    }
  });

  it('mantém um save válido e descarta ninjas que saíram do elenco', () => {
    const s = freshSave(NOW, ROSTER, PROGRESSAO);
    s.player.level = 12;
    s.player.owned.ninja_removido = true;
    const parsed = parseSave(JSON.parse(JSON.stringify(s)), NOW, ROSTER, PROGRESSAO);
    expect(parsed.player.level).toBe(12);
    expect(parsed.player.owned.ninja_removido).toBeUndefined();
    expect(parsed.player.owned.saci).toBe(true);
  });
});

describe('sanitizePlacements', () => {
  const owns = (id: string) => ['a', 'b', 'c', 'd', 'e'].includes(id);

  it('remove quem o jogador não tem e posições inválidas', () => {
    const result = sanitizePlacements(
      [
        { id: 'a', row: 0, col: 0 },
        { id: 'x', row: 1, col: 0 },
        { id: 'b', row: 5, col: 0 },
        { id: 'c', row: 1.5, col: 0 },
        { id: 'd', row: 2, col: 2 },
      ],
      owns,
    );
    expect(result.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('respeita o limite de 4 e aceita lixo', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
      id,
      row: i % 3,
      col: Math.floor(i / 3),
    }));
    expect(sanitizePlacements(five, owns)).toHaveLength(4);
    expect(sanitizePlacements('lixo', owns)).toEqual([]);
  });
});
