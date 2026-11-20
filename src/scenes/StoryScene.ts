import Phaser from 'phaser';
import {
  challengeBlocker,
  challengeEnemies,
  chapterBlocker,
  currentStamina,
  minutesToNextStamina,
  stageBlocker,
  stageEnemies,
  sweepBlocker,
  sweepStage,
} from '../core/story';
import { HISTORIA as sc } from '../data/historia';
import { NINJAS } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { getSave, loadFormation, playerTeam, tick, updateSave } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

/** Modo história: capítulos à esquerda, fases do capítulo escolhido à direita. */
export class StoryScene extends Phaser.Scene {
  private chapterIndex = 0;
  private message = '';

  constructor() {
    super('Story');
  }

  init(data: { chapter?: number; message?: string }): void {
    this.message = data.message ?? '';
    const { player } = getSave();
    // abre no último capítulo liberado, a menos que outro tenha sido escolhido
    const unlocked = sc.capitulos.filter((c) => chapterBlocker(player, c.id, sc) === null);
    this.chapterIndex = data.chapter ?? Math.max(0, unlocked.length - 1);
  }

  create(): void {
    tick();
    drawHeader(this, 'História', 'Hub');
    const { player } = getSave();
    const now = new Date();
    const energy = currentStamina(player, now, sc);
    const next = minutesToNextStamina(player, now, sc);
    this.add.text(
      24,
      70,
      `Energia ${energy}/${sc.energia.tetoRegen}${next !== null ? ` (+1 em ${next} min)` : ''} · cada fase custa ${sc.energia.custoFase} (devolvida se perder)`,
      textStyle(14, TEXT.muted),
    );

    if (this.message) this.add.text(24, 482, this.message, textStyle(14, TEXT.accent, true));

    sc.capitulos.forEach((c, i) => {
      const blocked = chapterBlocker(player, c.id, sc);
      const stars = c.fases.reduce((t, f) => t + (player.story.stars[f.id] ?? 0), 0);
      const label = `Cap. ${i + 1}: ${c.nome}\n${blocked ?? `${stars}/${c.fases.length * 3} ★`}`;
      const btn = new Button(
        this,
        150,
        130 + i * 70,
        260,
        60,
        label,
        () => this.scene.restart({ chapter: i }),
        {
          fontSize: 14,
          stroke: i === this.chapterIndex ? COLORS.accent : COLORS.border,
        },
      );
      if (blocked) btn.setAlpha(0.5);
    });

    const chapter = sc.capitulos[this.chapterIndex];
    this.add.text(300, 100, chapter.texto, {
      ...textStyle(14, TEXT.main),
      wordWrap: { width: 630 },
    });

    const hasTeam = loadFormation().length > 0;
    chapter.fases.forEach((stage, i) => {
      const y = 190 + i * 64;
      const stars = player.story.stars[stage.id] ?? 0;
      this.add
        .rectangle(615, y, 630, 56, COLORS.panel)
        .setStrokeStyle(1, stage.chefe ? COLORS.accent : COLORS.border);
      this.add.text(
        312,
        y - 20,
        `${i + 1}. ${stage.nome}`,
        textStyle(15, stage.chefe ? TEXT.accent : TEXT.main, true),
      );
      const goal = stageEnemies(stage, NINJAS, PROGRESSAO);
      const first = stars === 0 && stage.primeiraVez ? ' · prêmio de 1ª vitória' : '';
      const challengeDone = player.story.challenges.includes(stage.id) ? ' · desafio ✓' : '';
      this.add.text(
        312,
        y + 2,
        `Nível ${stage.nivelInimigo} · ${stage.lutas.length} lutas · objetivo: ${goal.map((e) => e.ninja.name).join(', ')}${first}${challengeDone}`,
        textStyle(11, TEXT.muted),
      );
      this.add
        .text(612, y - 18, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(16, TEXT.good))
        .setOrigin(0.5);

      const team = () => playerTeam();
      // Desafio (opcional, sem energia)
      if (stage.desafio && hasTeam && challengeBlocker(player, stage.id, sc) === null) {
        new Button(
          this,
          690,
          y,
          76,
          36,
          'Desafio',
          () =>
            this.scene.start('Battle', {
              teamA: team(),
              teamB: challengeEnemies(stage, NINJAS, PROGRESSAO),
              stageId: stage.id,
              challenge: true,
              maxRounds: sc.limiteRodadas,
              returnTo: 'Story',
            }),
          { fontSize: 12, fill: 0x2a2350, stroke: COLORS.chakra },
        );
      }
      // Varredura (com 3★)
      if (stars === 3) {
        const max = sc.varredura.maxPorVez;
        new Button(this, 772, y, 76, 36, `Varrer ${max}x`, () => this.sweep(stage.id, max), {
          fontSize: 12,
        }).setEnabled(sweepBlocker(player, stage.id, max, now, sc) === null);
      }

      const blocker = stageBlocker(player, stage.id, now, sc);
      if (blocker || !hasTeam) {
        this.add
          .text(
            870,
            y,
            blocker?.startsWith('Energia')
              ? 'Sem energia'
              : blocker?.startsWith('Requer')
                ? blocker.replace('Requer ', '')
                : !hasTeam
                  ? 'Sem time'
                  : 'Fechada',
            textStyle(12, TEXT.teamB),
          )
          .setOrigin(0.5);
      } else {
        new Button(this, 870, y, 90, 40, 'Lutar', () =>
          this.scene.start('Battle', {
            teamA: team(),
            teamB: stageEnemies(stage, NINJAS, PROGRESSAO, 0),
            stageId: stage.id,
            wave: 0,
            deathsSoFar: 0,
            maxRounds: sc.limiteRodadas,
            returnTo: 'Story',
          }),
        );
      }
    });

    const c = chapter;
    const prize = [
      c.conclusao.ryo && `${fmt(c.conclusao.ryo)} ryo`,
      c.conclusao.pergaminho && `${c.conclusao.pergaminho} pergaminhos`,
      ...Object.entries(c.conclusao.fragmentos ?? {}).map(
        ([id, n]) => `${n} fragmentos de ${NINJAS[id]?.name ?? id}`,
      ),
    ]
      .filter(Boolean)
      .join(', ');
    this.add.text(
      300,
      510,
      `Concluir o capítulo: ${prize}. Tudo com 3★: ${c.bonus3Estrelas.cupom ?? 0} cupons.`,
      textStyle(13, TEXT.muted),
    );
  }

  /** Varre a fase N vezes com o time atual e mostra o que rendeu. */
  private sweep(stageId: string, times: number): void {
    let message = '';
    updateSave((save) => {
      const ids = loadFormation().map((p) => p.id);
      const r = sweepStage(save.player, stageId, times, new Date(), sc, PROGRESSAO, ids);
      message = `Varredura ${times}x: +${fmt(r.reward.xp ?? 0)} XP, +${fmt(r.reward.ryo ?? 0)} ryo${r.levelUps.length ? `, nível ${r.levelUps.at(-1)}!` : ''}`;
      return { ...save, player: r.state };
    });
    this.scene.restart({ chapter: this.chapterIndex, message });
  }
}
