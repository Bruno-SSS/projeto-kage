import Phaser from 'phaser';
import { claimDaily, dailyStatus } from '../core/progression';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { getSave, tick, updateSave } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

/** Missões diárias: progresso e resgate. Zeram às 05:00 de Brasília. */
export class DailyScene extends Phaser.Scene {
  constructor() {
    super('Daily');
  }

  create(): void {
    tick();
    drawHeader(this, 'Missões diárias', 'Hub');
    this.add.text(24, 72, 'Zeram todo dia às 05:00 (Brasília).', textStyle(14, TEXT.muted));

    dailyStatus(getSave().player, PROGRESSAO).forEach(
      ({ task, progress, claimable, claimed }, i) => {
        const y = 140 + i * 86;
        this.add.rectangle(480, y, 912, 74, COLORS.panel).setStrokeStyle(1, COLORS.border);
        this.add.text(40, y - 26, task.nome, textStyle(18, TEXT.main, true));
        const prize = [
          task.xp && `${fmt(task.xp)} XP`,
          task.ryo && `${fmt(task.ryo)} ryo`,
          task.cupom && `${fmt(task.cupom)} cupons`,
          task.pergaminho && `${fmt(task.pergaminho)} pergaminhos`,
        ]
          .filter(Boolean)
          .join(' · ');
        this.add.text(
          40,
          y + 4,
          `${progress}/${task.quantidade} · prêmio: ${prize}`,
          textStyle(14, TEXT.muted),
        );

        if (claimed) {
          this.add.text(860, y, 'Resgatado', textStyle(15, TEXT.accent, true)).setOrigin(0.5);
        } else if (claimable) {
          new Button(this, 860, y, 130, 44, 'Resgatar', () => {
            updateSave((s) => ({ ...s, player: claimDaily(s.player, task.id, PROGRESSAO).state }));
            this.scene.restart();
          });
        } else {
          this.add.text(860, y, 'Em andamento', textStyle(14, TEXT.muted)).setOrigin(0.5);
        }
      },
    );
  }
}
