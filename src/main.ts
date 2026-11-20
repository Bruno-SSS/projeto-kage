import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { FormationScene } from './scenes/FormationScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { COLORS, HEIGHT, WIDTH } from './ui/theme';
import './style.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT,
  },
  scene: [TitleScene, FormationScene, BattleScene, ResultScene],
});

// Atalho para depuração no console do navegador.
(window as unknown as { game: Phaser.Game }).game = game;
