import Phaser from 'phaser';
import { ELEMENTS } from '../core/elements';

const ELEMENT_COLORS: Record<(typeof ELEMENTS)[number], number> = {
  fogo: 0xe4572e,
  vento: 0x76b041,
  raio: 0xffc914,
  terra: 0xa0522d,
  agua: 0x17bebb,
};

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.3, 'PROJETO KAGE', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#f5f5f5',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.3 + 60, 'Táticas ninja em turnos', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#9aa4b2',
      })
      .setOrigin(0.5);

    // Os cinco elementos girando em círculo: um aceno ao sistema de combate.
    const ring = this.add.container(width / 2, height * 0.66);
    ELEMENTS.forEach((el, i) => {
      const angle = (i / ELEMENTS.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * 90;
      const y = Math.sin(angle) * 90;
      ring.add(this.add.circle(x, y, 18, ELEMENT_COLORS[el]));
    });
    this.tweens.add({ targets: ring, angle: 360, duration: 12000, repeat: -1 });

    const prompt = this.add
      .text(width / 2, height * 0.9, 'Em construção — Fase 0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#6b7280',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
  }
}
