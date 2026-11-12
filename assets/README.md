# Alpaca Farm — World Assets (terrain · house · barn)

Andes-inspired pixel-art assets for an alpaca farming sim, packaged for implementation.
This drop covers **terrain tiles**, the **farmhouse** (log cabin), and the **barn** (open run-in shelter).

Everything is framework-agnostic: the art is plain PNG, and `manifest.json` holds all the
numbers (sizes, footprints, anchors, collision, palette) a loader needs. Read the manifest
as the source of truth; this README explains the conventions.

---

## Contents

```
alpaca-farm-world/
├── README.md              ← you are here
├── manifest.json          ← machine-readable spec (sizes, collision, anchors, palette)
├── example_layout.json    ← optional starting map showing how the ids are used
└── assets/
    ├── terrain/           ← 6 seamless 32×32 ground tiles
    │   ├── grass.png
    │   ├── grass_flowers.png
    │   ├── dirt_path.png
    │   ├── bare_ground.png
    │   ├── gravel.png
    │   └── water.png
    └── buildings/
        ├── cabin.png          ← the house (64×64)
        └── run_in_shelter.png ← the barn (72×50, open front)
```

---

## Core conventions (read first)

- **Tile size: 32×32 px.** The world is a 32px grid.
- **Pixel art — no smoothing.** Disable image smoothing / bilinear filtering and scale by
  **integers only** (2×, 3×, 4×). Any fractional or filtered scaling will blur the art.
  - Canvas: `ctx.imageSmoothingEnabled = false` + `image-rendering: pixelated` on the canvas.
  - Phaser: `pixelArt: true` in the game config.
  - Godot: import textures with filter **off**; use an integer-snapped pixel viewport.
- **Terrain PNGs are opaque** (full-bleed, meant to fill ground cells).
- **Building PNGs are transparent RGBA.** Each has a **soft contact shadow baked into its base**
  (the bottom few pixels, semi-transparent). If you add dynamic shadows later, keep that in mind.

---

## Terrain

All six tiles are **32×32 and tile seamlessly on every edge** (texture features wrap across
the borders), so you can repeat them freely on a tilemap layer.

| id              | walkable | use |
|-----------------|----------|-----|
| `grass`         | yes      | **Default ground** — highland (puna) grassland |
| `grass_flowers` | yes      | Grass variant w/ tufts + wildflowers — sprinkle sparingly so fields aren't uniform |
| `dirt_path`     | yes      | Compacted pebbly walkway |
| `bare_ground`   | yes      | Rougher open earth / trampled ground (good around the shelter) |
| `gravel`        | yes      | Rocky ground |
| `water`         | **no**   | Cold glacial water (still). **Non-walkable.** Can be animated with ripple frames later |

Build the ground as a single tilemap layer. Only `water` blocks movement; mark the rest walkable.

---

## Buildings

Both buildings sit **above** the ground on an "objects" layer and should be **depth-sorted**
so characters pass correctly in front of / behind them.

**Placement:** position a building by its **anchor = bottom-center**, dropping that point on the
**bottom-center of a target tile** (rather than snapping the whole image to the grid — the
shelter isn't a tile multiple). `manifest.json` gives each building's `baselineY` (the
ground-contact row in the PNG) and `ySortLineY` (the depth key). Sort moving entities against
`ySortLineY` using their feet-Y.

**Collision** is given per building in `manifest.json` as rectangles in **image pixel
coordinates** (origin = top-left of the PNG). They're sensible starting points — tune in-engine.

### 🏠 `cabin.png` — the house (64×64, 2×2 tiles)
Log cabin with a green shingled roof, stone chimney, and glowing windows.
- Collision = walls + stone foundation (`[8, 27, 57, 59]`). The roof above is left
  non-blocking so characters can y-sort behind the peak.

### 🛖 `run_in_shelter.png` — the barn (72×50, **open front**)
Three-sided run-in shelter: wood posts, shaded interior, hay bales, straw bedding, a lantern.
- **The front is open.** Alpacas should be able to **walk in from the front (bottom) and stand
  on the straw floor under the roof.** Only the two side posts and the back wall block them;
  the interior floor is walkable (see `collision.rectsPx` + `walkableInteriorPx`). This is the
  shelter mechanic — honor it.
- The **roof overhangs the walls**, so the sprite is visually wider (72px ≈ 2.25 tiles) than its
  ground footprint (~2 tiles). The overhang is purely visual; don't collide it.

---

## Suggested build approach (data-driven)

1. Load `manifest.json`. Build lookup tables for terrain (id → texture, walkable) and buildings
   (id → texture, anchor, baselineY, ySortLineY, collision).
2. Render the ground tilemap from your level data (see `example_layout.json` for the format).
3. Place buildings on an objects layer by their bottom-center anchor; add their collision shapes.
4. Depth-sort the objects layer (buildings + characters) by their y-sort line so overlap reads right.
5. Keep smoothing off and zoom integer.

`example_layout.json` is a tiny 20×12 starting map (grass field, a dirt path up to the cabin, a
pond, a bare patch with the shelter) that demonstrates the legend + building placement. Treat it
as a starting point, not the final level.

---

## Git / repo notes

- Commit as-is. These PNGs are tiny (each a few KB) — **no Git LFS needed**.
- Suggested home in your game repo: drop `assets/` under your project's assets root and keep
  `manifest.json` next to your other data/config, or keep the whole `alpaca-farm-world/` folder
  intact and point your loader at it.
- Filenames are lowercase, no spaces — safe across OSes.

---

## Not in this drop (available on request)

This package is **terrain + house + barn**, as asked. Other finished art can be packaged the
same way whenever you want it:
- **Fence kit** — front rail, side rail, and 4 corner posts (32px, tileable).
- **Huacaya alpaca** — idle + walk animations, 3 fleece stages + cria.
- **Tool icons** — shears, hoe, watering can, pitchfork, axe, pickaxe (32px).

*Art by Abbey.*
