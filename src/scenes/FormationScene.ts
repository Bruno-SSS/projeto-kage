import Phaser from 'phaser';
import { GRID_SIZE, MAX_TEAM_SIZE } from '../core/formation';
import type { NinjaTemplate } from '../core/types';
import { NINJAS } from '../data/ninjas';
import { Button } from '../ui/Button';
import { describeNinja } from '../ui/describe';
import { firstFreeCell, placeNinja, removeNinja, type Placement } from '../ui/formationState';
import { NinjaToken, TOKEN_RADIUS } from '../ui/NinjaToken';
import { loadFormation, ownedRoster, saveFormation } from '../ui/session';
import { COLORS, ELEMENT_LABELS, TEXT, textStyle } from '../ui/theme';

const CELL = 92;
/** x da coluna 0 (frente). As colunas seguintes vão para a esquerda. */
const GRID_FRONT_X = 390;
const GRID_TOP_Y = 150;
const TAP_THRESHOLD = 8;

interface Drag {
  id: string;
  token: NinjaToken;
  fromCell: boolean;
  startX: number;
  startY: number;
  moved: boolean;
}

export class FormationScene extends Phaser.Scene {
  private placements: Placement[] = [];
  private placedTokens: NinjaToken[] = [];
  private cards = new Map<string, Phaser.GameObjects.Container>();
  private drag?: Drag;
  private info!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private fight!: Button;

  constructor() {
    super('Formation');
  }

  create(): void {
    this.placements = loadFormation();
    this.placedTokens = [];
    this.cards.clear();
    this.drag = undefined;

    this.add.text(480, 34, 'Monte sua formação', textStyle(28, TEXT.main, true)).setOrigin(0.5);
    new Button(this, 70, 34, 100, 36, '← Voltar', () => this.scene.start('Hub'), {
      fontSize: 15,
    });

    this.drawGrid();
    this.drawRoster();

    this.add.rectangle(350, 482, 660, 84, COLORS.panel).setStrokeStyle(1, COLORS.border);
    this.info = this.add.text(32, 448, '', {
      ...textStyle(13, TEXT.muted),
      lineSpacing: 6,
      wordWrap: { width: 640 },
    });
    this.showHint();

    this.counter = this.add.text(820, 444, '', textStyle(15, TEXT.muted)).setOrigin(0.5);
    this.fight = new Button(this, 820, 488, 200, 52, 'Pronto', () => this.scene.start('Hub'), {
      fontSize: 22,
      fill: 0x3a2a12,
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDragEnd(p));

    this.render();
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    return { x: GRID_FRONT_X - col * CELL, y: GRID_TOP_Y + row * CELL };
  }

  private cellAt(x: number, y: number): { row: number; col: number } | null {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const c = this.cellCenter(row, col);
        if (Math.abs(x - c.x) <= CELL / 2 && Math.abs(y - c.y) <= CELL / 2) return { row, col };
      }
    }
    return null;
  }

  private drawGrid(): void {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x, y } = this.cellCenter(row, col);
        this.add
          .rectangle(x, y, CELL - 8, CELL - 8, COLORS.panel)
          .setStrokeStyle(1, col === 0 ? COLORS.accent : COLORS.border, col === 0 ? 0.6 : 1);
      }
    }
    const labelY = GRID_TOP_Y - CELL / 2 - 16;
    this.add
      .text(this.cellCenter(0, 2).x, labelY, 'retaguarda', textStyle(13, TEXT.muted))
      .setOrigin(0.5);
    this.add
      .text(this.cellCenter(0, 0).x, labelY, 'frente', textStyle(13, TEXT.accent))
      .setOrigin(0.5);
    this.add
      .text(GRID_FRONT_X + CELL / 2 + 10, this.cellCenter(1, 0).y, '▶\ninimigos', {
        ...textStyle(12, TEXT.teamB),
        align: 'center',
      })
      .setOrigin(0, 0.5);
  }

  private drawRoster(): void {
    this.add.text(510, 70, 'Elenco', textStyle(16, TEXT.muted, true));
    // A lista se ajusta para caber entre o título e o painel de informações.
    const roster = ownedRoster();
    const step = Math.min(66, 340 / roster.length);
    const scale = Math.min(1, (step - 6) / 58);
    roster.forEach((ninja, i) => {
      const card = this.add.container(720, 92 + step / 2 + i * step).setScale(scale);
      const bg = this.add.rectangle(0, 0, 420, 58, COLORS.panel).setStrokeStyle(1, COLORS.border);
      const token = new NinjaToken(this, -180, 0, ninja).setScale(0.75);
      const name = this.add.text(-145, -18, ninja.name, textStyle(17, TEXT.main, true));
      const { hp, atk, def, spd } = ninja.stats;
      const line = this.add.text(
        -145,
        4,
        `${ELEMENT_LABELS[ninja.element]} · VIDA ${hp} ATQ ${atk} DEF ${def} VEL ${spd}`,
        textStyle(13, TEXT.muted),
      );
      const tag = this.add
        .text(195, 0, 'no time', textStyle(12, TEXT.accent))
        .setOrigin(1, 0.5)
        .setName('tag');
      card.add([bg, token, name, line, tag]);
      this.cards.set(ninja.id, card);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.showInfo(ninja));
      bg.on('pointerout', () => !this.drag && this.showHint());
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(ninja.id, p, false));
    });
  }

  private render(): void {
    for (const t of this.placedTokens) t.destroy();
    this.placedTokens = this.placements.map(({ id, row, col }) => {
      const { x, y } = this.cellCenter(row, col);
      const token = new NinjaToken(this, x, y, NINJAS[id], {
        ring: COLORS.teamA,
      });
      const name = this.add
        .text(0, TOKEN_RADIUS + 10, token.ninja.name, textStyle(12, TEXT.main))
        .setOrigin(0.5);
      token.add(name);
      token.orb.setInteractive({ useHandCursor: true });
      token.orb.on('pointerover', () => this.showInfo(token.ninja));
      token.orb.on('pointerdown', (p: Phaser.Input.Pointer) => this.startDrag(id, p, true));
      return token;
    });

    const placedIds = new Set(this.placements.map((p) => p.id));
    for (const [id, card] of this.cards) {
      const placed = placedIds.has(id);
      card.setAlpha(placed ? 0.55 : 1);
      (card.getByName('tag') as Phaser.GameObjects.Text).setVisible(placed);
    }

    this.counter.setText(`${this.placements.length}/${MAX_TEAM_SIZE} ninjas`);
    this.fight.setEnabled(this.placements.length > 0);
    saveFormation(this.placements);
  }

  private startDrag(id: string, p: Phaser.Input.Pointer, fromCell: boolean): void {
    if (this.drag) return;
    let token: NinjaToken;
    if (fromCell) {
      token = this.placedTokens.find((t) => t.ninja.id === id)!;
    } else {
      token = new NinjaToken(this, p.x, p.y, NINJAS[id], {
        ring: COLORS.teamA,
      }).setAlpha(0);
    }
    token.setDepth(10);
    this.drag = { id, token, fromCell, startX: p.x, startY: p.y, moved: false };
    this.showInfo(token.ninja);
  }

  private onDragMove(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    if (
      !drag.moved &&
      Phaser.Math.Distance.Between(p.x, p.y, drag.startX, drag.startY) > TAP_THRESHOLD
    ) {
      drag.moved = true;
      drag.token.setAlpha(0.9).setScale(1.1);
    }
    if (drag.moved) drag.token.setPosition(p.x, p.y);
  }

  private onDragEnd(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    if (!drag.fromCell) drag.token.destroy();

    if (!drag.moved) {
      // Toque: no grid tira o ninja; no elenco adiciona na primeira casa livre.
      if (drag.fromCell) {
        this.placements = removeNinja(this.placements, drag.id);
      } else if (!this.placements.some((pl) => pl.id === drag.id)) {
        const cell = firstFreeCell(this.placements);
        const next = cell && placeNinja(this.placements, drag.id, cell.row, cell.col);
        if (next) this.placements = next;
        else this.flash(`Máximo de ${MAX_TEAM_SIZE} ninjas.`);
      }
    } else {
      const cell = this.cellAt(p.x, p.y);
      if (cell) {
        const next = placeNinja(this.placements, drag.id, cell.row, cell.col);
        if (next) this.placements = next;
        else this.flash(`Máximo de ${MAX_TEAM_SIZE} ninjas. Solte em cima de alguém para trocar.`);
      } else if (drag.fromCell) {
        this.placements = removeNinja(this.placements, drag.id);
      }
    }
    this.render();
  }

  private showInfo(ninja: NinjaTemplate): void {
    this.info.setColor(TEXT.main).setText(describeNinja(ninja));
  }

  private showHint(): void {
    this.info
      .setColor(TEXT.muted)
      .setText([
        'Arraste ninjas do elenco para o grid, ou toque para adicionar.',
        'Toque num ninja do grid para tirá-lo. A coluna da frente apanha primeiro.',
        'Combos: um golpe derruba, lança ao ar ou repele; aliados com a perseguição certa continuam.',
      ]);
  }

  private flash(message: string): void {
    this.info.setColor(TEXT.teamB).setText(message);
    this.time.delayedCall(1800, () => !this.drag && this.showHint());
  }
}
