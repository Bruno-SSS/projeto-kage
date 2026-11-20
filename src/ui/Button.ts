import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

export interface ButtonOptions {
  fontSize?: number;
  fill?: number;
  stroke?: number;
}

/** Botão retangular simples que funciona com mouse e toque. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void,
    { fontSize = 18, fill = COLORS.panelLight, stroke = COLORS.accent }: ButtonOptions = {},
  ) {
    super(scene, x, y);
    this.bg = scene.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, stroke);
    this.label = scene.add
      .text(0, 0, text, { ...textStyle(fontSize), align: 'center' })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    scene.add.existing(this);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.enabled && this.bg.setFillStyle(COLORS.border));
    this.bg.on('pointerout', () => this.bg.setFillStyle(fill));
    this.bg.on('pointerup', () => {
      if (this.enabled) onClick();
    });
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.4);
    return this;
  }
}
