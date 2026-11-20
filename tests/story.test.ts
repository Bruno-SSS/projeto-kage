import { describe, expect, it } from 'vitest';
import { runAutoBattle } from '../src/core/ai';
import { Battle } from '../src/core/battle';
import { effectiveTemplate } from '../src/core/evolution';
import { validateFormation } from '../src/core/formation';
import type { PlayerState } from '../src/core/progression';
import {
  addStamina,
  challengeBlocker,
  challengeEnemies,
  chapterBlocker,
  completeChallenge,
  completeStage,
  currentStamina,
  minutesToNextStamina,
  stageBlocker,
  stageEnemies,
  starsFor,
  sweepBlocker,
  sweepStage,
  syncStamina,
  type StageDef,
} from '../src/core/story';
import type { FormationSlot } from '../src/core/types';
import { DEFAULT_FORMATION } from '../src/data/formations';
import { HISTORIA as sc } from '../src/data/historia';
import { NINJAS, ROSTER } from '../src/data/ninjas';
import { PROGRESSAO as pc } from '../src/data/progressao';
import { freshSave, parseSave } from '../src/ui/session';

const FRIDAY = new Date('2026-11-20T15:00:00Z');
const MONDAY = new Date('2026-11-23T15:00:00Z');
const MIN = 60_000;
const allStages = sc.capitulos.flatMap((c) => c.fases);
const [c1, c2] = sc.capitulos;
const f1 = c1.fases[0];

/** Jogador com nível alto e energia cheia, para testar as regras sem esbarrar nos portões. */
const player = (now = FRIDAY, level = 50): PlayerState => {
  const p = freshSave(now, ROSTER, pc, sc).player;
  return { ...p, level, stamina: { value: sc.energia.maximo, at: now.getTime() } };
};
const refill = (s: PlayerState): PlayerState => ({
  ...s,
  stamina: { value: sc.energia.maximo, at: FRIDAY.getTime() },
});

/** Vence as fases dadas com `deaths` baixas, sem se preocupar com energia. */
function clear(state: PlayerState, ids: string[], deaths = 0): PlayerState {
  let s = state;
  for (const id of ids) s = completeStage(refill(s), id, true, deaths, FRIDAY, sc, pc).state;
  return s;
}

/** Time inicial no nível da fase, com 3★. */
function starterTeam(stage: StageDef): FormationSlot[] {
  return DEFAULT_FORMATION.map((p) => ({
    ninja: effectiveTemplate(NINJAS[p.id], { level: stage.nivelInimigo, xp: 0, stars: 3 }, pc),
    position: { row: p.row, col: p.col },
  }));
}

describe('historia.json', () => {
  it('todas as lutas e desafios têm formação inimiga válida', () => {
    for (const stage of allStages) {
      stage.lutas.forEach((_, w) =>
        expect(validateFormation(stageEnemies(stage, NINJAS, pc, w)), `${stage.id}#${w}`).toEqual(
          [],
        ),
      );
      if (stage.desafio) expect(validateFormation(challengeEnemies(stage, NINJAS, pc))).toEqual([]);
    }
  });

  it('ids únicos, cada capítulo termina num chefe e o desafio é mais forte que o objetivo', () => {
    const ids = allStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of sc.capitulos) expect(c.fases.at(-1)?.chefe).toBe(true);
    for (const stage of allStages) {
      const goalHp = stageEnemies(stage, NINJAS, pc)[0].ninja.stats.hp;
      expect(challengeEnemies(stage, NINJAS, pc)[0].ninja.stats.hp).toBeGreaterThan(goalHp);
    }
  });

  it('regras da pesquisa: 3★ do capítulo = 20 + 10 × (capítulo − 1) cupons; 10 rodadas por luta', () => {
    sc.capitulos.forEach((c, i) => expect(c.bonus3Estrelas.cupom).toBe(20 + 10 * i));
    expect(sc.limiteRodadas).toBe(10);
    expect(sc.estrelas.maxMortes).toBe(3);
  });
});

describe('dificuldade', () => {
  it('o time inicial com 3★, no nível da fase, vence todas as lutas em até 10 rodadas (IA)', () => {
    for (const stage of allStages) {
      stage.lutas.forEach((_, w) => {
        const battle = new Battle(starterTeam(stage), stageEnemies(stage, NINJAS, pc, w), {
          maxRounds: sc.limiteRodadas,
        });
        runAutoBattle(battle);
        expect(battle.outcome, `${stage.id} luta ${w + 1}`).toBe('A');
      });
    }
  });
});

describe('energia', () => {
  const fresh = () => freshSave(FRIDAY, ROSTER, pc, sc).player;

  it('jogador novo começa com a energia inicial', () => {
    expect(currentStamina(fresh(), FRIDAY, sc)).toBe(sc.energia.inicial);
  });

  it('regenera 1 a cada N minutos até o teto, guardando a fração', () => {
    const s: PlayerState = { ...fresh(), stamina: { value: 100, at: FRIDAY.getTime() } };
    const later = new Date(FRIDAY.getTime() + 3.5 * sc.energia.regenMinutos * MIN);
    expect(currentStamina(s, later, sc)).toBe(103);
    expect(syncStamina(s, later, sc).stamina.at).toBe(
      FRIDAY.getTime() + 3 * sc.energia.regenMinutos * MIN,
    );
    expect(minutesToNextStamina(s, later, sc)).toBe(Math.ceil(sc.energia.regenMinutos / 2));
    expect(currentStamina(s, new Date(FRIDAY.getTime() + 10_000 * MIN), sc)).toBe(
      sc.energia.tetoRegen,
    );
  });

  it('energia extra passa do teto de regeneração, até o máximo', () => {
    let s = addStamina(fresh(), sc.energia.diaria, FRIDAY, sc);
    expect(currentStamina(s, FRIDAY, sc)).toBe(sc.energia.inicial + sc.energia.diaria);
    s = addStamina(s, 10_000, FRIDAY, sc);
    expect(currentStamina(s, FRIDAY, sc)).toBe(sc.energia.maximo);
    expect(minutesToNextStamina(s, FRIDAY, sc)).toBeNull();
  });
});

describe('acesso', () => {
  it('fases abrem em sequência', () => {
    const s = player();
    expect(stageBlocker(s, f1.id, FRIDAY, sc)).toBeNull();
    expect(stageBlocker(s, c1.fases[1].id, FRIDAY, sc)).toMatch(/anterior/);
    expect(stageBlocker(clear(s, [f1.id]), c1.fases[1].id, FRIDAY, sc)).toBeNull();
  });

  it('cada fase tem nível mínimo próprio', () => {
    const s = clear(player(FRIDAY, 50), [f1.id]);
    const low = { ...s, level: (c1.fases[1].nivelMinimo ?? 1) - 1 };
    expect(stageBlocker(low, c1.fases[1].id, FRIDAY, sc)).toMatch(/Requer nível/);
  });

  it('capítulo seguinte exige o anterior concluído e o nível mínimo', () => {
    const s = player();
    expect(chapterBlocker(s, c2.id, sc)).toMatch(/Conclua/);
    const done = clear(
      s,
      c1.fases.map((f) => f.id),
    );
    expect(chapterBlocker({ ...done, level: c2.nivelMinimo - 1 }, c2.id, sc)).toMatch(/nível/);
    expect(chapterBlocker(done, c2.id, sc)).toBeNull();
  });

  it('sem energia não joga', () => {
    const s: PlayerState = { ...player(), stamina: { value: 0, at: FRIDAY.getTime() } };
    expect(stageBlocker(s, f1.id, FRIDAY, sc)).toMatch(/Energia/);
  });
});

describe('estrelas', () => {
  it('★ objetivo · ★ até 3 baixas na fase · ★ desafio', () => {
    expect(starsFor(0, false, sc)).toBe(2);
    expect(starsFor(3, false, sc)).toBe(2);
    expect(starsFor(4, false, sc)).toBe(1);
    expect(starsFor(5, true, sc)).toBe(2);
    expect(starsFor(1, true, sc)).toBe(3);
  });

  it('vale a melhor passagem e o desafio vencido uma vez', () => {
    let s = clear(player(), [f1.id], 5);
    expect(s.story.stars[f1.id]).toBe(1);
    s = clear(s, [f1.id], 2);
    expect(s.story.stars[f1.id]).toBe(2);
    s = clear(s, [f1.id], 7); // pior passagem não tira estrela
    expect(s.story.stars[f1.id]).toBe(2);

    expect(challengeBlocker(player(), f1.id, sc)).toMatch(/objetivo/);
    const lost = completeChallenge(s, f1.id, false, sc, pc);
    expect(lost.state).toBe(s);
    const r = completeChallenge(s, f1.id, true, sc, pc);
    expect(r.stars).toBe(3);
    expect(challengeBlocker(r.state, f1.id, sc)).toMatch(/já vencido/);
  });

  it('desafio antes de uma boa passagem: 2★ até melhorar as baixas', () => {
    let s = clear(player(), [f1.id], 6);
    s = completeChallenge(s, f1.id, true, sc, pc).state;
    expect(s.story.stars[f1.id]).toBe(2);
    s = clear(s, [f1.id], 0);
    expect(s.story.stars[f1.id]).toBe(3);
  });
});

describe('resultado da fase', () => {
  it('derrota não gasta energia nem muda nada', () => {
    const s = player();
    expect(completeStage(s, f1.id, false, 4, FRIDAY, sc, pc).state).toBe(s);
  });

  it('vitória gasta energia, paga XP por energia e o prêmio de primeira vez', () => {
    const s = player(FRIDAY, 1);
    const r = completeStage(s, f1.id, true, 1, FRIDAY, sc, pc, ['boitata']);
    expect(currentStamina(r.state, FRIDAY, sc)).toBe(sc.energia.maximo - sc.energia.custoFase);
    expect(r.reward.xp).toBe(sc.energia.custoFase * sc.premioPorEnergia.xp);
    expect(r.state.food).toEqual(f1.primeiraVez?.comida);
    expect(r.firstClear).toBe(true);
    expect(r.state.daily.progress.historia).toBe(1);
    const again = completeStage(refill(r.state), f1.id, true, 0, FRIDAY, sc, pc);
    expect(again.firstClear).toBe(false);
    expect(again.reward.food).toBeUndefined();
  });

  it('segunda-feira dobra o XP da história', () => {
    const r = completeStage(player(MONDAY), f1.id, true, 0, MONDAY, sc, pc);
    expect(r.reward.xp).toBe(2 * sc.energia.custoFase * sc.premioPorEnergia.xp);
  });

  it('prêmio do capítulo ao concluir; bônus de 3★ com todos os desafios, uma vez só', () => {
    const ids = c1.fases.map((f) => f.id);
    let s = clear(player(), ids, 0);
    expect(s.story.rewarded).toEqual([c1.id]);
    expect(s.story.perfect).toEqual([]);
    for (const id of ids) s = completeChallenge(s, id, true, sc, pc).state;
    expect(s.story.perfect).toEqual([c1.id]);
    expect(s.wallet.cupom).toBe(c1.bonus3Estrelas.cupom);
    s = clear(s, ids, 0);
    expect(s.wallet.cupom).toBe(c1.bonus3Estrelas.cupom);
  });
});

describe('varredura', () => {
  const threeStars = () =>
    completeChallenge(clear(player(), [f1.id], 0), f1.id, true, sc, pc).state;

  it('exige 3★, energia suficiente e no máximo N por vez', () => {
    expect(sweepBlocker(clear(player(), [f1.id], 0), f1.id, 1, FRIDAY, sc)).toMatch(/3★/);
    const s = threeStars();
    expect(sweepBlocker(s, f1.id, 1, FRIDAY, sc)).toBeNull();
    expect(sweepBlocker(s, f1.id, sc.varredura.maxPorVez + 1, FRIDAY, sc)).toMatch(/de 1 a/);
    const poor = { ...s, stamina: { value: 15, at: FRIDAY.getTime() } };
    expect(sweepBlocker(poor, f1.id, 2, FRIDAY, sc)).toMatch(/Energia/);
  });

  it('gasta energia e paga XP/ryo de cada passagem, sem prêmio de primeira vez', () => {
    const s = refill(threeStars());
    const r = sweepStage(s, f1.id, 5, MONDAY, sc, pc, ['saci']);
    expect(currentStamina(r.state, MONDAY, sc)).toBe(sc.energia.maximo - 5 * sc.energia.custoFase);
    expect(r.reward.xp).toBe(5 * 2 * sc.energia.custoFase * sc.premioPorEnergia.xp); // segunda ×2
    expect(r.reward.food).toBeUndefined();
    expect(r.state.daily.progress.historia).toBe((s.daily.progress.historia ?? 0) + 5);
  });
});

describe('save', () => {
  it('save antigo sem história ganha progresso vazio e energia inicial', () => {
    const old = JSON.parse(JSON.stringify(freshSave(FRIDAY, ROSTER, pc, sc)));
    delete old.player.story;
    delete old.player.stamina;
    const parsed = parseSave(old, FRIDAY, ROSTER, pc);
    expect(parsed.player.story).toEqual({
      stars: {},
      bestDeaths: {},
      challenges: [],
      rewarded: [],
      perfect: [],
    });
    expect(currentStamina(parsed.player, FRIDAY, sc)).toBe(sc.energia.inicial);
  });

  it('save da versão anterior da história mantém estrelas e ganha os campos novos', () => {
    const old = JSON.parse(JSON.stringify(freshSave(FRIDAY, ROSTER, pc, sc)));
    old.player.story = { stars: { 'c1-f1': 2 }, rewarded: [], perfect: [] };
    const parsed = parseSave(old, FRIDAY, ROSTER, pc);
    expect(parsed.player.story.stars['c1-f1']).toBe(2);
    expect(parsed.player.story.challenges).toEqual([]);
  });
});
