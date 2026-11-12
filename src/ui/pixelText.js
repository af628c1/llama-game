// Text in the HUD pack's bitmap fonts, drawn the way the pack specifies: the string
// twice — once in a shadow colour one pixel down, then in the main colour on top — and
// measured by adding up each letter's advance.

export const hexColor = (css) => parseInt(css.replace('#', ''), 16);

const glyphs = (scene, font) => scene.cache.bitmapFont.get(font).data.chars;

// Width of a string in pixels: the sum of its letters' advances, minus the gap that
// trails the last letter. Characters the font doesn't have take no space.
export function textWidth(scene, font, str) {
  const chars = glyphs(scene, font);
  let width = 0;
  for (const ch of str) {
    const glyph = chars[ch.codePointAt(0)];
    if (glyph) width += glyph.xAdvance;
  }
  return Math.max(0, width - 1);
}

// Trim a label and end it with '…' until it is no wider than maxWidth.
export function fitText(scene, font, str, maxWidth) {
  if (textWidth(scene, font, str) <= maxWidth) return str;
  let cut = str;
  while (cut.length > 0 && textWidth(scene, font, `${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1).trimEnd();
  }
  return `${cut}…`;
}

// Where a string of the given width starts so that it is centered in `box` ([x0, x1],
// both inclusive).
export function centeredX([x0, x1], width) {
  return x0 + Math.floor((x1 - x0 + 1 - width) / 2);
}

export class ShadowText {
  // The two text objects are added to `parent` (a Container), in drawing order.
  constructor(scene, parent, font) {
    this.scene = scene;
    this.font = font;
    this.shadow = scene.add.bitmapText(0, 0, font, '');
    this.face = scene.add.bitmapText(0, 0, font, '');
    parent.add([this.shadow, this.face]);
  }

  // Put `str` with its left edge at x and the top of its line at lineTopY.
  set(str, x, lineTopY, color, shadowColor) {
    this.shadow.setText(str).setPosition(x, lineTopY + 1).setTint(hexColor(shadowColor));
    this.face.setText(str).setPosition(x, lineTopY).setTint(hexColor(color));
    return this;
  }

  // The same, centered in `box`.
  setCentered(str, box, lineTopY, color, shadowColor) {
    const x = centeredX(box, textWidth(this.scene, this.font, str));
    return this.set(str, x, lineTopY, color, shadowColor);
  }
}
