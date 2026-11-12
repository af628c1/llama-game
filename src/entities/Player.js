// The rancher the player controls. Owns the feet hitbox that physics moves, the art and
// shadow drawn from it, and how input turns into movement. Keeping this in its own class
// means later entities (alpacas, NPCs) can follow the same shape, and player behaviour
// grows here rather than bloating the scenes.

import { PLAYER_SPEED, JUMP, TEX } from '../config.js';

// The hitbox is a small box at the feet (size at 1x), so movement feels grounded and the
// upper body can overlap walls, roofs and shorelines.
const FEET = { w: 8, h: 4 };

export default class Player {
  // (x, y) is where the feet stand, in world pixels. `scale` sizes the whole rancher.
  constructor(scene, x, y, { scale = 1, speed = PLAYER_SPEED, facing = 'down' } = {}) {
    this.scene = scene;
    this.scale = scale;
    this.speed = speed;
    this.facing = facing;

    // Physics only ever moves the feet. Their position is the rancher's place on the
    // ground: what the camera follows, what collides, and what depth sorting compares.
    this.feet = scene.add.zone(x, y, FEET.w * scale, FEET.h * scale).setOrigin(0.5, 1);
    scene.physics.add.existing(this.feet);
    this.feet.body.setCollideWorldBounds(true);

    // The shadow stays on the ground; the art rises above it during a hop.
    this.shadow = scene.add.image(x, y, TEX.shadow).setScale(scale).setAlpha(0.25);
    this.art = scene.add.image(x, y, TEX.player).setOrigin(0.5, 1).setScale(scale);

    // The ground velocity being asked for. Scenes read this for "walking up into a
    // door"; the body's own velocity is zeroed by whatever wall it is pressed against.
    this.vx = 0;
    this.vy = 0;

    // The hop: time in the air, and the resulting height above the ground. It is purely
    // vertical — nothing in it ever touches vx/vy.
    this.airborne = false;
    this.airTime = 0;
    this.z = 0;
    this.jumpBuffer = 0;

    // Input: arrow keys and WASD both drive movement; Space hops.
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    // Caught as an event rather than polled, so even a tap shorter than a frame counts.
    this.cursors.space.on('down', () => { this.jumpBuffer = JUMP.bufferMs; });

    this.syncArt();
  }

  // Where the feet stand right now.
  get x() { return this.feet.body.center.x; }
  get y() { return this.feet.body.bottom; }

  // `frozen` stops the rancher and ignores input (used while the screen is faded out).
  update(delta, frozen = false) {
    let dx = 0;
    let dy = 0;
    if (!frozen) {
      if (this.cursors.left.isDown || this.keys.left.isDown) dx -= 1;
      if (this.cursors.right.isDown || this.keys.right.isDown) dx += 1;
      if (this.cursors.up.isDown || this.keys.up.isDown) dy -= 1;
      if (this.cursors.down.isDown || this.keys.down.isDown) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      // A held direction always steers at full speed, on the ground or in the air.
      // Normalized so moving diagonally isn't faster than moving straight.
      const len = Math.hypot(dx, dy);
      this.vx = (dx / len) * this.speed;
      this.vy = (dy / len) * this.speed;

      // Track facing for a simple visual cue (horizontal flip). Vertical facing is
      // tracked too, ready for real directional frames later.
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx < 0 ? 'left' : 'right';
        this.art.setFlipX(dx < 0);
      } else {
        this.facing = dy < 0 ? 'up' : 'down';
      }
    } else if (!this.airborne || frozen) {
      this.vx = 0;
      this.vy = 0;
    }
    // Otherwise: in the air with nothing held. Momentum carries — vx/vy stay exactly as
    // they were at takeoff until the rancher lands or steers.
    this.feet.body.setVelocity(this.vx, this.vy);

    this.updateHop(delta, frozen);
    this.syncArt();
  }

  // Taking off and landing are instant and never touch the ground velocity: no wind-up,
  // no slow-down in the air, no pause on landing.
  updateHop(delta, frozen) {
    if (frozen) this.jumpBuffer = 0;

    if (this.airborne) {
      this.airTime += delta;
      if (this.airTime >= JUMP.durationMs) {
        this.airborne = false;
        this.z = 0;
      } else {
        // A parabola from the ground, up to full height at mid-air, back to the ground.
        const t = this.airTime / JUMP.durationMs;
        this.z = 4 * JUMP.height * this.scale * t * (1 - t);
      }
    }

    if (!this.airborne && this.jumpBuffer > 0) {
      this.airborne = true;
      this.airTime = 0;
      this.jumpBuffer = 0;
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);
    }
  }

  // Draw the rancher where physics has put the feet. Depth is the feet's y (not the
  // lifted art's), so a hop never changes what the rancher is in front of or behind.
  syncArt() {
    const { x, y } = this;
    this.shadow.setPosition(x, y - this.scale).setDepth(y - 0.1);
    this.art.setPosition(x, y - this.z).setDepth(y);
  }

  // Put the rancher somewhere else, standing still.
  placeAt(x, y) {
    this.feet.body.reset(x, y);
    this.vx = 0;
    this.vy = 0;
    this.syncArt();
  }
}
