// The rancher the player controls. Owns its sprite, its physics body, and how input
// turns into movement. Keeping this in its own class means later entities (alpacas,
// NPCs) can follow the same shape, and player behaviour grows here rather than bloating
// the scene.

import { TILE, PLAYER_SPEED, TEX } from '../config.js';

export default class Player {
  constructor(scene, tileCol, tileRow) {
    this.scene = scene;

    // Stand in the middle of the given tile. The sprite's origin is its feet, so its y
    // is the ground-contact point used for depth sorting.
    const x = (tileCol + 0.5) * TILE;
    const y = (tileRow + 0.5) * TILE;

    this.sprite = scene.physics.add.sprite(x, y, TEX.player);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setCollideWorldBounds(true);

    // The physics body is a small box at the rancher's feet, so movement feels grounded
    // and the upper body can overlap walls, roofs and shorelines.
    this.sprite.body.setSize(8, 4);
    this.sprite.body.setOffset(3, 18);

    this.facing = 'down';

    // Input: arrow keys and WASD both drive movement.
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  update() {
    const left = this.cursors.left.isDown || this.keys.left.isDown;
    const right = this.cursors.right.isDown || this.keys.right.isDown;
    const up = this.cursors.up.isDown || this.keys.up.isDown;
    const down = this.cursors.down.isDown || this.keys.down.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    // Normalize so moving diagonally isn't faster than moving straight.
    const body = this.sprite.body;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      body.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);

      // Track facing for a simple visual cue (horizontal flip). Vertical facing is
      // tracked too, ready for real directional frames later.
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx < 0 ? 'left' : 'right';
        this.sprite.setFlipX(vx < 0);
      } else {
        this.facing = vy < 0 ? 'up' : 'down';
      }
    } else {
      body.setVelocity(0, 0);
    }

    // Y-sort: depth is the rancher's feet, compared against each building's sort line —
    // behind a roof when standing above it, in front when below.
    this.sprite.setDepth(this.sprite.y);
  }
}
