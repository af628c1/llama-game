# Time & weather HUD

The HUD shows the date, year, clock, weather icon and today's birthdays and festivals.
Build it from `time_weather_hud.json`. It uses the same rules as `manifest.json`: nearest-neighbour scaling and integer zoom only.

## Files

| Path | What |
|---|---|
| `assets/ui/hud/time_weather_panel.png` | 180×64 board. The log frame, aguayo band, divider and wooden clock tag are already drawn in. |
| `assets/ui/hud/weather_{sunny,overcast,rainy}.png` | 24×24 weather icons |
| `assets/ui/hud/event_{birthday,festival}.png` | 11×9 icons for the event line |
| `assets/ui/fonts/kantu.*` | Bold font (pixel size 13) for the date and clock |
| `assets/ui/fonts/kantu_small.*` | Small font (pixel size 11) for the year and events |
| `reference/time_weather_hud_*.png` | 1× renders of 3 states to check against |

Each font comes as `.fnt` (BMFont text), `.xml` (BMFont XML) and `.png` (white glyphs, tint them), plus a `.ttf`.
- Godot: use the `.fnt`.
- Phaser or Pixi: use the `.xml`.
- The `.ttf` also works at exactly its pixel size (or an integer multiple) with antialiasing and hinting off.

## Draw it

1. Put the HUD on a screen-space layer above the world and above any night tint. Scale it by the camera's integer zoom.
2. Anchor it top-right with a 6 px margin, in HUD pixels. Pixel-snap the position.
3. Draw in `layout.drawOrder`. All coordinates are panel pixels.
4. Text:
   - Draw each string twice: first in `shadow` at +0,+1, then in `color`.
   - To center it, use `x = box[0] + floor((box[1] - box[0] + 1 - textWidth) / 2)`, where `textWidth` = Σ xadvance − 1.
   - `baselineY` is the pixel row just under the letters. If your engine places text by its top-left corner, use `lineTopY` instead.
5. Event line:
   - Center the icon, the 3 px gap and the label together inside the box.
   - If there is no event, draw `emptyText` in the muted colours.
   - If a label is too wide, trim it and add `…`.

## Game logic (boilerplate)

```
absDay   = (year-1)*112 + seasonIndex*28 + (day-1)
weekday  = WEEKDAYS[absDay % 7]          // every season starts on Monday (matches the 4x7 wall calendar)
clock    : start 6:00 am; +10 game min every 7 real s; pause in menus/dialogue
           2:00 am = pass out; sleeping or passing out -> next day 6:00 am
newDay() : roll weather with weather.chances[season] using rng(saveSeed*1000 + absDay)
           (first day = sunny; an event's forceWeather wins); also pre-roll tomorrow
events   : today = events.list where season/day match; festivals first; swap every 4 s if several
night    : minutes >= clock.dayNight.nightStartMinutes (or < nightEnd) -> show the cabin's window_night
```

Keep the date, weather and events in one game-state object (for example `TimeState`), so the HUD only reads it and save files can store it.

Weather chances follow the real altiplano seasons:
- Summer is the rainy season, so it rains most then.
- Winter is dry and clear, so it rarely rains.

`weather.effects.rainy` has hooks for later: watering crops, and alpacas heading for the run-in shelter.

## Check

Render each entry in `referenceStates` at 1× and compare it with its PNG. It should match pixel-for-pixel.
Also test the longest strings:
- "Wednesday, Summer 28"
- "12:50 pm"
- "Year 99"

Notes:
- Andes details: the frame is cabin logs with end-grain corners, and the band is an aguayo weave in the bed blanket's yarn colours.
- The festivals are real dates mapped onto the 28-day seasons: Shearing Fair, Pukllay, Inti Raymi and Pachamama Day.
- The birthdays are placeholders until the villagers exist.
