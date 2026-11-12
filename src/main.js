// Game entry point: configures Phaser and registers the scenes. Boot loads the art, then
// starts the Ranch with the HUD on top; walking through a door swaps the Ranch for an
// Interior and back. Scenes draw in the order listed, so the HUD must stay last.

import BootScene from './scenes/BootScene.js';
import RanchScene from './scenes/RanchScene.js';
import InteriorScene from './scenes/InteriorScene.js';
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
  scene: [BootScene, RanchScene, InteriorScene, HudScene],
};

// Expose the game instance for debugging in the browser console.
window.game = new Phaser.Game(config);
