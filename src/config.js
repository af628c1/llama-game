// Central place for the numbers and colors that define how the game looks and feels.
// Tweaking movement speed, tile size, or the palette should only ever mean editing here.

export const TILE = 32; // pixel size of one tile (also the base sprite grid)

// World dimensions, measured in tiles. The world is intentionally larger than the
// viewport so the camera has room to follow the player around the ranch.
export const WORLD_COLS = 40;
export const WORLD_ROWS = 30;

export const WORLD_WIDTH = WORLD_COLS * TILE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE;

// Player movement, in pixels per second (Arcade Physics velocity).
export const PLAYER_SPEED = 150;

// Placeholder pixel-art palette. These feed BootScene's generated textures, so this is
// the one spot to restyle the whole game before real art assets exist.
export const COLORS = {
  grass: 0x6ab04c,
  grassAlt: 0x5fa543, // subtle checker so the ground isn't a flat slab
  dirt: 0xb08968,
  dirtAlt: 0xa17a5a,
  water: 0x4a90d9,
  waterAlt: 0x3d7fc4,
  fence: 0x8b5a2b,
  fenceLight: 0xc08a4a,
  barnWall: 0xb23b3b,
  barnRoof: 0x7a2626,
  barnDoor: 0x5c3a1e,
  player: 0xf4e2c8, // rancher skin/base tone
  playerShirt: 0x2e6f9e,
  playerHat: 0x8b5a2b,
};

// Texture keys, kept in one object so scenes never hand-type magic strings.
export const TEX = {
  grass: 'grass',
  grassAlt: 'grassAlt',
  dirt: 'dirt',
  water: 'water',
  fence: 'fence',
  barn: 'barn',
  player: 'player',
};
