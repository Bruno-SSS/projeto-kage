import Phaser from 'phaser';
import { dailyStatus, gameWeekday } from '../core/progression';
import { ENEMY_FORMATION } from '../data/formations';
import { NINJAS } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { toSlots } from '../ui/formationState';
import { getSave, loadFormation, playerTeam, tick } from '../ui/session';
import { TEXT, textStyle } from '../ui/theme';

const ACTIVITY_LABELS: Record<string, string> = {
  missao: 'missões',
  historia: 'história',
  vitoria: 'vitórias',
  recrutamento: 'recrutamento',
};

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Central do jogador: ponto de partida para todas as áreas. */
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create(): void {
    const { loginGranted } = tick();
    const { player } = getSave();
    drawHeader(this, 'Vila');

    const now = new Date();
    const claimable = dailyStatus(player, PROGRESSAO).filter((d) => d.claimable).length;
    const missionsLeft = PROGRESSAO.quadro.maxPorDia - player.daily.missionsDone;
    const owned = Object.keys(player.owned).length;
    const teamSize = loadFormation().length;

    const items: [string, string, () => void][] = [
      ['Missões D–S', `${missionsLeft} restantes hoje`, () => this.scene.start('Missions')],
      [
        'Missões diárias',
        claimable > 0 ? `${claimable} prêmio(s) para resgatar!` : 'ver progresso',
        () => this.scene.start('Daily'),
      ],
      [
        'Recrutar',
        `${fmt(player.wallet.pergaminho)} pergaminhos`,
        () => this.scene.start('Recruit'),
      ],
      ['Formação', `${teamSize} no time · ${owned} ninjas`, () => this.scene.start('Formation')],
      [
        'Treino',
        'luta sem recompensa',
        () =>
          teamSize > 0 &&
          this.scene.start('Battle', {
            teamA: playerTeam(),
            teamB: toSlots(ENEMY_FORMATION, NINJAS),
            returnTo: 'Hub',
          }),
      ],
    ];

    items.forEach(([label, sub, onClick], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 300 + col * 360;
      const y = 150 + row * 100;
      new Button(this, x, y, 320, 74, `${label}\n${sub}`, onClick, { fontSize: 18 });
    });

    const bonus = PROGRESSAO.bonusSemanal[String(gameWeekday(now, PROGRESSAO))] ?? [];
    const bonusText = bonus.length
      ? bonus
          .map(
            (b) =>
              `${b.recurso.toUpperCase()} ×${b.multiplicador} em ${ACTIVITY_LABELS[b.atividade] ?? b.atividade}`,
          )
          .join(', ')
      : 'nenhum';
    this.add
      .text(
        480,
        470,
        `Hoje é ${WEEKDAYS[gameWeekday(now, PROGRESSAO)]}. Bônus do dia: ${bonusText}.`,
        textStyle(14, TEXT.muted),
      )
      .setOrigin(0.5);
    if (teamSize === 0) {
      this.add
        .text(480, 500, 'Monte sua formação antes de lutar.', textStyle(14, TEXT.teamB))
        .setOrigin(0.5);
    }
    if (loginGranted) {
      this.add
        .text(
          480,
          500,
          `Login diário: +${fmt(PROGRESSAO.dia.loginRyo)} ryo`,
          textStyle(15, TEXT.accent, true),
        )
        .setOrigin(0.5);
    }
  }
}
