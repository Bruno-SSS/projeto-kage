import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { TEXT, textStyle } from '../ui/theme';
import type { BattleResult } from './BattleScene';

const TITLES = {
  A: { text: 'Vitória!', color: TEXT.accent },
  B: { text: 'Derrota', color: TEXT.teamB },
  draw: { text: 'Empate', color: TEXT.muted },
};

export class ResultScene extends Phaser.Scene {
  private result!: BattleResult;

  constructor() {
    super('Result');
  }

  init(result: BattleResult): void {
    this.result = result;
  }

  create(): void {
    const { outcome, rounds, bestCombo, data } = this.result;
    const title = TITLES[outcome ?? 'draw'];

    const heading = this.add
      .text(480, 170, title.text, textStyle(64, title.color, true))
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: heading, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });

    this.add
      .text(
        480,
        250,
        `${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'} · maior combo: ${bestCombo > 0 ? `x${bestCombo}` : 'nenhum'}`,
        textStyle(20, TEXT.muted),
      )
      .setOrigin(0.5);

    new Button(this, 480, 340, 260, 52, 'Lutar de novo', () => this.scene.start('Battle', data), {
      fontSize: 20,
    });
    new Button(this, 480, 404, 260, 52, 'Mudar formação', () => this.scene.start('Formation'), {
      fontSize: 20,
    });
  }
}
