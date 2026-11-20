import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { DailyScene } from './scenes/DailyScene';
import { FormationScene } from './scenes/FormationScene';
import { HubScene } from './scenes/HubScene';
import { MissionsScene } from './scenes/MissionsScene';
import { NinjasScene } from './scenes/NinjasScene';
import { RecruitScene } from './scenes/RecruitScene';
import { StoryScene } from './scenes/StoryScene';
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
  scene: [
    TitleScene,
    HubScene,
    FormationScene,
    StoryScene,
    MissionsScene,
    NinjasScene,
    DailyScene,
    RecruitScene,
    BattleScene,
    ResultScene,
  ],
});

// Atalho para depuração no console do navegador.
(window as unknown as { game: Phaser.Game }).game = game;
