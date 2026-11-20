import Phaser from 'phaser';
import { greedyAI } from '../core/ai';
import { Battle } from '../core/battle';
import type { Action, BattleEvent, FormationSlot, TeamId, Unit } from '../core/types';
import { Button } from '../ui/Button';
import { describeSkill } from '../ui/describe';
import { Arena3D } from '../render3d/Arena3D';
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
const CHAKRA_BAR_W = 220;
const HP_W = 64;

/** Nome e barra de vida de um ninja, desenhados por cima do modelo 3D. */
interface UnitHud {
  container: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
}

interface Settings {
  fast: boolean;
  auto: boolean;
}

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private data_!: BattleData;
  private arena!: Arena3D;
  private huds = new Map<string, UnitHud>();
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
    this.huds = new Map();
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

    // A batalha é desenhada em 3D atrás do canvas do Phaser, que só mostra o HUD.
    this.arena = Arena3D.get();
    this.arena.speed = this.speed;
    for (const unit of this.battle.units) {
      this.arena.addUnit(unit.uid, unit.template, unit.team, unit.position.row, unit.position.col);
      this.huds.set(unit.uid, this.createUnitHud(unit));
    }
    this.arena.show(this.game.canvas);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.arena.hide());

    this.drawHud();
    this.drawPanel();
    void this.run();
  }

  update(): void {
    for (const [uid, hud] of this.huds) {
      const { x, y } = this.arena.screenPos(uid);
      hud.container.setPosition(x, y);
    }
  }

  private createUnitHud(unit: Unit): UnitHud {
    const color = unit.team === 'A' ? TEXT.teamA : TEXT.teamB;
    const name = this.add
      .text(0, -12, unit.template.name, textStyle(13, color, true))
      .setOrigin(0.5)
      .setStroke('#000000', 3);
    const bg = this.add.rectangle(0, 4, HP_W, 7, 0x000000, 0.6);
    const hpFill = this.add.rectangle(-HP_W / 2, 4, HP_W, 7, COLORS.hp).setOrigin(0, 0.5);
    const container = this.add.container(0, 0, [name, bg, hpFill]).setDepth(10);
    return { container, hpFill };
  }

  private setHp(uid: string, hp: number, maxHp: number): void {
    const { hpFill } = this.huds.get(uid)!;
    const ratio = Math.max(0, hp / maxHp);
    this.tweens.add({ targets: hpFill, width: HP_W * ratio, duration: 250 });
    hpFill.setFillStyle(ratio < 0.3 ? COLORS.hpLow : COLORS.hp);
  }

  /** Posição do ninja na tela, com deslocamento vertical. */
  private at(uid: string, dy = 0): { x: number; y: number } {
    const p = this.arena.screenPos(uid);
    return { x: p.x, y: p.y + dy };
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
    this.arena.speed = this.speed;
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

  private async playEvent(e: BattleEvent): Promise<void> {
    switch (e.type) {
      case 'round_start': {
        this.roundText.setText(`Rodada ${e.round}`);
        this.updateChakra();
        this.arena.highlight(null);
        await this.banner(`Rodada ${e.round}`);
        break;
      }
      case 'turn_start': {
        this.arena.highlight(e.actor);
        this.skillText.setText('');
        await this.wait(120);
        break;
      }
      case 'skip': {
        this.arena.setStunned(e.actor, false);
        const p = this.at(e.actor, -18);
        this.floatText(p.x, p.y, 'Atordoado: perde a vez', TEXT.muted, 14);
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
        await this.arena.lunge(e.actor, e.targets);
        break;
      }
      case 'chakra':
        this.updateChakra();
        break;
      case 'damage': {
        const unit = this.battle.unit(e.target);
        this.setHp(e.target, e.hpAfter, unit.maxHp);
        const color =
          e.elementMultiplier > 1 ? TEXT.good : e.elementMultiplier < 1 ? TEXT.bad : TEXT.main;
        const label = e.elementMultiplier > 1 ? `${e.amount}!` : `${e.amount}`;
        const p = this.at(e.target, -26);
        this.floatText(p.x, p.y, label, color, e.elementMultiplier > 1 ? 26 : 22);
        await this.arena.hit(e.target);
        break;
      }
      case 'status': {
        if (e.status === 'atordoado') this.arena.setStunned(e.target, true);
        const p = this.at(e.target, 40);
        this.floatText(p.x, p.y, STATUS_LABELS[e.status], TEXT.accent, 15);
        if (e.status === 'no_ar') await this.arena.air(e.target);
        else if (e.status === 'derrubado') await this.arena.knockdown(e.target);
        else if (e.status === 'repelido') await this.arena.pushed(e.target);
        else await this.wait(150);
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
      case 'death': {
        const hud = this.huds.get(e.unit)!;
        this.tweens.add({ targets: hud.container, alpha: 0.25, duration: 300 });
        await this.arena.die(e.unit);
        break;
      }
      case 'battle_end':
        break;
    }
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
