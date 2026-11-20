import Phaser from 'phaser';
import type { NinjaTemplate } from '../core/types';
import { COLORS, ELEMENT_COLORS, TEXT, textStyle } from './theme';

export const TOKEN_RADIUS = 30;
const HP_WIDTH = 64;

export interface TokenOptions {
  /** Cor da borda (time). */
  ring?: number;
  /** Mostra nome e barra de vida embaixo. */
  showHp?: boolean;
}

/**
 * Representação visual provisória de um ninja: círculo na cor do elemento com
 * a inicial, nome e barra de vida. A arte definitiva chega na Fase 3.
 */
export class NinjaToken extends Phaser.GameObjects.Container {
  readonly ninja: NinjaTemplate;
  /** Círculo principal (alvo de toque/clique). */
  readonly orb: Phaser.GameObjects.Arc;
  private readonly highlight: Phaser.GameObjects.Arc;
  private readonly hpFill?: Phaser.GameObjects.Rectangle;
  private readonly stunIcon: Phaser.GameObjects.Text;
  private highlightTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    ninja: NinjaTemplate,
    { ring = COLORS.border, showHp = false }: TokenOptions = {},
  ) {
    super(scene, x, y);
    this.ninja = ninja;

    this.highlight = scene.add
      .circle(0, 0, TOKEN_RADIUS + 8)
      .setStrokeStyle(3, COLORS.accent)
      .setVisible(false);
    this.orb = scene.add
      .circle(0, 0, TOKEN_RADIUS, ELEMENT_COLORS[ninja.element])
      .setStrokeStyle(3, ring);
    const initial = scene.add
      .text(0, 0, ninja.name[0], textStyle(26, TEXT.main, true))
      .setOrigin(0.5)
      .setShadow(1, 1, '#000', 2);
    this.stunIcon = scene.add
      .text(TOKEN_RADIUS - 4, -TOKEN_RADIUS + 2, 'zz', textStyle(16, TEXT.good, true))
      .setOrigin(0.5)
      .setVisible(false);
    this.add([this.highlight, this.orb, initial, this.stunIcon]);

    if (showHp) {
      const name = scene.add
        .text(0, TOKEN_RADIUS + 12, ninja.name, textStyle(13, TEXT.main))
        .setOrigin(0.5);
      const hpBg = scene.add.rectangle(0, TOKEN_RADIUS + 27, HP_WIDTH, 7, 0x000000, 0.6);
      this.hpFill = scene.add
        .rectangle(-HP_WIDTH / 2, TOKEN_RADIUS + 27, HP_WIDTH, 7, COLORS.hp)
        .setOrigin(0, 0.5);
      this.add([name, hpBg, this.hpFill]);
    }

    this.setSize(TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
    scene.add.existing(this);
  }

  setHp(hp: number, maxHp: number): void {
    if (!this.hpFill) return;
    const ratio = Math.max(0, hp / maxHp);
    this.scene.tweens.add({ targets: this.hpFill, width: HP_WIDTH * ratio, duration: 250 });
    this.hpFill.setFillStyle(ratio < 0.3 ? COLORS.hpLow : COLORS.hp);
  }

  setHighlighted(on: boolean): void {
    this.highlight.setVisible(on);
    this.highlightTween?.stop();
    this.highlight.setScale(1);
    if (on) {
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlight,
        scale: 1.12,
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  setStunned(on: boolean): void {
    this.stunIcon.setVisible(on);
  }

  die(): void {
    this.setHighlighted(false);
    this.setStunned(false);
    this.scene.tweens.add({ targets: this, alpha: 0.2, scale: 0.85, duration: 300 });
  }
}
