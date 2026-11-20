import Phaser from 'phaser';
import { ELEMENTS } from '../core/elements';
import { Button } from '../ui/Button';
import { ELEMENT_COLORS, TEXT, textStyle } from '../ui/theme';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.24, 'PROJETO KAGE', textStyle(64, TEXT.main, true))
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.24 + 58, 'Táticas ninja em turnos', textStyle(22, TEXT.muted))
      .setOrigin(0.5);

    // Os cinco elementos girando em círculo: um aceno ao sistema de combate.
    const ring = this.add.container(width / 2, height * 0.58);
    ELEMENTS.forEach((el, i) => {
      const angle = (i / ELEMENTS.length) * Math.PI * 2 - Math.PI / 2;
      ring.add(this.add.circle(Math.cos(angle) * 70, Math.sin(angle) * 70, 14, ELEMENT_COLORS[el]));
    });
    this.tweens.add({ targets: ring, angle: 360, duration: 12000, repeat: -1 });

    new Button(this, width / 2, height * 0.86, 220, 56, 'Jogar', () => this.play(), {
      fontSize: 24,
    });
    this.input.keyboard?.once('keydown-ENTER', () => this.play());
  }

  private play(): void {
    this.scene.start('Hub');
  }
}
