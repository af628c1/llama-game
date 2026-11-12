// Screen-space UI, run in parallel with whichever world scene is showing. Keeping it in
// its own scene (with its own un-zoomed camera) means the world cameras can zoom the
// pixel art without touching it. Because it outlives the world scenes and draws on top of
// them, it also owns the fade used when going through a door.

import { FADE } from '../config.js';

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
    // True from the moment the screen starts fading out until it starts fading back in.
    // World scenes hold the rancher still while it is set.
    this.covered = false;
  }

  create() {
    this.add.text(12, 10, 'Alpaca Ranch — WASD / Arrows to move · Space to jump 🦙', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 5 },
    });
  }

  // Fade the whole screen to black, run `swap` (which changes the scene) while nothing
  // can be seen, stay black for a beat, then fade back in on the new scene.
  fadeThrough(swap) {
    if (this.covered) return;
    this.covered = true;

    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => {
      swap();
      this.time.delayedCall(FADE.holdMs, () => {
        this.covered = false;
        cam.fadeIn(FADE.inMs, 0, 0, 0);
      });
    });
    cam.fadeOut(FADE.outMs, 0, 0, 0);
  }
}
