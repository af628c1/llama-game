// Game entry point: configures Phaser and registers the scenes. Boot generates the
// placeholder art, then hands off to the Ranch world.

import BootScene from './scenes/BootScene.js';
import RanchScene from './scenes/RanchScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b2b1a',
  pixelArt: true, // keep generated pixel textures crisp when scaled
  scale: {
    mode: Phaser.Scale.RESIZE, // fill the window; camera bounds keep the world framed
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // top-down: no gravity
      debug: false,
    },
  },
  scene: [BootScene, RanchScene],
};

// Expose the game instance for debugging in the browser console.
window.game = new Phaser.Game(config);
