// Game entry point: configures Phaser and registers the scenes. Boot loads the art, then
// hands off to the Ranch world (which runs the HUD alongside it).

import BootScene from './scenes/BootScene.js';
import RanchScene from './scenes/RanchScene.js';
import HudScene from './scenes/HudScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b2b1a',
  pixelArt: true, // nearest-neighbor everywhere: the art must never be smoothed
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
      // Add ?debug to the URL to draw collision boxes (handy when tuning buildings).
      debug: new URLSearchParams(window.location.search).has('debug'),
    },
  },
  scene: [BootScene, RanchScene, HudScene],
};

// Expose the game instance for debugging in the browser console.
window.game = new Phaser.Game(config);
