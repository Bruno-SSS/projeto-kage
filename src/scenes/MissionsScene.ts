import Phaser from 'phaser';
import {
  bonusMultiplier,
  boardSlot,
  missionBlocker,
  missionEnemies,
  type MissionRank,
} from '../core/progression';
import { ROSTER } from '../data/ninjas';
import { PROGRESSAO as cfg } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { getSave, loadFormation, playerTeam, tick } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

const RANK_COLORS: Record<MissionRank, string> = {
  D: '#9aa4b2',
  C: '#5cc977',
  B: '#4ea8de',
  A: '#b07bff',
  S: '#f2a541',
};

/** Quadro de missões D–S. */
export class MissionsScene extends Phaser.Scene {
  constructor() {
    super('Missions');
  }

  create(): void {
    tick();
    const { player } = getSave();
    const now = new Date();
    drawHeader(this, 'Missões D–S', 'Hub');

    const nextRefresh = (boardSlot(now, cfg) + 1) * cfg.quadro.renovaMinutos * 60_000;
    const minutes = Math.ceil((nextRefresh - now.getTime()) / 60_000);
    this.add.text(
      24,
      72,
      `Hoje: ${player.daily.missionsDone}/${cfg.quadro.maxPorDia} missões · rank S ${player.daily.rankSDone}/${cfg.quadro.maxRankSPorDia} · novo quadro em ${minutes} min`,
      textStyle(14, TEXT.muted),
    );

    const hasTeam = loadFormation().length > 0;
    player.board.missions.forEach((mission, i) => {
      const y = 128 + i * 76;
      const rank = cfg.quadro.ranks[mission.rank];
      this.add.rectangle(480, y, 912, 68, COLORS.panel).setStrokeStyle(1, COLORS.border);
      this.add
        .text(50, y, mission.rank, textStyle(36, RANK_COLORS[mission.rank], true))
        .setOrigin(0.5);

      const xp = rank.xp * bonusMultiplier(now, 'missao', 'xp', cfg);
      const ryo = rank.ryo * bonusMultiplier(now, 'missao', 'ryo', cfg);
      const frag = rank.fragmentos > 0 ? ` · ${rank.fragmentos} fragmento(s)` : '';
      const food = Object.entries(rank.comida ?? {})
        .map(([id, n]) => ` · ${n} ${cfg.ninjas.comida[id]?.nome ?? id}`)
        .join('');
      this.add.text(
        90,
        y - 24,
        `XP ${fmt(xp)} · Ryo ${fmt(ryo)}${frag}${food}`,
        textStyle(16, TEXT.main, true),
      );
      const enemies = missionEnemies(mission, ROSTER, cfg, player.level);
      this.add.text(
        90,
        y + 4,
        `Inimigos: ${enemies.map((e) => e.ninja.name).join(', ')} (nível ${player.level}, força ${Math.round(rank.forcaInimigo * 100)}%)`,
        textStyle(13, TEXT.muted),
      );

      const blocker = missionBlocker(player, mission.id, cfg);
      if (mission.done) {
        this.add.text(860, y, 'Concluída', textStyle(15, TEXT.accent, true)).setOrigin(0.5);
      } else if (blocker || !hasTeam) {
        this.add
          .text(860, y, blocker ? 'Limite do dia' : 'Sem time', textStyle(14, TEXT.teamB))
          .setOrigin(0.5);
      } else {
        new Button(this, 860, y, 130, 44, 'Lutar', () => {
          this.scene.start('Battle', {
            teamA: playerTeam(),
            teamB: enemies,
            missionId: mission.id,
            returnTo: 'Missions',
          });
        });
      }
    });
  }
}
