// Screen-space UI, run in parallel with the world. Keeping it in its own scene (with its
// own un-zoomed camera) means the ranch camera can zoom the pixel art without touching it.

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.add.text(12, 10, 'Alpaca Ranch — WASD / Arrow keys to move 🦙', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 5 },
    });
  }
}
