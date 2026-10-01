// Central place for the numbers and colors that define how the game looks and feels.
// Tweaking movement speed, tile size, the palette, or the ranch layout should only ever
// mean editing here (layout lives in world/ranchMap.js, art in scenes/BootScene.js).

export const TILE = 32; // pixel size of one tile (also the base ground grid)

// World dimensions, measured in tiles. The world is larger than the viewport so the
// camera follows the player around an explorable ranch.
export const WORLD_COLS = 40;
export const WORLD_ROWS = 30;

export const WORLD_WIDTH = WORLD_COLS * TILE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE;

// Player movement, in pixels per second (Arcade Physics velocity).
export const PLAYER_SPEED = 150;

// Consistent light direction for all hand-drawn art: light comes from the top-left, so
// top/left faces are lighter and bottom/right faces fall into shadow. Keeping this shared
// is what makes separately-drawn sprites read as one cohesive scene.
export const LIGHT = { hi: 0xffffff, lo: 0x000000 };

// Hand-tuned palette for the cozy top-down look (green-roof log cabin, wooden barn, warm
// dirt paths, lush grass). This is the one spot to restyle the whole game.
export const COLORS = {
  // Grass: four near-identical greens (barely-there base variation) so tile seams vanish
  // and the per-tile speckle noise does the visual work — no checkerboard.
  grass: [0x66ac4c, 0x64aa4a, 0x68ae4e, 0x65ab4b],
  grassShadow: 0x4f8f3a,
  grassHighlight: 0x83c766,
  clover: 0x4c8a39,
  flowerWhite: 0xf7f3e8,
  flowerYellow: 0xf2c744,
  flowerPink: 0xe88bb0,
  pebble: 0x9a9488,

  // Dirt path: warm tan with pebbles; a soft rim makes it read as gently sunken.
  path: 0xc9a06a,
  pathDark: 0xb98e58,
  pathLight: 0xd8b580,
  pathPebble: 0x8f7244,

  // Farmhouse: green gabled roof + stacked-log walls.
  roofGreen: 0x3f7d4f,
  roofGreenHi: 0x4f9560,
  roofGreenLo: 0x2f6a40,
  logLight: 0xc79a62,
  logMid: 0xb5884f,
  logDark: 0x8a6438,
  chimney: 0x8a8378,
  chimneyDark: 0x6f685e,

  // Barn: wooden gambrel roof + vertical plank walls + lighter doors.
  barnRoof: 0x6b4423,
  barnRoofHi: 0x7d5330,
  barnWall: 0xa9743f,
  barnWallDark: 0x8f5f31,
  barnPlank: 0x7a5128,
  barnDoor: 0xcaa06a,
  barnTrim: 0xf0e6d2,

  // Shared woods / details.
  wood: 0x8a6038,
  woodDark: 0x6a4826,
  door: 0x5c3a1e,
  windowLit: 0xf6d27a,
  windowFrame: 0x4a3420,

  // Rancher.
  skin: 0xf0c9a0,
  shirt: 0x2e6f9e,
  shirtDark: 0x245a81,
  pants: 0x3a3f4b,
  hat: 0x8b5a2b,
  hatDark: 0x6d451f,
  outline: 0x23314a,

  shadow: 0x000000, // used at low alpha for drop shadows
};

// Texture keys, kept in one object so scenes never hand-type magic strings.
export const TEX = {
  grass: ['grass0', 'grass1', 'grass2', 'grass3'],
  grassDetails: ['detailClover', 'detailFlowers', 'detailPebble'],
  path: 'path',
  // Grass fringe that overhangs a path edge, one per side.
  edge: { top: 'edgeTop', bottom: 'edgeBottom', left: 'edgeLeft', right: 'edgeRight' },
  farmhouse: 'farmhouse',
  barn: 'barn',
  sign: 'sign',
  player: 'player',
};
