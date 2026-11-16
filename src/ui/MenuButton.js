// The menu button in the top-left corner: three bars on a small wooden tag, cut from the
// same board art as the other buttons. The HUD scene scales it by a whole number and pins
// it to the corner.

import { drawTag } from './boardArt.js';

const SIZE = { w: 16, h: 13 };
const BARS = { x: 4, w: 8, tops: [3, 6, 9] };
const COLORS = { wood: '#7a4d28', bar: '#fbf0d8', barShadow: '#3d2412' };
const TEX = 'ui:menuButton';
const RESTING_TINT = 0xd9d2c6;

function makeTexture(scene) {
  if (scene.textures.exists(TEX)) return;
  const canvas = scene.textures.createCanvas(TEX, SIZE.w, SIZE.h);
  const ctx = canvas.getContext();

  // The tag is drawn one pixel too big, which leaves its shadow off the edge: that
  // shadow is the board's cream darkened, and this button sits on the world instead. For
  // the same reason the four corner pixels, cream where the tag's corners are rounded
  // off, are cleared.
  drawTag(scene, ctx, SIZE.w + 1, SIZE.h + 1);
  [[0, 0], [SIZE.w - 1, 0], [0, SIZE.h - 1], [SIZE.w - 1, SIZE.h - 1]].forEach(([x, y]) => {
    ctx.clearRect(x, y, 1, 1);
  });

  // No room for the nails next to the bars.
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(SIZE.w - 3, 2, 1, 1);

  BARS.tops.forEach((y) => {
    ctx.fillStyle = COLORS.barShadow;
    ctx.fillRect(BARS.x, y + 1, BARS.w, 1);
    ctx.fillStyle = COLORS.bar;
    ctx.fillRect(BARS.x, y, BARS.w, 1);
  });
  canvas.refresh();
}

export default class MenuButton {
  constructor(scene, onClick) {
    makeTexture(scene);
    this.image = scene.add.image(0, 0, TEX).setOrigin(0, 0).setTint(RESTING_TINT);
    this.image.setInteractive({ useHandCursor: true });
    this.image.on('pointerover', () => this.image.setTint(0xffffff));
    this.image.on('pointerout', () => this.image.setTint(RESTING_TINT));
    this.image.on('pointerdown', (pointer, x, y, event) => {
      event.stopPropagation(); // the click is for the button, not the world behind it
      onClick();
    });
  }

  // Pin to the top-left corner, `margin` ([x, y], in the button's own pixels) from the
  // edges. Returns where it ended up on screen: { right, centerY }.
  place([marginX, marginY], scale) {
    this.image.setScale(scale).setPosition(marginX * scale, marginY * scale);
    return {
      right: (marginX + SIZE.w) * scale,
      centerY: (marginY + SIZE.h / 2) * scale,
    };
  }
}
