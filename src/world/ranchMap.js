// The ranch layout, as a tile grid plus building placements. The grid only distinguishes
// walkable ground types (grass vs. dirt path) so the renderer can give the path soft,
// grass-fringed edges. Buildings are placed as sprites (not tiles) with their own
// collision footprints. Matches the user's mockup: open field, a cross-shaped path
// (vertical road top<->bottom, horizontal road across), farmhouse top-left, barn
// top-right. No perimeter fence — the ranch is open, with path exits top and bottom.

import { WORLD_COLS, WORLD_ROWS } from '../config.js';

// Ground tile ids.
export const T = {
  GRASS: 0,
  PATH: 1,
};

// Vertical road (the main street): a band of columns running the full height, exiting the
// map at top ("To ??? (TBD)") and bottom ("To town").
const ROAD_COL_MIN = 18;
const ROAD_COL_MAX = 21;

// Horizontal road crossing it, a few rows tall, spanning the full width.
const ROAD_ROW_MIN = 13;
const ROAD_ROW_MAX = 15;

function inRoadCol(c) {
  return c >= ROAD_COL_MIN && c <= ROAD_COL_MAX;
}
function inRoadRow(r) {
  return r >= ROAD_ROW_MIN && r <= ROAD_ROW_MAX;
}

export function buildRanch() {
  const cols = WORLD_COLS;
  const rows = WORLD_ROWS;

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(inRoadCol(c) || inRoadRow(r) ? T.PATH : T.GRASS);
    }
    tiles.push(row);
  }

  return { cols, rows, tiles };
}

// Buildings. Each is placed by its bottom-center anchor in (fractional) tile coordinates,
// so it sits naturally on the ground just above the horizontal road. `foot` is the solid
// collision footprint (in tiles) centered on that anchor — smaller than the sprite so the
// player collides with the walls' base but can walk *behind* the taller roof.
export const BUILDINGS = [
  { key: 'farmhouse', col: 6.5, row: 11.2, foot: { w: 3.2, h: 1.4 } },
  { key: 'barn', col: 31, row: 11.2, foot: { w: 4.4, h: 1.4 } },
];

// Wooden signposts at the two path exits, with the labels from the mockup.
export const SIGNS = [
  { col: 22.6, row: 2.4, label: 'To ??? (TBD)' },
  { col: 22.6, row: 27.6, label: 'To town' },
];

// Player starts on the main road, just below the crossroads and clear of the buildings.
export const SPAWN = { col: 19.5, row: 19 };
