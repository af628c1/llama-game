# 🦙 Alpaca Rancher

A 2D ranching game inspired by Stardew Valley, Harvest Moon, and Story of Seasons —
except you're not a farmer, you're an **alpaca rancher**.

This is **v0.2: the ranch takes shape**. Explore an open ranch — a grassy field with a
cross-shaped path, a log-cabin farmhouse, and a wooden barn, laid out from the design
mockup. Alpacas, the pen, garden, pond, chores, day/night, and the economy are coming next
(see the roadmap below).

## Play it

The game is plain HTML/JS with **no build step**, but it must be served over HTTP (opening
`index.html` directly with `file://` won't work because it loads ES modules).

From the project folder:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

(Any static server works — e.g. `npx serve` — if you'd rather not use Python.)

## Controls

| Action | Keys              |
| ------ | ----------------- |
| Move   | `WASD` or Arrows  |

## What's here (v0.2)

- An open ranch laid out like the design mockup: a lush grass field, a cross-shaped dirt
  path (signposted **To town** ↓ and **To ??? (TBD)** ↑), a **log-cabin farmhouse**
  (top-left) and a **wooden barn** (top-right).
- A rancher you walk around in all directions.
- A camera that follows you across a world larger than the screen.
- Depth-sorted buildings: you walk **behind** the tall roofs and collide with just their
  base — the little touch that makes it feel like a real game.

## How it's built

- **[Phaser 3](https://phaser.io/)** game engine, vendored locally at `lib/phaser.min.js`
  so the game runs offline with no CDN dependency.
- **Vanilla ES modules** for our own code — zero build tooling.
- **All art is hand-drawn in code** (`src/scenes/BootScene.js`) using Phaser's
  `Graphics.generateTexture()` — grass variants with speckle noise, a dirt path with soft
  grass-tuft edges, and shaded building sprites. No image files, so **swapping in real
  pixel art later is a one-line change**: replace a `makeX()` bake with
  `this.load.image('<same TEX key>', 'assets/<file>.png')` and everything downstream keeps
  working.

### Project layout

```
index.html            # loads Phaser + the game
lib/phaser.min.js     # vendored Phaser 3
src/
  main.js             # Phaser config + scene registration
  config.js           # tile size, world size, speeds, color palette
  scenes/
    BootScene.js      # hand-draws every texture (ground, buildings, signs, player)
    RanchScene.js     # composes the ground, places buildings, camera + collision + depth
  entities/
    Player.js         # the rancher: movement, facing, y-sort depth
  world/
    ranchMap.js       # the ranch layout: path grid, building + sign placements, spawn
```

## Roadmap

- [ ] 🦙 Alpacas you can feed and pet (hunger / happiness)
- [ ] ☀️ Day/night cycle + player energy
- [ ] 🎒 Inventory + a shop to buy feed and sell wool
- [ ] 🎨 Real pixel-art spritesheets and animations
- [ ] 🔊 Sound & music
- [ ] 💾 Save / load
