import type Phaser from 'phaser';
import { xpToNext } from '../core/progression';
import { currentStamina } from '../core/story';
import { HISTORIA } from '../data/historia';
import { PROGRESSAO } from '../data/progressao';
import { Button } from './Button';
import { getSave } from './session';
import { COLORS, TEXT, textStyle } from './theme';

/** Cabeçalho comum: título, botão voltar (opcional), nível/XP e carteira. */
export function drawHeader(scene: Phaser.Scene, title: string, backTo?: string): void {
  const { player } = getSave();
  if (backTo) {
    new Button(scene, 62, 30, 96, 34, '← Voltar', () => scene.scene.start(backTo), {
      fontSize: 14,
    });
  }
  scene.add.text(backTo ? 124 : 24, 16, title, textStyle(24, TEXT.main, true));

  const need = xpToNext(player.level, PROGRESSAO);
  const maxed = player.level >= PROGRESSAO.nivel.maximo;
  scene.add
    .text(936, 10, `Nível ${player.level}`, textStyle(16, TEXT.accent, true))
    .setOrigin(1, 0);
  scene.add.rectangle(936, 38, 200, 8, 0x000000, 0.5).setOrigin(1, 0.5);
  scene.add
    .rectangle(736, 38, maxed ? 200 : (200 * player.xp) / need, 8, COLORS.chakra)
    .setOrigin(0, 0.5);
  scene.add
    .text(730, 31, maxed ? 'máx.' : `${fmt(player.xp)}/${fmt(need)} XP`, textStyle(12, TEXT.muted))
    .setOrigin(1, 0);
  const w = player.wallet;
  scene.add
    .text(
      936,
      50,
      `Energia ${currentStamina(player, new Date(), HISTORIA)} · Ryo ${fmt(w.ryo)} · Cupons ${fmt(w.cupom)} · Pergaminhos ${fmt(w.pergaminho)}`,
      textStyle(13, TEXT.muted),
    )
    .setOrigin(1, 0);
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('pt-BR');
}
