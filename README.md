# 🦙 Alpaca Rancher

A 2D ranching game inspired by Stardew Valley, Harvest Moon, and Story of Seasons —
except you're not a farmer, you're an **alpaca rancher**.

This is **v0.4: come inside**. Explore an open highland ranch — a grassy pasture with a
cross-shaped dirt road, a **log-cabin farmhouse** you can walk into, an open **run-in
shelter** (the barn) on its trampled yard, and a pond with a gravel bank — all drawn from
the Andes-inspired art pack in `assets/`. Alpacas, the pen, garden, chores, day/night, and
the economy are coming next (see the roadmap below).

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

| Action       | Keys                          |
| ------------ | ----------------------------- |
| Move         | `WASD` or Arrows              |
| Jump         | `Space`                       |
| Enter / exit | Walk into the cabin's doorway |

## What's here (v0.4)

- A 32×22-tile ranch built from the art pack's six terrain tiles: puna grass with
  sparse wildflowers, a cross-shaped dirt road (signposted **To town** ↓ and
  **To ??? (TBD)** ↑), a bare-ground yard, a gravel bank and a **pond you can't walk into**.
- The **cabin** (top-left, with a walkway to its door) and the **run-in shelter**
  (top-right). The shelter's front is open: walk in and stand on the straw under the roof.
- A rancher you walk around in all directions, with a camera that follows you.
- **A hop that never costs momentum.** `Space` jumps with no wind-up and no landing
  pause, your speed is the same before, during and after, you can steer in mid-air, and if
  you let go of the keys you keep gliding until you land.
- **The cabin's interior.** Walk up into the doorway: the screen fades to black for a beat
  and fades back in on the room, with the rancher standing just inside the door. Bed,
  table and stool are solid and depth-sorted (walk behind the table), the fire is
  animated, and walking down through the doorway takes you back out.
- Depth-sorted buildings: you walk **behind** roofs and posts and collide only with walls.
- Buildings are drawn at 1.5× their PNG size (`BUILDING_SCALE` in `src/config.js`) so
  they are in proportion to the rancher.
- Crisp pixels at any window size — the camera only ever zooms by whole numbers (2×–4×).

## How it's built

- **[Phaser 3](https://phaser.io/)** game engine, vendored locally at `lib/phaser.min.js`
  so the game runs offline with no CDN dependency.
- **Vanilla ES modules** for our own code — zero build tooling.
- **Data-driven art.** `assets/manifest.json` (from the art pack) lists every terrain tile
  and building with its size, walkability, sort line and collision. `BootScene` loads
  whatever the manifest lists, and `RanchScene` places it — so dropping in an updated pack
  needs no code change. In-engine collision tweaks live in `src/world/buildings.js`, not in
  the manifest. See `assets/README.md` for the pack's conventions.
- **Interiors are data-driven too.** `assets/cabin_interior.json` describes the room: its
  images and draw order, what is solid, where you arrive, the exit, and where the door is
  on the building outside. `InteriorScene` builds any room from such a file; register new
  ones in `INTERIORS` in `src/config.js`. See `assets/CABIN_INTERIOR.md`.
- **The layout is a text grid** in `src/world/ranchMap.js` — one letter per tile
  (`g` grass, `f` flowers, `d` dirt path, `b` bare ground, `v` gravel, `w` water). Edit the
  grid to reshape the ranch; buildings are placed by an anchor tile.
- The rancher and signposts aren't in the art pack yet, so they are still drawn in code
  (`BootScene`) as placeholders. Indoors the rancher is drawn at 2×, the size the
  furniture was made for.
- Add **`?debug`** to the URL to see the collision boxes and door triggers (green).

### Project layout

```
index.html            # loads Phaser + the game
lib/phaser.min.js     # vendored Phaser 3
assets/
  manifest.json       # the art pack's spec: sizes, walkability, collision, palette
  cabin_interior.json # the cabin's room: layers, collision, spawn, exit, door link
  terrain/            # six seamless 32×32 ground tiles
  buildings/          # cabin.png (house), run_in_shelter.png (barn)
  interiors/cabin/    # room, furniture, decor and the fire strip
  reference/          # the pack's 1× picture of how the room should look
src/
  main.js             # Phaser config + scene registration
  config.js           # tile size, scales, speed, jump, fade, zoom rule, interiors list
  scenes/
    BootScene.js      # loads the art pack; draws the placeholder rancher + signpost
    RanchScene.js     # ground, buildings, doors, collision, depth sorting, camera
    InteriorScene.js  # a room built from an interior spec
    HudScene.js       # screen-space UI and the door fade (stays up across scenes)
  entities/
    Player.js         # the rancher: movement, hop, feet hitbox, y-sort depth
  world/
    ranchMap.js       # the ranch layout: tile grid, building + sign placements, spawn
    buildings.js      # manifest -> placement specs, plus in-engine collision tuning
    interiors.js      # cache/texture key naming for interior art
    rects.js          # the pack's [x0, y0, x1, y1] rectangles -> world boxes
```

## Roadmap

- [ ] 🦙 Alpacas you can feed and pet (hunger / happiness)
- [ ] ☀️ Day/night cycle + player energy
- [ ] 🎒 Inventory + a shop to buy feed and sell wool
- [x] 🎨 Real pixel art for terrain, the house and the barn
- [x] 🏠 Walk into the cabin
- [ ] 🛏️ Use the bed and the calendar
- [ ] 🎨 Pixel-art rancher, alpacas and fences, with animations
- [ ] 🔊 Sound & music
- [ ] 💾 Save / load
