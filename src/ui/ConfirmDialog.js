// A yes/no question in the middle of the screen, in the same look as the time and weather
// board. The pack has no dialog art of its own yet, so the board is cut up and reused:
// its log frame and woven band make the dialog's frame, its cream rows are repeated to
// make the dialog taller, and its wooden clock tag becomes the buttons.
//
// Everything is laid out in panel pixels inside a container that the HUD scene scales by
// a whole number and centers. Yes sits above No; pick with the mouse, or with Up/Down
// and Enter (Esc answers No).

import { HUD_TEX } from './TimePanel.js';
import { ShadowText } from './pixelText.js';

// Where things are in time_weather_panel.png (180x64).
const SRC = {
  width: 180,
  top: { y: 0, h: 14 }, // frame, woven band and its lower edge
  body: { y: 14, h: 24 }, // plain cream rows; 24 keeps the side logs' 6-row pattern in step
  bottom: { y: 54, h: 10 }, // two cream rows, then the bottom log
  tag: { x: 115, y: 43, w: 59, h: 14 }, // the wooden clock tag with its right/bottom shadow
  clean: { x: 50 }, // where to copy tag-free pixels from, to paint the tag out of `bottom`
};

// The dialog, top to bottom, in its own pixels.
const BODY_ROWS = 58;
const HEIGHT = SRC.top.h + BODY_ROWS + SRC.bottom.h;
const QUESTION_TOP = 19;
const BUTTON_X = Math.floor((SRC.width - SRC.tag.w) / 2);
const BUTTON_TOPS = [36, 53]; // Yes, then No
const ARROW = { w: 4, h: 7, gap: 3 };

const FONT = 'kantu';
const INK = { color: '#4a2e18', shadow: '#d6bb8c' };
const TAG_INK = { color: '#fbf0d8', shadow: '#3d2412' };

const TEX = { panel: 'ui:dialog', button: 'ui:button', arrow: 'ui:arrow' };

// Cut the dialog's pieces out of the board, once.
function makeTextures(scene) {
  if (scene.textures.exists(TEX.panel)) return;
  const board = scene.textures.get(HUD_TEX.panel).getSourceImage();
  const { top, body, bottom, tag, clean } = SRC;

  const panel = scene.textures.createCanvas(TEX.panel, SRC.width, HEIGHT);
  const ctx = panel.getContext();
  const copyRows = (srcY, rows, destY) => {
    ctx.drawImage(board, 0, srcY, SRC.width, rows, 0, destY, SRC.width, rows);
  };
  copyRows(top.y, top.h, 0);
  for (let done = 0; done < BODY_ROWS; done += body.h) {
    copyRows(body.y, Math.min(body.h, BODY_ROWS - done), top.h + done);
  }
  const bottomY = top.h + BODY_ROWS;
  copyRows(bottom.y, bottom.h, bottomY);
  // The clock tag's last rows (and its shadow) reach into the bottom strip: cover them
  // with the same rows taken from further left, where the board is plain.
  const tagRows = tag.y + tag.h - bottom.y;
  ctx.drawImage(board, clean.x, bottom.y, tag.w, tagRows, tag.x, bottomY, tag.w, tagRows);
  panel.refresh();

  const button = scene.textures.createCanvas(TEX.button, tag.w, tag.h);
  const bctx = button.getContext();
  bctx.drawImage(board, tag.x, tag.y, tag.w, tag.h, 0, 0, tag.w, tag.h);
  // Leave only the tag and its shadow: drop the two corner pixels of board behind it.
  bctx.clearRect(tag.w - 1, 0, 1, 1);
  bctx.clearRect(0, tag.h - 1, 1, 1);
  button.refresh();

  // A small arrow that points at the focused button.
  const arrow = scene.textures.createCanvas(TEX.arrow, ARROW.w, ARROW.h);
  const actx = arrow.getContext();
  actx.fillStyle = INK.color;
  for (let x = 0; x < ARROW.w; x++) actx.fillRect(x, x, 1, ARROW.h - 2 * x);
  arrow.refresh();
}

export default class ConfirmDialog {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.focus = 0;
    this.onYes = null;
    makeTextures(scene);

    this.root = scene.add.container(0, 0).setVisible(false);

    // The panel swallows clicks so they don't land on the world behind it.
    const panel = scene.add.image(0, 0, TEX.panel).setOrigin(0, 0).setInteractive();
    panel.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
    this.root.add(panel);

    this.question = new ShadowText(scene, this.root, FONT);

    this.buttons = ['Yes', 'No'].map((label, i) => {
      const top = BUTTON_TOPS[i];
      const button = scene.add.image(BUTTON_X, top, TEX.button).setOrigin(0, 0);
      button.setInteractive({ useHandCursor: true });
      button.on('pointerover', () => this.setFocus(i));
      button.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        this.choose(i);
      });
      this.root.add(button);
      // The label sits in the tag exactly as the clock does on the board.
      const box = [BUTTON_X + 1, BUTTON_X + SRC.tag.w - 3];
      new ShadowText(scene, this.root, FONT)
        .setCentered(label, box, top - 1, TAG_INK.color, TAG_INK.shadow);
      return button;
    });

    this.arrow = scene.add.image(BUTTON_X - ARROW.gap - ARROW.w, 0, TEX.arrow).setOrigin(0, 0);
    this.root.add(this.arrow);

    const keys = scene.input.keyboard;
    ['keydown-UP', 'keydown-W'].forEach((k) => keys.on(k, () => this.isOpen && this.setFocus(0)));
    ['keydown-DOWN', 'keydown-S'].forEach((k) => keys.on(k, () => this.isOpen && this.setFocus(1)));
    keys.on('keydown-ENTER', () => this.isOpen && this.choose(this.focus));
    keys.on('keydown-ESC', () => this.isOpen && this.choose(1));
  }

  // Ask `question`; `onYes` runs if the answer is Yes. Starts on Yes.
  open(question, onYes) {
    this.onYes = onYes;
    this.isOpen = true;
    this.question.setCentered(question, [8, SRC.width - 9], QUESTION_TOP, INK.color, INK.shadow);
    this.setFocus(0);
    this.root.setVisible(true);
  }

  setFocus(i) {
    this.focus = i;
    this.arrow.setY(BUTTON_TOPS[i] + Math.floor((SRC.tag.h - 1 - ARROW.h) / 2));
    this.buttons.forEach((button, b) => button.setTint(b === i ? 0xffffff : 0xd9d2c6));
  }

  choose(i) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.setVisible(false);
    this.scene.input.setDefaultCursor('default');
    const { onYes } = this;
    this.onYes = null;
    if (i === 0 && onYes) onYes();
  }

  // Center in a view of the given size, in screen pixels.
  place(viewWidth, viewHeight, scale) {
    this.root.setScale(scale);
    this.root.setPosition(
      Math.round((viewWidth - SRC.width * scale) / 2),
      Math.round((viewHeight - HEIGHT * scale) / 2),
    );
  }
}
