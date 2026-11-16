# 🦙 Alpaca Rancher

A 2D ranching game inspired by Stardew Valley, Harvest Moon, and Story of Seasons —
except you're not a farmer, you're an **alpaca rancher**.

This is **v0.8: the herd's genetics**. Explore an open highland ranch — a grassy pasture with
a cross-shaped dirt road, a **log-cabin farmhouse** you can walk into and sleep in, an
open **run-in shelter** (the barn) with its alpaca shed inside, and a pond with a gravel
bank — all drawn from the Andes-inspired art pack in `assets/`. A clock, a calendar and
daily weather run in the top-right corner, and the menu in the top-left saves and loads
the game in two slots. Behind the scenes the herd already exists — every alpaca with its
genes, its pedigree and its pregnancies — though nothing of it is on screen yet. Alpacas
you can see, the pen, garden, chores and the economy are coming next (see the roadmap
below).

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
| Enter / exit | Walk into the cabin's doorway or the shelter's open front |
| Sleep        | Click the bed, then **Yes**   |
| Menu         | The button in the top-left corner, or `Esc` |
| Save / load  | Menu → **Save** or **Load** → pick a slot |

## What's here (v0.8)

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
- **The shed's interior.** Walk up into the shelter's open front and the same fade takes
  you inside: hay stack, bale, broom, water basin and feed trough are solid and
  depth-sorted, the lantern flickers, and at night the shed darkens around its glow. Walk
  down onto the grass to leave.
- **Time and weather.** The board in the top-right corner shows the weekday and date,
  the year, the clock, today's weather and any festival or birthday. A day starts at
  6:00 am and moves 10 minutes every 7 seconds; a year is four 30-day seasons. Each day is
  sunny, overcast or rainy, rolled per season while you sleep (rules in `src/config.js`).
- **Sleeping.** Click the bed and answer **Yes** (mouse, or Up/Down + Enter; Esc is No):
  the screen fades out and back in on the next morning, beside the bed. Stay up until
  2:00 am and you pass out and wake at home. After 7 pm the cabin window shows the night.
- **Saving and loading.** The menu button in the top-left corner (or `Esc`) opens
  **Save** and **Load**, each with two slots that show the date, time and place of the
  save in them. A save holds the whole game exactly as it is — the day, the clock to the
  millisecond, today's and tomorrow's weather, where the rancher stands and which way
  they face (even mid-hop), and the state of everything in the rooms — and loading puts
  all of it back. The game stands still while the menu is up. Saving over a slot and
  loading both ask first. Saves are kept by the browser, for the address the game is
  served from: another browser, or another port, has its own slots.
- **The herd's genetics (no screens yet).** Every alpaca has hidden genes: Mendelian coat
  colour and fleece type, eight heritable traits from fibre fineness to hardiness, and
  recessive defects that carriers pass on unseen. Crias are born of real meiosis, relatives
  are tracked for good, and inbreeding costs fertility, health and lives. The player only
  ever learns what their records support — the "quipu" layer — and a pregnancy stays
  unknown until a spit-off test shows it. The herd lives by the game's days and is saved
  with the game. Try `genetics.help()` in the browser's dev console; the whole system is
  described in `src/genetics/README.md`.
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
  on the building outside. `InteriorScene` builds any room from such a file — the cabin
  and the shed (`assets/shed_interior.json`) are the same code — so a new room is one line
  in `INTERIORS` in `src/config.js`. See `assets/CABIN_INTERIOR.md` and
  `assets/SHED_INTERIOR.md`.
- **The HUD is the pack's too.** `assets/time_weather_hud.json` gives the board's art,
  fonts, text positions and colours, and the list of festivals and birthdays
  (`assets/TIME_WEATHER_HUD.md`). The board matches the pack's reference renders pixel for
  pixel. The *rules* — days per season, the clock, the weather odds — are the game's own
  and live in `src/config.js`; the pack's example calendar and odds are not used.
- **One game-state object.** `src/state/GameState.js` holds everything about a
  playthrough, in sections: `time` (the day, the clock and the weather), `player` (where
  the rancher is), `world` (the state of objects in rooms), `stats` and `genetics` (the
  alpacas). Scenes and the HUD show the state; they don't own it. A day's weather is
  seeded by the day, so it never changes once rolled. A new day begins in one place,
  `GameState.nextDay()`, which is where anything that lives by the day gets its tick.
- **Genetics is pure logic** in `src/genetics/`, with no rendering in it, and the screen
  may read animals only through `quipu.getPlayerView()`. Every number is in
  `src/genetics/config.js`, and everything random comes from one seeded generator, so a
  seed — or a saved game — fixes all that follows.
- **Tests.** `npm test` runs the genetics tests on Node's built-in test runner (Node 20
  or newer; nothing to install). `package.json` exists only for that: the game itself
  still has no dependencies and no build step.
- **Saving is the game state, written down.** A save file is every section's data, each
  with its own version number, as JSON in the browser's `localStorage` (one entry per
  slot). Loading is all or nothing: a slot is read and checked in full before the game
  changes at all, so a damaged save, or one from a newer version, is refused with the
  game left as it was. See *Making new things saveable* below.
- **The layout is a text grid** in `src/world/ranchMap.js` — one letter per tile
  (`g` grass, `f` flowers, `d` dirt path, `b` bare ground, `v` gravel, `w` water). Edit the
  grid to reshape the ranch; buildings are placed by an anchor tile.
- The rancher and signposts aren't in the art pack yet, so they are still drawn in code
  (`BootScene`) as placeholders. Indoors the rancher is drawn at 2×, the size the
  furniture was made for.
- Add **`?debug`** to the URL to see the collision boxes and door triggers (green).

### Making new things saveable

The rule: **whatever changes during play and should still be so tomorrow lives in a
section of the game state.** Then it is saved and loaded without touching the save code or
the menu.

1. Write a section — for plain values, list the fields and what they are in a new game:

   ```js
   // src/state/PurseState.js
   import Section from './Section.js';

   export default class PurseState extends Section {
     static fields() { return { coins: 50, feedBags: 0 }; }
   }
   ```

2. Add it to `SECTIONS` in `src/state/GameState.js` (`purse: PurseState`), and use it from
   any scene as `this.registry.get('state').purse.coins`.

That is all. Later changes keep old saves working:

- **A new field** is just added to `fields()`; a save from before it existed loads with the
  field at its new-game value. The same goes for a whole new section.
- **A field that changes name, meaning or shape**: raise the section's `version` and add a
  migration from the old one (`static migrations = { 1: (data) => ... }`, see
  `src/state/Section.js`).
- A section with more to it than plain values (like `TimeState`) writes its own `save()`
  and `load()` instead.
- Things a scene owns while it runs (where the rancher is standing) are handed over at
  the moment of saving, in the scene's `savePlace()`. A new world scene needs that one
  method, and to accept `rancher` in `create()`, to be a place a game can be saved in.

### Project layout

```
index.html            # loads Phaser + the game
lib/phaser.min.js     # vendored Phaser 3
assets/
  manifest.json       # the art pack's spec: sizes, walkability, collision, palette
  cabin_interior.json # the cabin's room: layers, collision, spawn, exit, door link
  shed_interior.json  # the shed's room, same format, plus per-state images
  time_weather_hud.json # the HUD board: art, fonts, text layout, events list
  terrain/            # six seamless 32×32 ground tiles
  buildings/          # cabin.png (house), run_in_shelter.png (barn)
  interiors/cabin/    # room, furniture, decor and the fire strip
  interiors/shed/     # room, props, trough/basin/dung states, lantern, night tint
  ui/hud/             # the board, weather icons, event icons
  ui/fonts/           # Kantu + Kantu Small pixel fonts (bitmap and TTF)
  reference/          # the pack's 1× pictures of how things should look
src/
  main.js             # Phaser config + scene registration
  config.js           # sizes, speeds, jump, fade, zoom rules, calendar, clock, weather, saves
  scenes/
    BootScene.js      # loads the art pack; starts the clock; draws the placeholder rancher
    RanchScene.js     # ground, buildings, doors, collision, depth sorting, camera
    InteriorScene.js  # a room built from an interior spec; the bed
    HudScene.js       # the board, the menu, questions, the fade, the clock; save + load
  state/
    GameState.js      # the whole state of a playthrough: the list of sections; nextDay()
    Section.js        # the short way to write a section; versions and migrations
    TimeState.js      # the day, the clock and the weather
    PlayerState.js    # where the rancher is
    WorldState.js     # the state of objects in rooms (trough full or empty...)
    StatsState.js     # time played
    GeneticsState.js  # the alpacas: holds the genetics world; events, hooks, modifiers
  genetics/           # the herd's genetics: see its README.md
    config.js         # every tunable: traits, defects, breeding, bloodlines
    Genetics.js       # the world: registry + breeding + quipu + the daily tick
    quipu.js          # what the player knows — the only read path for the screen
    ...               # rng, genome, color, traits, defects, pedigree, breeding,
                      # modifiers, founders, serialize, events, debug
    tests/            # npm test
  save/
    SaveStore.js      # the save slots: the save file, written to and read from the browser
    SaveError.js      # what can go wrong saving or loading
  ui/
    TimePanel.js      # the time and weather board
    ChoicePanel.js    # the panel that asks questions and shows the menu's pages
    SaveMenu.js       # the menu: Save / Load, the slots, "Overwrite?"
    MenuButton.js     # the menu button in the top-left corner
    boardArt.js       # panels and buttons cut from the board's art
    keys.js           # key presses for the UI, each counted once
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

- [x] 🧬 Alpaca genetics, breeding and pedigrees (logic only)
- [ ] 🦙 Alpacas you can see, feed and pet (hunger / happiness)
- [ ] 📿 Quipu screens: herd records, pairing forecasts
- [ ] ☀️ Day/night lighting + player energy
- [ ] 🎒 Inventory + a shop to buy feed and sell wool
- [x] 🎨 Real pixel art for terrain, the house and the barn
- [x] 🏠 Walk into the cabin and the shed
- [ ] 🧹 Shed chores: take hay, fill the feeder and the water, clear the dung
- [x] 🛏️ Sleep in the bed
- [x] 🗓️ Clock, calendar and daily weather (HUD)
- [ ] 🌧️ Weather you can see (rain, overcast light) and what it does
- [ ] 🗓️ Use the wall calendar
- [ ] 🎨 Pixel-art rancher, alpacas and fences, with animations
- [ ] 🔊 Sound & music
- [x] 💾 Save / load (two slots)
