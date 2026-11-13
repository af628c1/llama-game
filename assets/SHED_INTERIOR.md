# Alpaca shed interior (starter)

Inside of the run-in shelter (`assets/buildings/run_in_shelter.png`).
Same rules as `README.md`: **32px grid, nearest-neighbor, smoothing off, integer zoom only.**

The source of truth is **`shed_interior.json`**. This file explains how to use it.
`reference/shed_interior_reference.png` (day) and `reference/shed_interior_reference_night.png`
show the intended result at 1×. Compare your render to them.

---

## Files

```
alpaca-farm-world/
├── SHED_INTERIOR.md
├── shed_interior.json
├── reference/shed_interior_reference.png          1× composite, day (trough full, water full, dung 2)
├── reference/shed_interior_reference_night.png    same states, at night
└── assets/interiors/shed/
    ├── room_base.png        288×256 (9×8 tiles): plank walls, posts, straw bedding, open front + paddock strip
    ├── hay_stack.png  hay_bale.png  broom.png             props (y-sorted, solid)
    ├── feed_trough_empty.png  feed_trough_full.png        state swap (same pos/size)
    ├── water_basin_empty.png  water_basin_full.png        state swap (same pos/size)
    ├── dung_pile_1.png  dung_pile_2.png                   floor decal by state (state 0 = nothing)
    ├── salt_lick.png  halter_peg.png                      wall decor
    ├── lantern.png          4-frame strip, 31×29 per frame
    └── night_tint.png       night overlay (drawn last)
```

## Coordinates

- **Room pixels**, origin = top-left of `room_base.png`.
- Rects are `[x0, y0, x1, y1]`, **inclusive** (same as `manifest.json` and `cabin_interior.json`).
- Draw each sprite with its **top-left at `pos`**.
- Floor under the roof = `[32, 64, 255, 191]` = 7×4 tiles starting at tile (1, 2).

## The open front

The outside is a three-sided run-in shelter, so the inside has **no front wall**. Below the floor is the
eave (in shade), then a strip of sunlit paddock. `collision.walls[3..5]` keep characters between the
two corner posts and above the bottom edge. Walking **down** into the grass exits.

## Draw order (`drawOrder`)

1. `base`: `room_base.png`
2. `floorDecal`: dung pile (by state)
3. `wallDecor`: salt lick, halter
4. `lantern`: animated strip, loop at `frameMs`
5. `ySorted`: hay stack, bale, broom, water basin, feed trough, **the player and alpacas**.
   Sort every frame: props by `ySortLineY`, characters by feet Y. Alpacas at the trough stand behind it.
6. `nightOverlay`: `night_tint.png`, **only at night**, over everything (characters too).

Shadows, the lantern glow and the night tint are semi-transparent pixels: use normal alpha blending.

## Collision

Solid = `collision.walls` + each object's `collision`. Feet hitbox ~14×6 for the player, ~16×6 for
alpacas. `walkableGrid` is a rough tile version for AI/pathfinding only.

## Interactions and states

| object | action | how | result |
|---|---|---|---|
| hay_stack | `take_hay` | feet in zone, facing up + action | +1 hay |
| feed_trough | `fill_feeder` | feet in zone, facing up + action, needs hay | state → `full` |
| water_basin | `fill_water` | feet in either zone + action (watering can / bucket) | state → `full` |
| dung_pile | `clear_dung` | pitchfork, feet in zone, state > 0 | state → `0`, +fertilizer |
| open front | exit to farm | `exits[0].trigger`, fires when walking **down** into it | |

Suggested daily rules (tune freely): trough `full` → `empty` at dawn if alpacas ate; basin `full` →
`empty` every 2 days; dung +1 each night the herd sleeps inside (max 2). Stub any action whose system
doesn't exist yet (e.g. log `"fill_feeder"`).

## Alpacas (`herd`)

Up to **4** inside (starter shed). Use the existing Huacaya sprites (25×34, feet at bottom-center).
`restSpots`, `eatSpots` (behind the trough, facing down), `drinkSpots` and `dungSpot` are good places
to stand; `wanderRect` is for idle wandering. Which alpacas are inside is game logic. Suggested: in at
dusk and when it rains, out to the paddock in the morning.

## Linking to the farm (`exteriorLink`)

Values are in **run_in_shelter.png pixels** → world = shelter sprite's placed top-left + value.

- **Enter:** feet overlap `entryTrigger` `[19, 42, 53, 47]` while moving up (or action facing up)
  → load the interior, put the player at `spawns.fromFarm` `(144, 214)` facing up.
- **Exit:** interior `open_front` trigger → load the farm, put the player at `exitSpawnFeet` `(36, 60)`
  facing down. Spawns sit outside their triggers, so there's no re-trigger loop.
- Only the player triggers this. Alpacas keep using `walkableInteriorPx` on the farm map.

## Night

`night_tint.png` darkens the shed and the paddock and stays clear around the lantern, so it lights the
hay corner. If the game already tints every scene at night, skip it but keep the lantern bright.

## Suggested build steps

1. Load `shed_interior.json`; build the scene from `room.file` + `objects`.
2. Draw the layers in `drawOrder`; y-sort the `ySorted` layer together with the characters.
3. Add collision and the exit trigger; add `exteriorLink` to the shelter on the farm map.
4. Add the four interactions (stubs are fine) and the object states.
5. Place alpacas with `herd`.
6. Compare with the reference PNGs at 1× (same states: trough full, water full, dung 2).
