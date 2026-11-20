import Phaser from 'phaser';
import {
  chapterBlocker,
  currentStamina,
  minutesToNextStamina,
  stageBlocker,
  stageEnemies,
} from '../core/story';
import { HISTORIA as sc } from '../data/historia';
import { NINJAS } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { getSave, loadFormation, playerTeam, tick } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

/** Modo história: capítulos à esquerda, fases do capítulo escolhido à direita. */
export class StoryScene extends Phaser.Scene {
  private chapterIndex = 0;

  constructor() {
    super('Story');
  }

  init(data: { chapter?: number }): void {
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
      const enemies = stageEnemies(stage, NINJAS, PROGRESSAO);
      const first = stars === 0 && stage.primeiraVez ? ' · prêmio de 1ª vitória' : '';
      this.add.text(
        312,
        y + 2,
        `Nível ${stage.nivelInimigo} · ${enemies.map((e) => e.ninja.name).join(', ')}${first}`,
        textStyle(12, TEXT.muted),
      );
      this.add
        .text(780, y, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(18, TEXT.good))
        .setOrigin(0.5);

      const blocker = stageBlocker(player, stage.id, now, sc);
      if (blocker || !hasTeam) {
        this.add
          .text(
            870,
            y,
            blocker?.startsWith('Energia') ? 'Sem energia' : !hasTeam ? 'Sem time' : 'Fechada',
            textStyle(13, TEXT.teamB),
          )
          .setOrigin(0.5);
      } else {
        new Button(this, 870, y, 100, 40, 'Lutar', () =>
          this.scene.start('Battle', {
            teamA: playerTeam(),
            teamB: enemies,
            stageId: stage.id,
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
}
