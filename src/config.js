// Central place for the numbers and colors that define how the game looks and feels.
// The ranch layout lives in world/ranchMap.js; terrain + building art (and their sizes,
// collision and palette) come from the art pack described by assets/manifest.json.

export const TILE = 32; // pixel size of one tile — matches the art pack's 32px grid

// The art pack's manifest. Its `file` paths are relative to the project root.
export const ASSET_MANIFEST = 'assets/manifest.json';

// Buildings are drawn larger than their PNGs so they are in proportion to the rancher.
// At 1.5 a building pixel is exactly 3 or 6 screen pixels when the camera zoom is 2x or
// 4x; at 3x zoom it alternates between 4 and 5, a slight unevenness in the finest details.
// Whole numbers (1, 2) are perfectly even at every zoom.
export const BUILDING_SCALE = 1.5;

// Player movement, in world pixels per second (Arcade Physics velocity).
export const PLAYER_SPEED = 90;

// Pixel art must be scaled by whole numbers only. Pick the largest integer zoom (within
// 2x–4x) that still shows roughly 15x10 tiles, then bump it if the window would otherwise
// be bigger than the whole world.
export function pickZoom(viewW, viewH, worldW, worldH) {
  const fit = Math.floor(Math.min(viewW / 480, viewH / 320));
  const zoom = Math.min(4, Math.max(2, fit));
  return Math.max(zoom, Math.ceil(viewW / worldW), Math.ceil(viewH / worldH));
}

// Palette for the few things still drawn in code (the rancher and the signposts). Woods
// are taken from the art pack's palette so they sit naturally next to the buildings.
export const COLORS = {
  wood: 0xb07a3e,
  woodLight: 0xc48f52,
  woodDark: 0x8a5d2c,
  woodSeam: 0x5a3619,

  skin: 0xf0c9a0,
  skinShade: 0xd9ad84,
  shirt: 0x2e6f9e,
  shirtDark: 0x245a81,
  pants: 0x3a3f4b,
  pantsDark: 0x2c303a,
  hat: 0x8b5a2b,
  hatDark: 0x6d451f,
  outline: 0x23314a,
};

// Texture keys for the code-drawn sprites. Terrain and building textures are keyed by
// their manifest ids ('grass', 'water', 'cabin', 'run_in_shelter', ...).
export const TEX = {
  sign: 'sign',
  player: 'player',
};
