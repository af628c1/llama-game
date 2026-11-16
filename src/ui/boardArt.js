// Pieces of the time and weather board, cut up and reused for the rest of the UI. The
// pack has no dialog or button art of its own yet, so: the board's log frame and woven
// band make a panel's frame, its cream rows are repeated to make the panel as tall as it
// needs to be, and its wooden clock tag is stretched into buttons of any size.
//
// Each function makes its texture the first time it is asked for and returns the key.

import { HUD_TEX } from './TimePanel.js';

// Where things are in time_weather_panel.png (180x64).
const SRC = {
  width: 180,
  top: { y: 0, h: 14 }, // frame, woven band and its lower edge
  body: { y: 14, h: 24 }, // plain cream rows; 24 keeps the side logs' 6-row pattern in step
  bottom: { y: 54, h: 10 }, // two cream rows, then the bottom log
  tag: { x: 115, y: 43, w: 59, h: 14 }, // the wooden clock tag with its right/bottom shadow
  clean: { x: 50 }, // where to copy tag-free pixels from, to paint the tag out of `bottom`
};

// The tag's edges, kept as they are when it is resized (the top corners have the nails,
// the right and bottom edges the shadow). The plain wood in between is what stretches.
const TAG_EDGE = { left: 4, right: 5, top: 4, bottom: 4 };

export const PANEL = { width: SRC.width, top: SRC.top.h, bottom: SRC.bottom.h };
export const TAG = { w: SRC.tag.w, h: SRC.tag.h };
export const ARROW = { w: 4, h: 7 };
export const INK = '#4a2e18';

const board = (scene) => scene.textures.get(HUD_TEX.panel).getSourceImage();

// How many cream rows a panel needs for its contents to end at `contentBottom` (in panel
// pixels) with a little room below. The side logs' grain repeats every 6 rows and only
// meets the bottom corners when the count is 4 more than a multiple of 6, as on the
// board itself, so the count is rounded up to the next one that is.
export function panelRowsFor(contentBottom) {
  const needed = Math.max(0, contentBottom + 5 - SRC.top.h);
  return needed + ((((4 - needed) % 6) + 6) % 6);
}

export const panelHeight = (bodyRows) => SRC.top.h + bodyRows + SRC.bottom.h;

// A panel: the board's frame around `bodyRows` rows of plain cream.
export function panelTexture(scene, bodyRows) {
  const key = `ui:panel:${bodyRows}`;
  if (scene.textures.exists(key)) return key;
  const { top, body, bottom, tag, clean } = SRC;
  const source = board(scene);

  const panel = scene.textures.createCanvas(key, SRC.width, panelHeight(bodyRows));
  const ctx = panel.getContext();
  const copyRows = (srcY, rows, destY) => {
    ctx.drawImage(source, 0, srcY, SRC.width, rows, 0, destY, SRC.width, rows);
  };
  copyRows(top.y, top.h, 0);
  for (let done = 0; done < bodyRows; done += body.h) {
    copyRows(body.y, Math.min(body.h, bodyRows - done), top.h + done);
  }
  const bottomY = top.h + bodyRows;
  copyRows(bottom.y, bottom.h, bottomY);
  // The clock tag's last rows (and its shadow) reach into the bottom strip: cover them
  // with the same rows taken from further left, where the board is plain.
  const tagRows = tag.y + tag.h - bottom.y;
  ctx.drawImage(source, clean.x, bottom.y, tag.w, tagRows, tag.x, bottomY, tag.w, tagRows);
  panel.refresh();
  return key;
}

// Draw the wooden tag, resized to w x h (shadow included), at the canvas's top-left.
export function drawTag(scene, ctx, w, h) {
  const { tag } = SRC;
  const e = TAG_EDGE;
  // [from, size in the tag, to, size in the drawing] for the three columns and rows.
  const cols = [
    [0, e.left, 0, e.left],
    [e.left, tag.w - e.left - e.right, e.left, w - e.left - e.right],
    [tag.w - e.right, e.right, w - e.right, e.right],
  ];
  const rows = [
    [0, e.top, 0, e.top],
    [e.top, tag.h - e.top - e.bottom, e.top, h - e.top - e.bottom],
    [tag.h - e.bottom, e.bottom, h - e.bottom, e.bottom],
  ];
  const source = board(scene);
  ctx.imageSmoothingEnabled = false;
  rows.forEach(([sy, sh, dy, dh]) => {
    cols.forEach(([sx, sw, dx, dw]) => {
      ctx.drawImage(source, tag.x + sx, tag.y + sy, sw, sh, dx, dy, dw, dh);
    });
  });
  // Leave only the tag and its shadow: drop the two corner pixels of board behind it.
  ctx.clearRect(w - 1, 0, 1, 1);
  ctx.clearRect(0, h - 1, 1, 1);
}

// A wooden button, w x h pixels with its shadow.
export function tagTexture(scene, w = TAG.w, h = TAG.h) {
  const key = `ui:tag:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, w, h);
  drawTag(scene, canvas.getContext(), w, h);
  canvas.refresh();
  return key;
}

// A small arrow that points at the focused button.
export function arrowTexture(scene) {
  const key = 'ui:arrow';
  if (scene.textures.exists(key)) return key;
  const arrow = scene.textures.createCanvas(key, ARROW.w, ARROW.h);
  const ctx = arrow.getContext();
  ctx.fillStyle = INK;
  for (let x = 0; x < ARROW.w; x++) ctx.fillRect(x, x, 1, ARROW.h - 2 * x);
  arrow.refresh();
  return key;
}
