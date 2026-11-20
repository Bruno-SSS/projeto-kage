import Phaser from 'phaser';
import { greedyAI } from '../core/ai';
import { Battle } from '../core/battle';
import type { Action, BattleEvent, FormationSlot, TeamId, Unit } from '../core/types';
import { Button } from '../ui/Button';
import { describeSkill } from '../ui/describe';
import { NinjaToken } from '../ui/NinjaToken';
import { loadJSON, saveJSON } from '../ui/storage';
import { COLORS, STATUS_LABELS, TEXT, textStyle } from '../ui/theme';

export interface BattleData {
  teamA: FormationSlot[];
  teamB: FormationSlot[];
  /** Missão do quadro que esta luta resolve (paga recompensa se vencer). */
  missionId?: string;
  /** Fase da história que esta luta resolve. */
  stageId?: string;
  /** Luta da fase (0 = primeira). */
  wave?: number;
  /** Baixas somadas nas lutas anteriores da fase. */
  deathsSoFar?: number;
  /** Esta luta é o desafio opcional da fase. */
  challenge?: boolean;
  /** Limite de rodadas (empate = derrota). */
  maxRounds?: number;
  /** Cena para onde voltar depois do resultado. */
  returnTo?: string;
}

export interface BattleResult {
  outcome: Battle['outcome'];
  rounds: number;
  bestCombo: number;
  /** Ninjas do jogador caídos no fim da luta. */
  deaths: number;
  data: BattleData;
}

const SETTINGS_KEY = 'kage.battle';
const CELL = 96;
const GRID_TOP_Y = 165;
/** x da coluna da frente de cada time; as demais se afastam do centro. */
const FRONT_X: Record<TeamId, number> = { A: 380, B: 580 };
const CHAKRA_BAR_W = 220;

interface Settings {
  fast: boolean;
  auto: boolean;
}

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private data_!: BattleData;
  private tokens = new Map<string, NinjaToken>();
  private settings: Settings = { fast: false, auto: false };
  private bestCombo = 0;

  private roundText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboFade?: Phaser.Time.TimerEvent;
  private chakraFill!: Record<TeamId, Phaser.GameObjects.Rectangle>;
  private chakraLabel!: Record<TeamId, Phaser.GameObjects.Text>;

  private panel!: Phaser.GameObjects.Container;
  private basicBtn!: Button;
  private specialBtn!: Button;
  private panelTitle!: Phaser.GameObjects.Text;
  private autoBtn!: Button;
  private speedBtn!: Button;
  private pendingChoice?: (action: Action) => void;

  constructor() {
    super('Battle');
  }

  init(data: BattleData): void {
    this.data_ = data;
    this.tokens = new Map();
    this.bestCombo = 0;
    this.pendingChoice = undefined;
    this.settings = loadJSON<Settings>(SETTINGS_KEY, { fast: false, auto: false });
  }

  create(): void {
    this.battle = new Battle(
      this.data_.teamA,
      this.data_.teamB,
      this.data_.maxRounds ? { maxRounds: this.data_.maxRounds } : undefined,
    );

    this.drawField();
    this.drawHud();
    this.drawPanel();
    for (const unit of this.battle.units) {
      const { x, y } = this.unitPosition(unit);
      const token = new NinjaToken(this, x, y, unit.template, {
        ring: unit.team === 'A' ? COLORS.teamA : COLORS.teamB,
        showHp: true,
      });
      this.tokens.set(unit.uid, token);
    }

    void this.run();
  }

  // ---------------------------------------------------------------- layout

  private unitPosition(unit: Unit): { x: number; y: number } {
    const dir = unit.team === 'A' ? -1 : 1;
    return {
      x: FRONT_X[unit.team] + dir * unit.position.col * CELL,
      y: GRID_TOP_Y + unit.position.row * CELL,
    };
  }

  private drawField(): void {
    for (const team of ['A', 'B'] as const) {
      const dir = team === 'A' ? -1 : 1;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          this.add
            .rectangle(
              FRONT_X[team] + dir * col * CELL,
              GRID_TOP_Y + row * CELL,
              CELL - 10,
              CELL - 10,
            )
            .setStrokeStyle(1, COLORS.border, 0.35);
        }
      }
    }
    this.add.rectangle(480, GRID_TOP_Y + CELL, 2, CELL * 3, COLORS.border, 0.4);
  }

  private drawHud(): void {
    this.chakraFill = {} as Record<TeamId, Phaser.GameObjects.Rectangle>;
    this.chakraLabel = {} as Record<TeamId, Phaser.GameObjects.Text>;
    for (const team of ['A', 'B'] as const) {
      const left = team === 'A' ? 24 : 960 - 24 - CHAKRA_BAR_W;
      this.add
        .text(left, 14, team === 'A' ? 'Seu time' : 'Inimigos', {
          ...textStyle(14, team === 'A' ? TEXT.teamA : TEXT.teamB, true),
        })
        .setOrigin(0, 0);
      this.add.rectangle(left, 44, CHAKRA_BAR_W, 12, 0x000000, 0.5).setOrigin(0, 0.5);
      this.chakraFill[team] = this.add.rectangle(left, 44, 0, 12, COLORS.chakra).setOrigin(0, 0.5);
      this.chakraLabel[team] = this.add
        .text(left + CHAKRA_BAR_W, 14, '', textStyle(13, TEXT.muted))
        .setOrigin(1, 0);
    }
    this.updateChakra();

    this.roundText = this.add.text(480, 22, '', textStyle(18, TEXT.main, true)).setOrigin(0.5);
    this.skillText = this.add.text(480, 66, '', textStyle(17, TEXT.main, true)).setOrigin(0.5);
    this.comboText = this.add
      .text(480, 108, '', textStyle(30, TEXT.accent, true))
      .setOrigin(0.5)
      .setStroke('#000000', 5)
      .setDepth(20);

    this.autoBtn = new Button(this, 905, 470, 90, 34, '', () => this.toggleAuto(), {
      fontSize: 14,
    });
    this.speedBtn = new Button(this, 905, 512, 90, 34, '', () => this.toggleSpeed(), {
      fontSize: 14,
    });
    this.refreshToggles();
  }

  private drawPanel(): void {
    this.panel = this.add.container(0, 0).setVisible(false);
    this.panelTitle = this.add.text(480, 448, '', textStyle(14, TEXT.muted)).setOrigin(0.5);
    this.basicBtn = new Button(this, 290, 494, 320, 56, '', () => this.choose({ type: 'basic' }), {
      fontSize: 14,
    });
    this.specialBtn = new Button(
      this,
      650,
      494,
      360,
      56,
      '',
      () => this.choose({ type: 'special' }),
      { fontSize: 14, fill: 0x2a2350, stroke: COLORS.chakra },
    );
    this.panel.add([this.panelTitle, this.basicBtn, this.specialBtn]);

    this.input.keyboard?.on('keydown-ONE', () => this.choose({ type: 'basic' }));
    this.input.keyboard?.on('keydown-TWO', () => {
      if (this.battle.actor && this.battle.canUseSpecial(this.battle.actor)) {
        this.choose({ type: 'special' });
      }
    });
  }

  // ----------------------------------------------------------- game loop

  private async run(): Promise<void> {
    const battle = this.battle;
    while (!battle.outcome) {
      await this.play(battle.nextTurn());
      if (battle.outcome || !battle.actor) break;
      const actor = battle.actor;
      let action: Action;
      if (actor.team === 'A' && !this.settings.auto) {
        action = await this.askPlayer(actor);
      } else {
        await this.wait(250);
        action = greedyAI(battle, actor);
      }
      if (!this.scene.isActive()) return;
      await this.play(battle.act(action));
    }
    await this.wait(900);
    const result: BattleResult = {
      outcome: battle.outcome,
      rounds: battle.round,
      bestCombo: this.bestCombo,
      deaths: battle.units.filter((u) => u.team === 'A' && u.hp <= 0).length,
      data: this.data_,
    };
    this.scene.start('Result', result);
  }

  private askPlayer(actor: Unit): Promise<Action> {
    const { basic, special } = actor.template;
    this.panelTitle.setText(`Vez de ${actor.template.name}. Escolha o golpe (teclas 1 e 2)`);
    this.basicBtn.setText(`1 · Básico\n${describeSkill(basic)}`);
    this.specialBtn.setText(`2 · Especial\n${describeSkill(special)}`);
    this.specialBtn.setEnabled(this.battle.canUseSpecial(actor));
    this.panel.setVisible(true);
    return new Promise((resolve) => {
      this.pendingChoice = resolve;
    });
  }

  private choose(action: Action): void {
    const resolve = this.pendingChoice;
    if (!resolve) return;
    this.pendingChoice = undefined;
    this.panel.setVisible(false);
    resolve(action);
  }

  private toggleAuto(): void {
    this.settings.auto = !this.settings.auto;
    saveJSON(SETTINGS_KEY, this.settings);
    this.refreshToggles();
    if (this.settings.auto && this.pendingChoice && this.battle.actor) {
      this.choose(greedyAI(this.battle, this.battle.actor));
    }
  }

  private toggleSpeed(): void {
    this.settings.fast = !this.settings.fast;
    saveJSON(SETTINGS_KEY, this.settings);
    this.refreshToggles();
  }

  private refreshToggles(): void {
    this.autoBtn.setText(this.settings.auto ? 'Auto: ON' : 'Auto: OFF');
    this.speedBtn.setText(this.settings.fast ? 'Vel: 2x' : 'Vel: 1x');
  }

  // ------------------------------------------------------------ animation

  private get speed(): number {
    return this.settings.fast ? 2 : 1;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms / this.speed, () => resolve()));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        ...config,
        duration: (config.duration ?? 200) / this.speed,
        onComplete: () => resolve(),
      });
    });
  }

  private async play(events: BattleEvent[]): Promise<void> {
    for (const e of events) await this.playEvent(e);
  }

  private token(uid: string): NinjaToken {
    return this.tokens.get(uid)!;
  }

  private async playEvent(e: BattleEvent): Promise<void> {
    switch (e.type) {
      case 'round_start': {
        this.roundText.setText(`Rodada ${e.round}`);
        this.updateChakra();
        for (const t of this.tokens.values()) t.setHighlighted(false);
        await this.banner(`Rodada ${e.round}`);
        break;
      }
      case 'turn_start': {
        for (const t of this.tokens.values()) t.setHighlighted(false);
        this.token(e.actor).setHighlighted(true);
        this.skillText.setText('');
        await this.wait(120);
        break;
      }
      case 'skip': {
        const t = this.token(e.actor);
        t.setStunned(false);
        this.floatText(t.x, t.y - 40, 'Atordoado: perde a vez', TEXT.muted, 14);
        await this.wait(550);
        break;
      }
      case 'skill': {
        const actor = this.battle.unit(e.actor);
        const { basic, special, chase } = actor.template;
        const skill = [basic, special, chase].find((s) => s?.id === e.skillId);
        const prefix =
          e.kind === 'chase' ? 'Perseguição · ' : e.kind === 'special' ? 'Especial · ' : '';
        this.skillText
          .setText(`${actor.template.name}: ${prefix}${skill?.name ?? ''}`)
          .setColor(
            e.kind === 'chase' ? TEXT.accent : actor.team === 'A' ? TEXT.teamA : TEXT.teamB,
          );
        await this.lunge(
          this.token(e.actor),
          e.targets.map((uid) => this.token(uid)),
        );
        break;
      }
      case 'chakra':
        this.updateChakra();
        break;
      case 'damage': {
        const target = this.token(e.target);
        const unit = this.battle.unit(e.target);
        target.setHp(e.hpAfter, unit.maxHp);
        const color =
          e.elementMultiplier > 1 ? TEXT.good : e.elementMultiplier < 1 ? TEXT.bad : TEXT.main;
        const label = e.elementMultiplier > 1 ? `${e.amount}!` : `${e.amount}`;
        this.floatText(target.x, target.y - 30, label, color, e.elementMultiplier > 1 ? 26 : 22);
        await this.tween({ targets: target.orb, scale: 1.18, duration: 90, yoyo: true });
        await this.wait(120);
        break;
      }
      case 'status': {
        const t = this.token(e.target);
        if (e.status === 'atordoado') t.setStunned(true);
        this.floatText(t.x, t.y + 6, STATUS_LABELS[e.status], TEXT.accent, 15);
        if (e.status === 'no_ar') {
          await this.tween({ targets: t, y: t.y - 22, duration: 160, yoyo: true });
        } else if (e.status === 'repelido' || e.status === 'derrubado') {
          const dir = this.battle.unit(e.target).team === 'A' ? -1 : 1;
          await this.tween({ targets: t, x: t.x + dir * 14, duration: 110, yoyo: true });
        } else {
          await this.wait(150);
        }
        break;
      }
      case 'combo': {
        this.bestCombo = Math.max(this.bestCombo, e.count);
        this.comboText.setText(`COMBO x${e.count}`).setAlpha(1).setScale(1.5);
        this.tweens.add({ targets: this.comboText, scale: 1, duration: 200 / this.speed });
        this.comboFade?.remove();
        this.comboFade = this.time.delayedCall(1200 / this.speed, () =>
          this.tweens.add({ targets: this.comboText, alpha: 0, duration: 300 }),
        );
        await this.wait(150);
        break;
      }
      case 'death':
        this.token(e.unit).die();
        await this.wait(300);
        break;
      case 'battle_end':
        break;
    }
  }

  private async lunge(actor: NinjaToken, targets: NinjaToken[]): Promise<void> {
    if (targets.length === 0) return;
    const tx = targets.reduce((s, t) => s + t.x, 0) / targets.length;
    const ty = targets.reduce((s, t) => s + t.y, 0) / targets.length;
    const home = { x: actor.x, y: actor.y };
    actor.setDepth(5);
    await this.tween({
      targets: actor,
      x: home.x + (tx - home.x) * 0.35,
      y: home.y + (ty - home.y) * 0.35,
      duration: 140,
      ease: 'Quad.easeIn',
    });
    void this.tween({ targets: actor, x: home.x, y: home.y, duration: 180, ease: 'Quad.easeOut' });
    actor.setDepth(0);
  }

  private floatText(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, textStyle(size, color, true))
      .setOrigin(0.5)
      .setStroke('#000000', 4)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      delay: 350 / this.speed,
      duration: 650 / this.speed,
      onComplete: () => t.destroy(),
    });
  }

  private async banner(text: string): Promise<void> {
    const b = this.add
      .text(480, 270, text, textStyle(44, TEXT.main, true))
      .setOrigin(0.5)
      .setStroke('#000000', 6)
      .setDepth(40)
      .setAlpha(0);
    await this.tween({ targets: b, alpha: 1, duration: 180 });
    await this.wait(380);
    await this.tween({ targets: b, alpha: 0, duration: 200 });
    b.destroy();
  }

  private updateChakra(): void {
    const max = this.battle.options.maxChakra;
    for (const team of ['A', 'B'] as const) {
      const value = this.battle.chakra[team];
      this.tweens.add({
        targets: this.chakraFill[team],
        width: (CHAKRA_BAR_W * value) / max,
        duration: 250,
      });
      this.chakraLabel[team].setText(`Chakra ${value}/${max}`);
    }
  }
}
