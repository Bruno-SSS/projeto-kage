import { describe, expect, it } from 'vitest';
import { runAutoBattle } from '../src/core/ai';
import { Battle } from '../src/core/battle';
import { DEFAULT_FORMATION, ENEMY_FORMATION } from '../src/data/formations';
import raw from '../src/data/ninjas.json';
import { validateRoster } from '../src/data/roster';
import { toSlots } from '../src/ui/formationState';
import { NINJAS } from '../src/data/ninjas';

/** Cópia profunda do elenco real, para estragar de propósito nos testes. */
const clone = () => JSON.parse(JSON.stringify(raw)) as { ninjas: Record<string, unknown>[] };

describe('ninjas.json', () => {
  it('o elenco do jogo é válido e sem avisos', () => {
    const report = validateRoster(raw);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.ninjas.length).toBeGreaterThan(0);
  });

  it('todo ninja tem o campo de observação para anotações', () => {
    for (const n of raw.ninjas) expect(typeof n.observacao).toBe('string');
  });

  it('a formação padrão vence o primeiro desafio com a IA', () => {
    const battle = new Battle(toSlots(DEFAULT_FORMATION, NINJAS), toSlots(ENEMY_FORMATION, NINJAS));
    runAutoBattle(battle);
    expect(battle.outcome).toBe('A');
    expect(battle.round).toBeLessThanOrEqual(12);
  });
});

describe('validateRoster aponta erros de edição', () => {
  it('lista vazia ou ausente', () => {
    expect(validateRoster({}).errors[0]).toMatch(/lista "ninjas"/);
    expect(validateRoster({ ninjas: [] }).errors[0]).toMatch(/lista "ninjas"/);
  });

  it('campo com nome errado (erro de digitação)', () => {
    const data = clone();
    (data.ninjas[0].stats as Record<string, unknown>).atack = 10;
    expect(validateRoster(data).errors.join()).toMatch(/campo desconhecido "stats.atack"/);
  });

  it('id inválido ou repetido', () => {
    const data = clone();
    data.ninjas[0].id = 'Boitatá';
    data.ninjas[2].id = data.ninjas[1].id;
    const errors = validateRoster(data).errors.join('\n');
    expect(errors).toMatch(/letras minúsculas/);
    expect(errors).toMatch(/"id" repetido/);
  });

  it('elemento, padrão de alvo e estado inexistentes', () => {
    const data = clone();
    data.ninjas[0].element = 'gelo';
    (data.ninjas[0].basic as Record<string, unknown>).pattern = 'cone';
    (data.ninjas[0].chase as Record<string, unknown>).trigger = 'voando';
    const errors = validateRoster(data).errors.join('\n');
    expect(errors).toMatch(/"element" deve ser um de/);
    expect(errors).toMatch(/"basic.pattern" deve ser um de/);
    expect(errors).toMatch(/"chase.trigger" deve ser um de/);
  });

  it('números fora do lugar', () => {
    const data = clone();
    (data.ninjas[0].stats as Record<string, unknown>).hp = 0;
    (data.ninjas[0].special as Record<string, unknown>).chakraCost = 150;
    (data.ninjas[0].basic as Record<string, unknown>).power = '1';
    const errors = validateRoster(data).errors.join('\n');
    expect(errors).toMatch(/"stats.hp"/);
    expect(errors).toMatch(/"special.chakraCost"/);
    expect(errors).toMatch(/"basic.power"/);
  });

  it('id de golpe repetido entre ninjas', () => {
    const data = clone();
    (data.ninjas[1].basic as Record<string, unknown>).id = (
      data.ninjas[0].basic as Record<string, unknown>
    ).id;
    expect(validateRoster(data).errors.join()).toMatch(/já é usado por outro golpe/);
  });

  it('cor e animações do visual', () => {
    const data = clone();
    data.ninjas[0].visual = { cor: 'vermelho', animacoes: { idle: 3 } };
    const errors = validateRoster(data).errors.join('\n');
    expect(errors).toMatch(/#RRGGBB/);
    expect(errors).toMatch(/visual.animacoes/);
  });

  it('avisa quando uma perseguição nunca pode disparar', () => {
    const data = clone();
    // Só um ninja: ele reage a "no_ar", mas o próprio golpe aplica "derrubado"
    data.ninjas = [data.ninjas[0]];
    const report = validateRoster(data);
    expect(report.errors).toEqual([]);
    expect(report.warnings.join()).toMatch(/nunca vai disparar/);
  });

  it('a mensagem identifica o ninja pelo id', () => {
    const data = clone();
    data.ninjas[3].name = '';
    expect(validateRoster(data).errors).toEqual([
      `Ninja "${data.ninjas[3].id}": "name" é obrigatório.`,
    ]);
  });
});
