import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import './style.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0f1420',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  scene: [TitleScene],
});
