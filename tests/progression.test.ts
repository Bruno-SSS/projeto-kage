import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle';
import { runAutoBattle } from '../src/core/ai';
import { seededRng } from '../src/core/gacha';
import {
  bonusMultiplier,
  claimDaily,
  completeMission,
  dailyStatus,
  dayKey,
  gameWeekday,
  grant,
  grantFromRewards,
  MISSION_RANKS,
  missionBlocker,
  missionEnemies,
  newPlayer,
  recordActivity,
  recruitWithFragments,
  refreshBoard,
  rollRank,
  startDay,
  xpToNext,
  type PlayerState,
} from '../src/core/progression';
import { DEFAULT_FORMATION } from '../src/data/formations';
import { NINJAS, ROSTER } from '../src/data/ninjas';
import { PROGRESSAO as cfg } from '../src/data/progressao';
import { toSlots } from '../src/ui/formationState';

/** 2026-11-20 (sexta) 12:00 em Brasília = 15:00 UTC. */
const FRIDAY_NOON = new Date('2026-11-20T15:00:00Z');
const HOUR = 3600_000;
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

const player = (): PlayerState => newPlayer(['boitata', 'saci'], FRIDAY_NOON, cfg);

/** Quadro com um rank específico em todas as missões. */
function boardOf(state: PlayerState, rank: PlayerState['board']['missions'][number]['rank']) {
  const s = refreshBoard(state, FRIDAY_NOON, cfg, seededRng(1));
  return { ...s, board: { ...s.board, missions: s.board.missions.map((m) => ({ ...m, rank })) } };
}

describe('progressao.json', () => {
  it('chances do quadro somam 100%', () => {
    const total = MISSION_RANKS.reduce((t, r) => t + cfg.quadro.ranks[r].chance, 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it('recompensas crescem de D para S', () => {
    const xps = MISSION_RANKS.map((r) => cfg.quadro.ranks[r].xp);
    expect([...xps].sort((a, b) => a - b)).toEqual(xps);
  });
});

describe('nível e XP', () => {
  it('a curva cresce a cada nível até o máximo', () => {
    for (let n = 1; n < cfg.nivel.maximo; n++) {
      expect(xpToNext(n + 1, cfg)).toBeGreaterThan(xpToNext(n, cfg));
    }
  });

  it('usa os valores da tabela nos níveis conhecidos', () => {
    expect(xpToNext(1, cfg)).toBe(2000);
    expect(xpToNext(10, cfg)).toBe(13000);
    expect(xpToNext(50, cfg)).toBe(1050313);
    expect(xpToNext(65, cfg)).toBe(3162992);
  });

  it('interpola com crescimento constante entre níveis conhecidos', () => {
    // 20 → 35: mesma razão entre cada nível
    const ratio = Math.pow(396929 / 83581, 1 / 15);
    expect(xpToNext(21, cfg)).toBe(Math.round(83581 * ratio));
    expect(xpToNext(34, cfg)).toBe(Math.round(83581 * Math.pow(ratio, 14)));
  });

  it('depois da tabela cresce o percentual configurado', () => {
    const growth = 1 + cfg.nivel.crescimentoAposTabela;
    expect(xpToNext(66, cfg)).toBe(Math.round(3162992 * growth));
    expect(xpToNext(70, cfg)).toBe(Math.round(3162992 * Math.pow(growth, 5)));
  });

  it('sobe vários níveis de uma vez, guarda o excedente e paga o presente de nível', () => {
    let total = 0;
    for (let n = 1; n < 10; n++) total += xpToNext(n, cfg);
    const { state, levelUps } = grant(player(), { xp: total + 7 }, cfg);
    expect(state.level).toBe(10);
    expect(state.xp).toBe(7);
    expect(levelUps).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(state.wallet.ryo).toBe(5000); // presente do nível 10
  });

  it('para no nível máximo', () => {
    const { state } = grant(player(), { xp: 1e15 }, cfg);
    expect(state.level).toBe(cfg.nivel.maximo);
    expect(state.xp).toBe(0);
  });

  it('não altera o estado recebido', () => {
    const p = player();
    const snapshot = JSON.stringify(p);
    grant(p, { xp: 999999, ryo: 10, fragments: [{ ninjaId: 'iara', amount: 3 }] }, cfg);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});

describe('recompensas do gacha e fragmentos', () => {
  it('converte ninja, fragmentos e moedas do gacha', () => {
    const g = grantFromRewards([
      { type: 'ninja', ninjaId: 'iara', rarity: 'lendario' },
      { type: 'fragmentos', ninjaId: 'cuca', amount: 5 },
      { type: 'moeda', currency: 'cupom', amount: 100 },
    ]);
    const { state } = grant(player(), g, cfg);
    expect(state.owned.iara).toBe(true);
    expect(state.fragments.cuca).toBe(5);
    expect(state.wallet.cupom).toBe(100);
  });

  it('80 fragmentos recrutam o ninja', () => {
    const { state } = grant(player(), { fragments: [{ ninjaId: 'cuca', amount: 85 }] }, cfg);
    const after = recruitWithFragments(state, 'cuca', cfg);
    expect(after.owned.cuca).toBe(true);
    expect(after.fragments.cuca).toBe(5);
    expect(() => recruitWithFragments(after, 'cuca', cfg)).toThrow(/já tem/);
    expect(() => recruitWithFragments(state, 'iara', cfg)).toThrow(/insuficientes/);
  });
});

describe('dia de jogo', () => {
  it('vira às 05:00 de Brasília', () => {
    const before = new Date('2026-11-21T07:59:00Z'); // 04:59 BRT de sábado
    const after = new Date('2026-11-21T08:00:00Z'); // 05:00 BRT
    expect(dayKey(before, cfg)).toBe('2026-11-20');
    expect(dayKey(after, cfg)).toBe('2026-11-21');
    expect(gameWeekday(before, cfg)).toBe(5);
    expect(gameWeekday(after, cfg)).toBe(6);
  });

  it('login dá ryo uma vez por dia e zera as diárias na virada', () => {
    let s = recordActivity(player(), 'vitoria', 2);
    let r = startDay(s, FRIDAY_NOON, cfg);
    expect(r.loginGranted).toBe(true);
    s = r.state;
    expect(startDay(s, at(FRIDAY_NOON, HOUR), cfg).loginGranted).toBe(false);
    expect(s.daily.progress.vitoria).toBe(2);

    r = startDay(s, at(FRIDAY_NOON, 24 * HOUR), cfg);
    expect(r.loginGranted).toBe(true);
    expect(r.state.daily.progress).toEqual({});
    expect(r.state.wallet.ryo).toBe(2 * cfg.dia.loginRyo);
  });

  it('bônus da semana: missões com ryo dobrado na sexta e XP dobrado na terça', () => {
    expect(bonusMultiplier(FRIDAY_NOON, 'missao', 'ryo', cfg)).toBe(2);
    expect(bonusMultiplier(FRIDAY_NOON, 'missao', 'xp', cfg)).toBe(1);
    const tuesday = new Date('2026-11-24T15:00:00Z');
    expect(bonusMultiplier(tuesday, 'missao', 'xp', cfg)).toBe(2);
  });
});

describe('missões diárias', () => {
  it('só resgata quando completa, e uma vez', () => {
    let s = recordActivity(player(), 'vitoria', 2);
    expect(() => claimDaily(s, 'vencer-batalhas', cfg)).toThrow(/não pode/);
    s = recordActivity(s, 'vitoria');
    expect(dailyStatus(s, cfg).find((d) => d.task.id === 'vencer-batalhas')?.claimable).toBe(true);
    const { state } = claimDaily(s, 'vencer-batalhas', cfg);
    expect(state.wallet.ryo).toBe(5000);
    expect(() => claimDaily(state, 'vencer-batalhas', cfg)).toThrow(/não pode/);
  });
});

describe('quadro de missões D–S', () => {
  it('sorteia rank pela chance acumulada', () => {
    expect(rollRank(0, cfg)).toBe('D');
    expect(rollRank(0.36, cfg)).toBe('C');
    expect(rollRank(0.999, cfg)).toBe('S');
  });

  it('renova só quando muda a janela de 30 minutos', () => {
    const s = refreshBoard(player(), FRIDAY_NOON, cfg, seededRng(1));
    expect(s.board.missions).toHaveLength(cfg.quadro.tamanho);
    expect(refreshBoard(s, at(FRIDAY_NOON, 60_000), cfg, seededRng(2))).toBe(s);
    const later = refreshBoard(s, at(FRIDAY_NOON, 30 * 60_000), cfg, seededRng(2));
    expect(later.board.slot).toBe(s.board.slot + 1);
  });

  it('vitória paga o rank com bônus do dia; derrota não muda nada', () => {
    const s = boardOf(startDay(player(), FRIDAY_NOON, cfg).state, 'B');
    const id = s.board.missions[0].id;

    const lost = completeMission(s, id, false, FRIDAY_NOON, cfg, ROSTER, seededRng(3));
    expect(lost.state).toBe(s);

    const won = completeMission(s, id, true, FRIDAY_NOON, cfg, ROSTER, seededRng(3));
    expect(won.reward.xp).toBe(cfg.quadro.ranks.B.xp);
    expect(won.reward.ryo).toBe(cfg.quadro.ranks.B.ryo * 2); // sexta: ryo dobrado
    expect(won.reward.fragments?.[0].amount).toBe(cfg.quadro.ranks.B.fragmentos);
    expect(won.state.board.missions[0].done).toBe(true);
    expect(won.state.daily.progress).toMatchObject({ missao: 1, vitoria: 1 });
    expect(missionBlocker(won.state, id, cfg)).toMatch(/já concluída/);
  });

  it('respeita o limite de rank S por dia', () => {
    let s = boardOf(player(), 'S');
    for (let i = 0; i < cfg.quadro.maxRankSPorDia; i++) {
      s = completeMission(
        s,
        s.board.missions[i].id,
        true,
        FRIDAY_NOON,
        cfg,
        ROSTER,
        seededRng(i),
      ).state;
    }
    expect(missionBlocker(s, s.board.missions[2].id, cfg)).toMatch(/rank S/);
  });

  it('respeita o limite de missões por dia', () => {
    const s = boardOf(player(), 'D');
    const full = { ...s, daily: { ...s.daily, missionsDone: cfg.quadro.maxPorDia } };
    expect(missionBlocker(full, s.board.missions[0].id, cfg)).toMatch(/por dia/);
  });

  it('inimigos da missão: quantidade e força pelo rank, sempre o mesmo time', () => {
    const s = refreshBoard(player(), FRIDAY_NOON, cfg, seededRng(5));
    const d = { ...s.board.missions[0], rank: 'D' as const };
    const sRank = { ...d, rank: 'S' as const };
    const easy = missionEnemies(d, ROSTER, cfg);
    const hard = missionEnemies(sRank, ROSTER, cfg);
    expect(easy).toHaveLength(cfg.quadro.ranks.D.inimigos);
    expect(hard).toHaveLength(cfg.quadro.ranks.S.inimigos);
    expect(missionEnemies(d, ROSTER, cfg)).toEqual(easy);
    const base = NINJAS[easy[0].ninja.id].stats.hp;
    expect(easy[0].ninja.stats.hp).toBe(Math.round(base * cfg.quadro.ranks.D.forcaInimigo));
    // o elenco original não é alterado
    expect(NINJAS[easy[0].ninja.id].stats.hp).toBe(base);
  });

  it('a formação padrão vence missões D na maioria dos quadros', () => {
    let wins = 0;
    for (let seed = 0; seed < 20; seed++) {
      const mission = { id: 'x', rank: 'D' as const, done: false, seed };
      const battle = new Battle(
        toSlots(DEFAULT_FORMATION, NINJAS),
        missionEnemies(mission, ROSTER, cfg),
      );
      runAutoBattle(battle);
      if (battle.outcome === 'A') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(16);
  });
});
