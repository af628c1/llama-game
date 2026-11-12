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

// The hop (Space): how high the rancher rises, in pixels at 1x, and how long they are in
// the air. A press up to `bufferMs` before landing still counts, so hops chain cleanly.
export const JUMP = { height: 10, durationMs: 380, bufferMs: 120 };

// Going through a door: fade to black, hold a beat, fade back in (milliseconds).
// A night's sleep stays black a little longer.
export const FADE = { outMs: 220, holdMs: 160, inMs: 260, sleepHoldMs: 700 };

// --- Time and weather ------------------------------------------------------------------
// These are the game's rules. The HUD pack (assets/time_weather_hud.json) ships its own
// example calendar and weather odds; the numbers here are the ones in play.

// Four seasons of 30 days make a year. Weekdays simply keep counting from Monday,
// Spring 1, Year 1, so a season does not always start on a Monday.
export const CALENDAR = {
  seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
  daysPerSeason: 30,
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

// The clock, in minutes since midnight. A day starts at 6:00 am and moves 10 game
// minutes every 7 real seconds (about 14 minutes of play from waking to 2:00 am, when the
// rancher passes out and wakes at home the next morning). Night shows in the cabin window.
export const CLOCK = {
  dayStartMinutes: 6 * 60,
  passOutMinutes: 26 * 60,
  nightStartMinutes: 19 * 60,
  tickGameMinutes: 10,
  tickRealMs: 7000,
};

// Each new day's weather is rolled while the rancher sleeps. The numbers are weights:
// a season's chance of a weather is its weight over that season's total, so they need
// not add up to 100 (Summer and Winter add up to 90).
export const WEATHER = {
  types: ['sunny', 'overcast', 'rainy'],
  firstDay: 'sunny',
  chances: {
    Spring: { rainy: 50, sunny: 40, overcast: 10 },
    Summer: { sunny: 75, overcast: 10, rainy: 5 },
    Fall: { rainy: 60, sunny: 30, overcast: 10 },
    Winter: { sunny: 75, overcast: 10, rainy: 5 },
  },
};

// The HUD art pack: panel, icons, fonts, text layout and the list of festivals and
// birthdays. The interior the rancher wakes up in after a night's sleep.
export const HUD_SPEC = 'assets/time_weather_hud.json';
export const HOME_INTERIOR = 'cabin';

// Interiors, by id, and the art pack file that describes each one. A spec's
// `exteriorLink.building` says which building's door leads to it.
export const INTERIORS = {
  cabin: 'assets/cabin_interior.json',
};

// Interior art is drawn for a rancher about one tile wide and 1.4 tall — twice the size
// of the outdoor placeholder — so indoors the rancher is drawn at 2x. Walking speed is
// raised with them, a little less than in proportion so small rooms don't feel frantic.
export const INTERIOR_CHARACTER = { scale: 2, speedScale: 1.5 };

// Pixel art must be scaled by whole numbers only. Pick the largest integer zoom (within
// 2x–4x) that still shows roughly 15x10 tiles, then bump it if the window would otherwise
// be bigger than the whole world.
export function pickZoom(viewW, viewH, worldW, worldH) {
  const fit = Math.floor(Math.min(viewW / 480, viewH / 320));
  const zoom = Math.min(4, Math.max(2, fit));
  return Math.max(zoom, Math.ceil(viewW / worldW), Math.ceil(viewH / worldH));
}

// The HUD's pixel art is scaled the same way and depends only on the window, so it
// doesn't change size between the ranch and a room. Small windows drop to 1x.
export function pickUiScale(viewW, viewH) {
  return Math.min(4, Math.max(1, Math.floor(Math.min(viewW / 480, viewH / 320))));
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
  shadow: 'shadow',
};
