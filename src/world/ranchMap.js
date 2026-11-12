// The ranch layout: one character per 32px tile, rows top-to-bottom (the same format as
// the art pack's example layout). Edit the grid to reshape the ranch — the renderer and
// collision both read straight from it.
//
// Layout: an open highland pasture with a cross-shaped dirt road (north exit "To ???",
// south exit "To town"), the log cabin top-left with a walkway to its door, the run-in
// shelter top-right on a trampled bare-ground yard, and a pond with a gravel bank
// bottom-right. The bottom-left pasture is left open for the alpaca pen.

import { TILE } from '../config.js';

// Grid character -> terrain id in assets/manifest.json.
export const LEGEND = {
  g: 'grass',
  f: 'grass_flowers',
  d: 'dirt_path',
  b: 'bare_ground',
  v: 'gravel',
  w: 'water',
};

export const GRID = [
  'gggggggggggggddggggggggggggg',
  'ggggggfggggggddggfgggggggggg',
  'gggfgggggggggddggggggggggfgg',
  'gggggggggfgggddgggggfggggggg',
  'gggggggggggggddggggggggggggg',
  'fggggggggggggddggggbbbbbgfgg',
  'ggggggggggfggddgggbbbbbbbggg',
  'ggfgggdggggggddgggbbbbbbbggg',
  'ggggggdgfggggddggggbbbbbgggg',
  'dddddddddddddddddddddddddddd',
  'dddddddddddddddddddddddddddd',
  'ggggggggfggggddggggggggggggg',
  'ggfggggggggggddggfggggggfggg',
  'gggggggggggfgddggggwwwvvvggg',
  'ggggggfggggggddgggwwwwwwvvgg',
  'gggggggggggggddgfgwwwwwwwvgg',
  'gggfgggggfgggddgggwwwwwwvvgg',
  'gggggggggggggddggggwwwvvvvgg',
  'gfgggggfgggggddggggggvvvvfgg',
  'gggggggggggggddgfggggggggggg',
];

export const ROWS = GRID.length;
export const COLS = GRID[0].length;
export const WORLD_WIDTH = COLS * TILE;
export const WORLD_HEIGHT = ROWS * TILE;

// Catch layout typos early with a pointed message instead of a blank tile.
GRID.forEach((row, r) => {
  if (row.length !== COLS) throw new Error(`ranchMap: row ${r} is ${row.length} tiles wide, expected ${COLS}`);
  [...row].forEach((ch, c) => {
    if (!LEGEND[ch]) throw new Error(`ranchMap: unknown tile '${ch}' at col ${c}, row ${r}`);
  });
});

// Buildings, by manifest id. Each is placed with its bottom-center on the bottom-center
// of `anchorTile` [col, row]; the terrain underneath stays as drawn.
export const BUILDINGS = [
  { id: 'cabin', anchorTile: [6, 6] }, // door lines up with the walkway in col 6
  { id: 'run_in_shelter', anchorTile: [21, 6] }, // open front faces the yard + road
];

// Wooden signposts beside the two road exits. Each stands on the bottom-center of `tile`.
export const SIGNS = [
  { tile: [15, 1], label: 'To ??? (TBD)' },
  { tile: [15, 18], label: 'To town' },
];

// The rancher starts at the crossroads, with the cabin and the shelter both in view.
export const SPAWN = { tile: [13, 10] };
