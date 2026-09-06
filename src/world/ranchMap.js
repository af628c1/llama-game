// The starter ranch, built as a tile grid. Rather than hand-typing 30 rows of 40
// characters, we generate the layout deterministically here and hand-place a few
// features (pond, barn, paths, fence border). Swapping in a hand-authored or loaded
// map later just means replacing `buildRanch()` with something that returns the same
// { cols, rows, tiles } shape.

import { WORLD_COLS, WORLD_ROWS } from '../config.js';

// Tile ids. GRASS/GRASS_ALT are purely cosmetic; everything in SOLID_TILES blocks the
// player.
export const T = {
  GRASS: 0,
  GRASS_ALT: 1,
  DIRT: 2,
  WATER: 3,
  FENCE: 4,
  BARN: 5,
};

// Tiles the player cannot walk through.
export const SOLID_TILES = new Set([T.WATER, T.FENCE, T.BARN]);

// A player-friendly spawn point (in tile coordinates) on open ground near the barn.
export const SPAWN = { col: 8, row: 20 };

function fillRect(tiles, col0, row0, w, h, value) {
  for (let r = row0; r < row0 + h; r++) {
    for (let c = col0; c < col0 + w; c++) {
      if (r >= 0 && r < WORLD_ROWS && c >= 0 && c < WORLD_COLS) {
        tiles[r][c] = value;
      }
    }
  }
}

export function buildRanch() {
  const cols = WORLD_COLS;
  const rows = WORLD_ROWS;

  // Start with a checkerboard of grass so the ground reads as textured, not flat.
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push((r + c) % 2 === 0 ? T.GRASS : T.GRASS_ALT);
    }
    tiles.push(row);
  }

  // A pond in the north-east of the ranch.
  fillRect(tiles, 26, 4, 8, 5, T.WATER);

  // Dirt paths: a horizontal road across the middle and a vertical spur to the barn.
  fillRect(tiles, 1, 14, cols - 2, 2, T.DIRT);
  fillRect(tiles, 9, 16, 2, 6, T.DIRT);

  // The barn (a solid building block) sits in the south-west, just off the paths.
  fillRect(tiles, 5, 22, 6, 5, T.BARN);

  // Fence border around the whole ranch, then punch a gate opening in the south wall.
  for (let c = 0; c < cols; c++) {
    tiles[0][c] = T.FENCE;
    tiles[rows - 1][c] = T.FENCE;
  }
  for (let r = 0; r < rows; r++) {
    tiles[r][0] = T.FENCE;
    tiles[r][cols - 1] = T.FENCE;
  }
  // Gate: leave a two-tile gap at the bottom-center so it reads as an entrance.
  tiles[rows - 1][Math.floor(cols / 2)] = T.GRASS;
  tiles[rows - 1][Math.floor(cols / 2) + 1] = T.GRASS;

  return { cols, rows, tiles };
}
