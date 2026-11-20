import { describe, expect, it } from 'vitest';
import { runAutoBattle } from '../src/core/ai';
import { Battle } from '../src/core/battle';
import { effectiveTemplate } from '../src/core/evolution';
import { validateFormation } from '../src/core/formation';
import type { PlayerState } from '../src/core/progression';
import {
  addStamina,
  chapterBlocker,
  completeStage,
  currentStamina,
  minutesToNextStamina,
  stageBlocker,
  stageEnemies,
  starsFor,
  syncStamina,
} from '../src/core/story';
import { DEFAULT_FORMATION } from '../src/data/formations';
import { HISTORIA as sc } from '../src/data/historia';
import { NINJAS, ROSTER } from '../src/data/ninjas';
import { PROGRESSAO as pc } from '../src/data/progressao';
import { toSlots } from '../src/ui/formationState';
import { freshSave, parseSave } from '../src/ui/session';

const FRIDAY = new Date('2026-11-20T15:00:00Z');
const MONDAY = new Date('2026-11-23T15:00:00Z');
const MIN = 60_000;
const player = (now = FRIDAY): PlayerState => freshSave(now, ROSTER, pc, sc).player;
const allStages = sc.capitulos.flatMap((c) => c.fases);

/** Vence as fases dadas, com 0 mortes, sem se preocupar com energia. */
function clear(state: PlayerState, ids: string[], deaths = 0): PlayerState {
  let s = state;
  for (const id of ids) {
    s = { ...s, stamina: { value: sc.energia.maximo, at: FRIDAY.getTime() } };
    s = completeStage(s, id, true, deaths, FRIDAY, sc, pc).state;
  }
  return s;
}

describe('historia.json', () => {
  it('todas as fases têm formação inimiga válida', () => {
    for (const stage of allStages) {
      expect(validateFormation(stageEnemies(stage, NINJAS, pc)), stage.id).toEqual([]);
    }
  });

  it('ids de fase únicos e cada capítulo termina num chefe', () => {
    const ids = allStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of sc.capitulos) expect(c.fases.at(-1)?.chefe).toBe(true);
  });

  it('bônus de 3★ segue a regra da pesquisa: 20 + 10 × (capítulo − 1) cupons', () => {
    sc.capitulos.forEach((c, i) => expect(c.bonus3Estrelas.cupom).toBe(20 + 10 * i));
  });

  it('a formação inicial vence a primeira fase', () => {
    const battle = new Battle(
      toSlots(DEFAULT_FORMATION, NINJAS),
      stageEnemies(sc.capitulos[0].fases[0], NINJAS, pc),
    );
    runAutoBattle(battle);
    expect(battle.outcome).toBe('A');
  });
});

describe('dificuldade', () => {
  it('o time inicial com 3★, no nível de cada fase, vence todas as fases (com IA)', () => {
    for (const stage of allStages) {
      const team = DEFAULT_FORMATION.map((p) => ({
        ninja: effectiveTemplate(NINJAS[p.id], { level: stage.nivelInimigo, xp: 0, stars: 3 }, pc),
        position: { row: p.row, col: p.col },
      }));
      const battle = new Battle(team, stageEnemies(stage, NINJAS, pc));
      runAutoBattle(battle);
      expect(battle.outcome, stage.id).toBe('A');
    }
  });
});

describe('energia', () => {
  it('jogador novo começa com a energia inicial', () => {
    expect(currentStamina(player(), FRIDAY, sc)).toBe(sc.energia.inicial);
  });

  it('regenera 1 a cada N minutos até o teto, guardando a fração', () => {
    const s: PlayerState = { ...player(), stamina: { value: 100, at: FRIDAY.getTime() } };
    const later = new Date(FRIDAY.getTime() + 3.5 * sc.energia.regenMinutos * MIN);
    expect(currentStamina(s, later, sc)).toBe(103);
    const synced = syncStamina(s, later, sc);
    expect(synced.stamina.at).toBe(FRIDAY.getTime() + 3 * sc.energia.regenMinutos * MIN);
    expect(minutesToNextStamina(s, later, sc)).toBe(Math.ceil(sc.energia.regenMinutos / 2));
    const muchLater = new Date(FRIDAY.getTime() + 10_000 * MIN);
    expect(currentStamina(s, muchLater, sc)).toBe(sc.energia.tetoRegen);
  });

  it('energia extra passa do teto de regeneração, até o máximo', () => {
    let s = addStamina(player(), sc.energia.diaria, FRIDAY, sc);
    expect(currentStamina(s, FRIDAY, sc)).toBe(sc.energia.inicial + sc.energia.diaria);
    s = addStamina(s, 10_000, FRIDAY, sc);
    expect(currentStamina(s, FRIDAY, sc)).toBe(sc.energia.maximo);
    // acima do teto não regenera
    expect(minutesToNextStamina(s, FRIDAY, sc)).toBeNull();
  });
});

describe('acesso a capítulos e fases', () => {
  const [c1, c2] = sc.capitulos;

  it('fases abrem em sequência', () => {
    const s = player();
    expect(stageBlocker(s, c1.fases[0].id, FRIDAY, sc)).toBeNull();
    expect(stageBlocker(s, c1.fases[1].id, FRIDAY, sc)).toMatch(/anterior/);
    expect(stageBlocker(clear(s, [c1.fases[0].id]), c1.fases[1].id, FRIDAY, sc)).toBeNull();
  });

  it('capítulo seguinte exige o anterior concluído e o nível mínimo', () => {
    const s = player();
    expect(chapterBlocker(s, c2.id, sc)).toMatch(/Conclua/);
    const done = clear(
      s,
      c1.fases.map((f) => f.id),
    );
    const low = { ...done, level: c2.nivelMinimo - 1 };
    expect(chapterBlocker(low, c2.id, sc)).toMatch(/nível/);
    expect(chapterBlocker({ ...done, level: c2.nivelMinimo }, c2.id, sc)).toBeNull();
  });

  it('sem energia não joga', () => {
    const s: PlayerState = { ...player(), stamina: { value: 0, at: FRIDAY.getTime() } };
    expect(stageBlocker(s, c1.fases[0].id, FRIDAY, sc)).toMatch(/Energia/);
  });
});

describe('resultado da fase', () => {
  const [c1] = sc.capitulos;
  const f1 = c1.fases[0];

  it('estrelas: 3 sem mortes, 2 com uma, 1 com mais', () => {
    expect([0, 1, 2, 4].map((d) => starsFor(d, sc))).toEqual([3, 2, 1, 1]);
  });

  it('derrota não gasta energia nem muda nada', () => {
    const s = player();
    expect(completeStage(s, f1.id, false, 4, FRIDAY, sc, pc).state).toBe(s);
  });

  it('vitória gasta energia, paga XP por energia e o prêmio de primeira vez', () => {
    const s = player();
    const r = completeStage(s, f1.id, true, 1, FRIDAY, sc, pc, ['boitata']);
    expect(currentStamina(r.state, FRIDAY, sc)).toBe(sc.energia.inicial - sc.energia.custoFase);
    expect(r.stars).toBe(2);
    expect(r.reward.xp).toBe(sc.energia.custoFase * sc.premioPorEnergia.xp);
    expect(r.state.food).toEqual(f1.primeiraVez?.comida);
    expect(r.firstClear).toBe(true);
    expect(r.state.daily.progress.historia).toBe(1);
    expect(r.state.ninjas.boitata.xp + r.state.ninjas.boitata.level).toBeGreaterThan(1);

    // repetir: sem prêmio de primeira vez, mas melhora as estrelas
    const again = completeStage(r.state, f1.id, true, 0, FRIDAY, sc, pc);
    expect(again.firstClear).toBe(false);
    expect(again.reward.food).toBeUndefined();
    expect(again.state.story.stars[f1.id]).toBe(3);
  });

  it('segunda-feira dobra o XP da história', () => {
    const r = completeStage(player(MONDAY), f1.id, true, 0, MONDAY, sc, pc);
    expect(r.reward.xp).toBe(2 * sc.energia.custoFase * sc.premioPorEnergia.xp);
  });

  it('prêmio do capítulo e bônus de 3★ saem uma vez só', () => {
    const ids = c1.fases.map((f) => f.id);
    let s = clear(player(), ids.slice(0, -1), 1); // tudo com 2★ menos o chefe
    s = { ...s, stamina: { value: 100, at: FRIDAY.getTime() } };
    const boss = completeStage(s, ids.at(-1)!, true, 0, FRIDAY, sc, pc);
    expect(boss.chapterCompleted).toBe(true);
    expect(boss.chapterPerfect).toBe(false);
    expect(boss.state.story.rewarded).toEqual([c1.id]);

    const perfect = clear(boss.state, ids.slice(0, -1), 0);
    expect(perfect.story.perfect).toEqual([c1.id]);
    expect(perfect.wallet.cupom).toBe(c1.bonus3Estrelas.cupom);
    const twice = clear(perfect, ids, 0);
    expect(twice.wallet.cupom).toBe(c1.bonus3Estrelas.cupom);
  });
});

describe('save', () => {
  it('save antigo sem história ganha progresso vazio e energia inicial', () => {
    const old = JSON.parse(JSON.stringify(freshSave(FRIDAY, ROSTER, pc, sc)));
    delete old.player.story;
    delete old.player.stamina;
    const parsed = parseSave(old, FRIDAY, ROSTER, pc);
    expect(parsed.player.story).toEqual({ stars: {}, rewarded: [], perfect: [] });
    expect(currentStamina(parsed.player, FRIDAY, sc)).toBe(sc.energia.inicial);
  });
});
