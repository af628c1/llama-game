# 🦙 Alpaca Rancher

A 2D ranching game inspired by Stardew Valley, Harvest Moon, and Story of Seasons —
except you're not a farmer, you're an **alpaca rancher**.

This is **v0.5: days and weather**. Explore an open highland ranch — a grassy pasture
with a cross-shaped dirt road, a **log-cabin farmhouse** you can walk into and sleep in,
an open **run-in shelter** (the barn) on its trampled yard, and a pond with a gravel bank
— all drawn from the Andes-inspired art pack in `assets/`. A clock, a calendar and daily
weather now run in the top-right corner. Alpacas, the pen, garden, chores and the economy
are coming next (see the roadmap below).

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
| Sleep        | Click the bed, then **Yes**   |

## What's here (v0.5)

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
- **Time and weather.** The board in the top-right corner shows the weekday and date,
  the year, the clock, today's weather and any festival or birthday. A day starts at
  6:00 am and moves 10 minutes every 7 seconds; a year is four 30-day seasons. Each day is
  sunny, overcast or rainy, rolled per season while you sleep (rules in `src/config.js`).
- **Sleeping.** Click the bed and answer **Yes** (mouse, or Up/Down + Enter; Esc is No):
  the screen fades out and back in on the next morning, beside the bed. Stay up until
  2:00 am and you pass out and wake at home. After 7 pm the cabin window shows the night.
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
- **The HUD is the pack's too.** `assets/time_weather_hud.json` gives the board's art,
  fonts, text positions and colours, and the list of festivals and birthdays
  (`assets/TIME_WEATHER_HUD.md`). The board matches the pack's reference renders pixel for
  pixel. The *rules* — days per season, the clock, the weather odds — are the game's own
  and live in `src/config.js`; the pack's example calendar and odds are not used.
- **One game-state object.** `src/state/TimeState.js` holds the day, the clock and the
  weather. The HUD only reads it; a day's weather is seeded by the day, so it never
  changes once rolled.
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
  time_weather_hud.json # the HUD board: art, fonts, text layout, events list
  terrain/            # six seamless 32×32 ground tiles
  buildings/          # cabin.png (house), run_in_shelter.png (barn)
  interiors/cabin/    # room, furniture, decor and the fire strip
  ui/hud/             # the board, weather icons, event icons
  ui/fonts/           # Kantu + Kantu Small pixel fonts (bitmap and TTF)
  reference/          # the pack's 1× pictures of how things should look
src/
  main.js             # Phaser config + scene registration
  config.js           # sizes, speeds, jump, fade, zoom rules, calendar, clock, weather
  scenes/
    BootScene.js      # loads the art pack; starts the clock; draws the placeholder rancher
    RanchScene.js     # ground, buildings, doors, collision, depth sorting, camera
    InteriorScene.js  # a room built from an interior spec; the bed
    HudScene.js       # the board, questions, the fade, and the ticking clock
  state/
    TimeState.js      # the day, the clock and the weather
  ui/
    TimePanel.js      # the time and weather board
    ConfirmDialog.js  # the yes/no question box
    pixelText.js      # shadowed, measured text in the pack's bitmap fonts
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
- [ ] ☀️ Day/night lighting + player energy
- [ ] 🎒 Inventory + a shop to buy feed and sell wool
- [x] 🎨 Real pixel art for terrain, the house and the barn
- [x] 🏠 Walk into the cabin
- [x] 🛏️ Sleep in the bed
- [x] 🗓️ Clock, calendar and daily weather (HUD)
- [ ] 🌧️ Weather you can see (rain, overcast light) and what it does
- [ ] 🗓️ Use the wall calendar
- [ ] 🎨 Pixel-art rancher, alpacas and fences, with animations
- [ ] 🔊 Sound & music
- [ ] 💾 Save / load
