// The playable world: it turns the ranch tile grid into on-screen tiles, spawns the
// rancher, wires up collision, and follows the player with the camera. This is where
// future systems (alpacas, chores, day/night) will plug in.

import { TILE, WORLD_WIDTH, WORLD_HEIGHT, TEX } from '../config.js';
import { buildRanch, T, SOLID_TILES, SPAWN } from '../world/ranchMap.js';
import Player from '../entities/Player.js';

// Which texture key draws each tile id.
const TILE_TEXTURE = {
  [T.GRASS]: TEX.grass,
  [T.GRASS_ALT]: TEX.grassAlt,
  [T.DIRT]: TEX.dirt,
  [T.WATER]: TEX.water,
  [T.FENCE]: TEX.fence,
  [T.BARN]: TEX.barn,
};

export default class RanchScene extends Phaser.Scene {
  constructor() {
    super('Ranch');
  }

  create() {
    const map = buildRanch();

    // Static physics group holds every solid tile so one collider blocks them all.
    this.solids = this.physics.add.staticGroup();

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r][c];
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;

        if (SOLID_TILES.has(tile)) {
          // Water sits at ground level, so paint grass under solid tiles that aren't
          // full-height structures? Keep it simple: solids are drawn as their own tile.
          this.solids.create(x, y, TILE_TEXTURE[tile]);
        } else {
          this.add.image(x, y, TILE_TEXTURE[tile]);
        }
      }
    }

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

  createHud() {
    // Fixed to the screen (scrollFactor 0) so it stays put as the camera moves.
    const text = this.add.text(
      12,
      10,
      'Alpaca Ranch — WASD / Arrow keys to move 🦙',
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 8, y: 5 },
      }
    );
    text.setScrollFactor(0);
    text.setDepth(1000);
  }

  update() {
    this.player.update();
  }
}
