# 🦙 Alpaca Rancher

A 2D ranching game inspired by Stardew Valley, Harvest Moon, and Story of Seasons —
except you're not a farmer, you're an **alpaca rancher**.

This is **v0.1: the walkable foundation**. Right now you can explore a tile-based ranch
with your rancher character. Alpacas, chores, day/night, and the economy are coming next
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

## What's here (v0.1)

- A tile-based ranch (grass, dirt paths, a pond, a fenced border with a gate, and a barn).
- A rancher you walk around in all directions.
- A camera that follows you across a world larger than the screen.
- Solid collision — you can't walk through fences, the barn, or water.

## How it's built

- **[Phaser 3](https://phaser.io/)** game engine, vendored locally at `lib/phaser.min.js`
  so the game runs offline with no CDN dependency.
- **Vanilla ES modules** for our own code — zero build tooling.
- **Placeholder art is generated in code** (`src/scenes/BootScene.js`) using Phaser's
  `Graphics.generateTexture()`. No image files yet, so swapping in real pixel art later is
  a localized change.

### Project layout

```
index.html            # loads Phaser + the game
lib/phaser.min.js     # vendored Phaser 3
src/
  main.js             # Phaser config + scene registration
  config.js           # tile size, world size, speeds, color palette
  scenes/
    BootScene.js      # generates all placeholder textures
    RanchScene.js     # builds the map, spawns player, camera + collision
  entities/
    Player.js         # the rancher: movement + facing
  world/
    ranchMap.js       # the tile-grid layout of the starter ranch
```

## Roadmap

- [ ] 🦙 Alpacas you can feed and pet (hunger / happiness)
- [ ] ☀️ Day/night cycle + player energy
- [ ] 🎒 Inventory + a shop to buy feed and sell wool
- [ ] 🎨 Real pixel-art spritesheets and animations
- [ ] 🔊 Sound & music
- [ ] 💾 Save / load
