# Cabin interior — starter home

Add-on for `alpaca-farm-world`. Inside of the log cabin (`assets/buildings/cabin.png`).
Same rules as `README.md`: **32px grid, nearest-neighbor, smoothing off, integer zoom only.**

The source of truth is **`cabin_interior.json`**. This file explains how to use it.
`reference/cabin_interior_reference.png` shows the intended result at 1× — compare your render to it.

---

## Files

```
alpaca-farm-world/
├── CABIN_INTERIOR.md
├── cabin_interior.json
├── reference/cabin_interior_reference.png      1× composite (target look)
└── assets/interiors/cabin/
    ├── room_base.png      288×256 (9×8 tiles): log walls, plank floor, window, fireplace, doorway
    ├── bed.png  table.png  stool.png            furniture (y-sorted, solid)
    ├── rug.png  doormat.png                     floor decals (walkable)
    ├── calendar.png  chullo_peg.png  kantuta_pot.png   wall decor
    ├── fire.png           4-frame strip, 28×29 per frame
    └── window_night.png   night view for the window panes
```

## Coordinates

- **Room pixels**, origin = top-left of `room_base.png`.
- Rects are `[x0, y0, x1, y1]`, **inclusive** (same as `manifest.json`).
- Draw each sprite with its **top-left at `pos`**.
- Floor = `[32, 64, 255, 223]` = 7×5 tiles starting at tile (1, 2). Outside the walls is transparent.

## Draw order (`drawOrder`)

1. `base` — `room_base.png`
2. `nightOverlay` — `window_night.png`, **only at night**
3. `floorDecal` — rug, doormat (always under characters)
4. `wallDecor` — calendar, chullo, kantuta pot
5. `fire` — animated strip, loop at `frameMs`
6. `ySorted` — bed, table, stool **and the player** (+ pets/NPCs). Sort every frame:
   furniture by `ySortLineY`, characters by feet Y. This lets the player walk behind the table.

Fire glow and contact shadows are semi-transparent pixels — normal alpha blending.

## Collision

Solid = `collision.walls` + `collision.fireplaceHearth` + each object's `collision`.
Give the player a small **feet hitbox (~14×6)**. Keep the doorway gap (x 128–159) open down to
the exit trigger. `walkableGrid` is a conservative tile approximation for AI/pathfinding only.

## Interactions

| object | action | how |
|---|---|---|
| bed | `sleep` | feet in an `interact.zones` rect + action button |
| calendar | `open_calendar` | feet in zone, facing up + action button |
| front door | exit to farm | `exits[0].trigger`, fires when walking **down** into it |

Stub the actions if those systems don't exist yet (e.g. log `"sleep"`).

## Linking to the farm (`exteriorLink`)

Values are in **cabin.png pixels** → world = cabin sprite's placed top-left + value.

- **Enter:** feet overlap `entryTrigger` `[25, 56, 35, 62]` while moving up (or action facing up)
  → load the interior, put the player at `spawns.fromFarm` `(144, 214)` facing up.
- **Exit:** interior `front_door` trigger → load the farm, put the player at
  `exitSpawnFeet` `(30, 70)` facing down. Spawns sit outside their triggers, so no re-trigger loop.

## Suggested build steps

1. Add an interior scene/room that loads `cabin_interior.json` (keep it data-driven like the world).
2. Draw by `drawOrder`. Center the room in the viewport (no scrolling); clear to `art.sceneClearColor`.
3. Build colliders from the rects; add the player with a feet hitbox.
4. Hook the bed / calendar interactions and the door transition both ways.
5. Animate `fire.png` (4 frames, 140 ms). Show `window_night.png` when it's night.
6. Screenshot at 1× and compare with `reference/cabin_interior_reference.png`.

## Notes

- Andes details: aguayo-style striped wool blanket, natural alpaca-wool rug, totora reed mat,
  chullo hat, kantuta flower, clay olla on the hearth, snowy peak in the window.
- Optional night look: multiply the scene by a cool tint, but keep `fire` unaffected.
- Objects are separate sprites so they can become movable furniture later.
