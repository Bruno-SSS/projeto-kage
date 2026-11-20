import Phaser from 'phaser';
import { completeMission, type Grant } from '../core/progression';
import { completeStage } from '../core/story';
import { HISTORIA } from '../data/historia';
import { NINJAS, ROSTER } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { fmt } from '../ui/header';
import { updateSave } from '../ui/session';
import { TEXT, textStyle } from '../ui/theme';
import type { BattleResult } from './BattleScene';

const TITLES = {
  A: { text: 'Vitória!', color: TEXT.accent },
  B: { text: 'Derrota', color: TEXT.teamB },
  draw: { text: 'Empate', color: TEXT.muted },
};

/** Lista legível do que uma concessão deu. */
function describeGrant(g: Grant): string[] {
  const lines = [`+${fmt(g.xp ?? 0)} XP · +${fmt(g.ryo ?? 0)} ryo`];
  if (g.pergaminho) lines.push(`+${g.pergaminho} pergaminho(s)`);
  if (g.cupom) lines.push(`+${g.cupom} cupons`);
  for (const f of g.fragments ?? []) {
    lines.push(`+${f.amount} fragmento(s) de ${NINJAS[f.ninjaId]?.name ?? f.ninjaId}`);
  }
  for (const [id, n] of Object.entries(g.food ?? {})) {
    lines.push(`+${n} ${PROGRESSAO.ninjas.comida[id]?.nome ?? id}`);
  }
  if (g.teamXp?.ids.length) lines.push(`Ninjas do time: +${fmt(g.teamXp.amount)} XP cada`);
  return lines;
}

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
    const back = data.returnTo ?? 'Hub';

    const heading = this.add
      .text(480, 130, title.text, textStyle(64, title.color, true))
      .setOrigin(0.5)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({ targets: heading, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });

    this.add
      .text(
        480,
        200,
        `${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'} · maior combo: ${bestCombo > 0 ? `x${bestCombo}` : 'nenhum'}`,
        textStyle(20, TEXT.muted),
      )
      .setOrigin(0.5);

    const lines = data.missionId
      ? this.settleMission(data.missionId, outcome === 'A')
      : data.stageId
        ? this.settleStage(data.stageId, outcome === 'A')
        : ['Treino: sem recompensa.'];
    this.add
      .text(480, 270, lines, { ...textStyle(17, TEXT.main), align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0);

    const canRetry = !(data.missionId && outcome === 'A');
    if (canRetry) {
      new Button(this, 340, 460, 240, 52, 'Lutar de novo', () => this.scene.start('Battle', data), {
        fontSize: 18,
      });
    }
    new Button(
      this,
      canRetry ? 620 : 480,
      460,
      240,
      52,
      'Continuar',
      () => this.scene.start(back),
      {
        fontSize: 18,
      },
    );
  }

  /** Paga a fase da história (só na vitória) e descreve estrelas e prêmios. */
  private settleStage(stageId: string, won: boolean): string[] {
    if (!won) return ['Fase não vencida. A energia foi devolvida.'];
    let lines: string[] = [];
    try {
      updateSave((s) => {
        const r = completeStage(
          s.player,
          stageId,
          true,
          this.result.deaths,
          new Date(),
          HISTORIA,
          PROGRESSAO,
          this.result.data.teamA.map((slot) => slot.ninja.id),
        );
        lines = [
          `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  (${this.result.deaths} ninja(s) caído(s))`,
          ...describeGrant(r.reward),
        ];
        if (r.firstClear) lines.push('Primeira vitória nesta fase!');
        if (r.chapterCompleted) lines.push('Capítulo concluído!');
        if (r.chapterPerfect) lines.push('Capítulo com 3★ em todas as fases!');
        if (r.levelUps.length > 0)
          lines.push(`Subiu para o nível ${r.levelUps[r.levelUps.length - 1]}!`);
        return { ...s, player: r.state };
      });
    } catch (e) {
      return [`Recompensa não paga: ${(e as Error).message}`];
    }
    return lines;
  }

  /** Paga a missão (só na vitória) e descreve o que o jogador ganhou. */
  private settleMission(missionId: string, won: boolean): string[] {
    if (!won) return ['Missão não concluída. Ajuste a formação e tente de novo.'];
    let reward: Grant = {};
    let levelUps: number[] = [];
    try {
      updateSave((s) => {
        const r = completeMission(
          s.player,
          missionId,
          true,
          new Date(),
          PROGRESSAO,
          ROSTER,
          Math.random,
          this.result.data.teamA.map((slot) => slot.ninja.id),
        );
        reward = r.reward;
        levelUps = r.levelUps;
        return { ...s, player: r.state };
      });
    } catch (e) {
      return [`Recompensa não paga: ${(e as Error).message}`];
    }
    const lines = [`Missão concluída: +${fmt(reward.xp ?? 0)} XP · +${fmt(reward.ryo ?? 0)} ryo`];
    for (const f of reward.fragments ?? []) {
      lines.push(`+${f.amount} fragmento(s) de ${NINJAS[f.ninjaId]?.name ?? f.ninjaId}`);
    }
    for (const [id, n] of Object.entries(reward.food ?? {})) {
      lines.push(`+${n} ${PROGRESSAO.ninjas.comida[id]?.nome ?? id}`);
    }
    if (reward.teamXp?.ids.length)
      lines.push(`Ninjas do time: +${fmt(reward.teamXp.amount)} XP cada`);
    if (levelUps.length > 0) lines.push(`Subiu para o nível ${levelUps[levelUps.length - 1]}!`);
    return lines;
  }
}
