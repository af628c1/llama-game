// The playable world: it composes the ground (varied grass + a soft-edged dirt path) into
// a single baked texture, places the farmhouse and barn as depth-sorted sprites with
// collision footprints, adds signposts, and follows the rancher with the camera. This is
// where future systems (alpacas, chores, day/night) will plug in.

import { TILE, WORLD_WIDTH, WORLD_HEIGHT, COLORS, TEX } from '../config.js';
import { buildRanch, T, BUILDINGS, SIGNS, SPAWN } from '../world/ranchMap.js';
import Player from '../entities/Player.js';

// Small deterministic hash so each tile's grass variant / scattered detail is stable
// frame-to-frame (and run-to-run) instead of shimmering.
function hash(c, r) {
  let h = (c * 73856093) ^ (r * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

export default class RanchScene extends Phaser.Scene {
  constructor() {
    super('Ranch');
  }

  create() {
    const map = buildRanch();
    this.buildGround(map);
    this.buildBuildings();
    this.buildSigns();

    // The player.
    this.player = new Player(this, SPAWN.col, SPAWN.row);
    this.physics.add.collider(this.player.sprite, this.solids);

    // World + camera bounds, with a pixel-crisp follow.
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.roundPixels = true;

    this.createHud();
  }

  // Bake the whole ground into one RenderTexture: grass everywhere (with variants +
  // sparse details), the dirt path on top, then grass-tuft fringe where path meets grass.
  buildGround(map) {
    const rt = this.add.renderTexture(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setOrigin(0, 0);
    rt.setDepth(-1000);

    // Pass 1: grass base + occasional detail.
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const h = hash(c, r);
        rt.draw(TEX.grass[h % TEX.grass.length], c * TILE, r * TILE);
        if (map.tiles[r][c] === T.GRASS && h % 100 < 7) {
          rt.draw(TEX.grassDetails[(h >> 5) % TEX.grassDetails.length], c * TILE, r * TILE);
        }
      }
    }

    // Pass 2: path tiles + fringe on sides that border grass.
    const isGrass = (c, r) =>
      r >= 0 && r < map.rows && c >= 0 && c < map.cols && map.tiles[r][c] === T.GRASS;

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (map.tiles[r][c] !== T.PATH) continue;
        const x = c * TILE;
        const y = r * TILE;
        rt.draw(TEX.path, x, y);
        if (isGrass(c, r - 1)) rt.draw(TEX.edge.top, x, y);
        if (isGrass(c, r + 1)) rt.draw(TEX.edge.bottom, x, y);
        if (isGrass(c - 1, r)) rt.draw(TEX.edge.left, x, y);
        if (isGrass(c + 1, r)) rt.draw(TEX.edge.right, x, y);
      }
    }
  }

  // Place buildings bottom-anchored, with a soft shadow and a footprint collision body.
  // Depth = base Y so the player renders behind the tall roof when standing above it.
  buildBuildings() {
    this.solids = this.physics.add.staticGroup();

    BUILDINGS.forEach((b) => {
      const x = b.col * TILE;
      const y = b.row * TILE;
      const fw = b.foot.w * TILE;
      const fh = b.foot.h * TILE;

      // Soft grounding shadow.
      const shadow = this.add.ellipse(x, y - 4, fw * 1.15, fh * 1.0, COLORS.shadow, 0.16);
      shadow.setDepth(y - 1);

      // The building sprite, anchored at its base.
      const img = this.add.image(x, y, TEX[b.key]).setOrigin(0.5, 1);
      img.setDepth(y);

      // Invisible static body covering just the wall base (not the roof).
      const body = this.add.rectangle(x, y - fh / 2, fw, fh);
      body.setVisible(false);
      this.solids.add(body);
    });
  }

  // Wooden signposts at the path exits, each with a floating label pill (from the mockup).
  buildSigns() {
    SIGNS.forEach((s) => {
      const x = s.col * TILE;
      const y = s.row * TILE;
      const post = this.add.image(x, y, TEX.sign).setOrigin(0.5, 1);
      post.setDepth(y);
      const label = this.add.text(x, y - 60, s.label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#3b2a17',
        backgroundColor: '#f3ead6',
        padding: { x: 8, y: 4 },
      });
      label.setOrigin(0.5, 1);
      label.setDepth(y + 1);
    });
  }

  createHud() {
    // Fixed to the screen (scrollFactor 0) so it stays put as the camera moves.
    const text = this.add.text(12, 10, 'Alpaca Ranch — WASD / Arrow keys to move 🦙', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 5 },
    });
    text.setScrollFactor(0);
    text.setDepth(10000);
  }

  update() {
    this.player.update();
  }
}
