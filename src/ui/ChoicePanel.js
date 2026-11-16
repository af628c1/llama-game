// A panel in the middle of the screen that asks the player to choose: a line of text over
// a column of buttons, in the same look as the time and weather board (ui/boardArt.js).
// It shows one page at a time —
//
//   panel.show({
//     title: 'Do you want to sleep?',
//     buttons: [{ label: 'Yes', onPick: () => sleep() }, { label: 'No' }],
//   });
//
// — and picking a button closes the panel and then runs the button's onPick, which is
// free to show another page: that is how the menu goes from page to page.
//
// A page is:
//   title     the line of text at the top
//   buttons   top to bottom, each one of
//               { label, onPick, disabled }           a small wooden button
//               { card: { caption, lines }, ... }     a wide one with one or two lines of
//                                                     text on it and a caption above
//   note      a small line under the buttons (optional)
//   focus     which button starts focused (optional; otherwise the first that isn't disabled)
//   onCancel  what Esc does instead of just closing the panel (optional)
//
// Pick with the mouse, or with Up/Down and Enter. A click that misses the panel closes it.
// Everything is laid out in panel pixels inside a container that the HUD scene scales by
// a whole number and centers; the panel is made as tall as the page needs.

import {
  PANEL, TAG, ARROW, INK, panelRowsFor, panelHeight, panelTexture, tagTexture, arrowTexture,
} from './boardArt.js';
import { ShadowText, fitText } from './pixelText.js';
import { onPress } from './keys.js';

const TEXT_BOX = [8, PANEL.width - 9]; // where the title and the note are centered
const TITLE_TOP = 19;
const FIRST_BUTTON_TOP = 36;
const BUTTON_GAP = 3;
const ARROW_GAP = 3;
const NOTE = { gap: 2, h: 10 };

// A wide button with room for two lines of text, and a small caption above it.
const CARD = {
  w: 150,
  h: 27,
  captionH: 11,
  oneLineTop: 6, // where its text goes, from the card's top: a single line...
  twoLineTops: [1, 12], // ...or a line in each font
};

const FONT = 'kantu';
const SMALL_FONT = 'kantu_small';
const ON_PANEL = { color: INK, shadow: '#d6bb8c' };
const ON_WOOD = { color: '#fbf0d8', shadow: '#3d2412' };
const UNFOCUSED_TINT = 0xd9d2c6;
const DISABLED_ALPHA = 0.45;

export default class ChoicePanel {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.page = null;
    this.buttons = []; // what is drawn for each of the page's buttons: { image, top, h }
    this.focus = 0;
    this.view = { width: 0, height: 0, scale: 1 };
    this.height = panelHeight(panelRowsFor(0));

    // Everything behind the panel: catches the clicks that miss it, so that they close
    // the panel and never land on the world.
    this.backdrop = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive().setVisible(false);
    this.backdrop.on('pointerdown', (pointer, x, y, event) => {
      event.stopPropagation();
      this.close();
    });

    this.root = scene.add.container(0, 0).setVisible(false);
    this.frame = scene.add.image(0, 0, panelTexture(scene, panelRowsFor(0))).setOrigin(0, 0);
    this.frame.setInteractive();
    this.frame.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
    this.contents = scene.add.container(0, 0); // the page: rebuilt each time one is shown
    this.arrow = scene.add.image(0, 0, arrowTexture(scene)).setOrigin(0, 0);
    this.root.add([this.frame, this.contents, this.arrow]);

    onPress(scene, ['UP', 'W'], () => this.isOpen && this.moveFocus(-1));
    onPress(scene, ['DOWN', 'S'], () => this.isOpen && this.moveFocus(1));
    onPress(scene, ['ENTER'], () => this.isOpen && this.choose(this.focus));
  }

  show(page) {
    this.page = page;
    this.isOpen = true;
    this.contents.removeAll(true);

    const text = (font) => new ShadowText(this.scene, this.contents, font);
    text(FONT).setCentered(page.title, TEXT_BOX, TITLE_TOP, ON_PANEL.color, ON_PANEL.shadow);

    let y = FIRST_BUTTON_TOP;
    this.buttons = page.buttons.map((button, i) => {
      const texts = [];
      const w = button.card ? CARD.w : TAG.w;
      const h = button.card ? CARD.h : TAG.h;
      const x = Math.floor((PANEL.width - w) / 2);
      if (button.card) {
        texts.push(text(SMALL_FONT).set(button.card.caption, x + 1, y, ON_PANEL.color, ON_PANEL.shadow));
        y += CARD.captionH;
      }
      const top = y;
      y += h + BUTTON_GAP;

      const image = this.scene.add.image(x, top, tagTexture(this.scene, w, h)).setOrigin(0, 0);
      this.contents.add(image);

      // Text sits in a button exactly as the clock does in its tag on the board.
      const box = [x + 1, x + w - 3];
      const maxWidth = box[1] - box[0] - 5;
      const line = (font, str, lineTop) => {
        const fitted = fitText(this.scene, font, str, maxWidth);
        texts.push(text(font).setCentered(fitted, box, top + lineTop, ON_WOOD.color, ON_WOOD.shadow));
      };
      if (!button.card) {
        line(FONT, button.label, -1);
      } else if (button.card.lines.length === 1) {
        line(FONT, button.card.lines[0], CARD.oneLineTop);
      } else {
        line(FONT, button.card.lines[0], CARD.twoLineTops[0]);
        line(SMALL_FONT, button.card.lines[1], CARD.twoLineTops[1]);
      }

      if (button.disabled) {
        [image, ...texts].forEach((part) => part.setAlpha(DISABLED_ALPHA));
      } else {
        image.setInteractive({ useHandCursor: true });
        image.on('pointerover', () => this.setFocus(i));
        image.on('pointerdown', (pointer, px, py, event) => {
          event.stopPropagation();
          this.choose(i);
        });
      }
      return { image, x, top, h };
    });

    let bottom = y - BUTTON_GAP;
    if (page.note) {
      const note = fitText(this.scene, SMALL_FONT, page.note, TEXT_BOX[1] - TEXT_BOX[0] + 1);
      text(SMALL_FONT).setCentered(note, TEXT_BOX, bottom + NOTE.gap, ON_PANEL.color, ON_PANEL.shadow);
      bottom += NOTE.gap + NOTE.h;
    }

    // As tall as the page needs.
    const rows = panelRowsFor(bottom);
    this.height = panelHeight(rows);
    this.frame.setTexture(panelTexture(this.scene, rows));
    this.frame.input.hitArea.setSize(PANEL.width, this.height);

    const firstEnabled = page.buttons.findIndex((button) => !button.disabled);
    this.setFocus(this.canFocus(page.focus) ? page.focus : firstEnabled);
    this.backdrop.setVisible(true);
    this.root.setVisible(true);
    this.place();
  }

  canFocus(i) {
    return Number.isInteger(i) && Boolean(this.page.buttons[i]) && !this.page.buttons[i].disabled;
  }

  setFocus(i) {
    this.focus = i;
    const focused = this.buttons[i];
    this.arrow.setVisible(Boolean(focused));
    if (focused) {
      this.arrow.setPosition(
        focused.x - ARROW_GAP - ARROW.w,
        focused.top + Math.floor((focused.h - 1 - ARROW.h) / 2),
      );
    }
    this.buttons.forEach(({ image }, b) => image.setTint(b === i ? 0xffffff : UNFOCUSED_TINT));
  }

  // Up or down to the next button that can be picked, stopping at the ends.
  moveFocus(step) {
    for (let i = this.focus + step; i >= 0 && i < this.buttons.length; i += step) {
      if (this.canFocus(i)) {
        this.setFocus(i);
        return;
      }
    }
  }

  choose(i) {
    if (!this.isOpen || !this.canFocus(i)) return;
    const { onPick } = this.page.buttons[i];
    this.close();
    if (onPick) onPick();
  }

  // Esc: back out of the page.
  cancel() {
    if (!this.isOpen) return;
    const { onCancel } = this.page;
    this.close();
    if (onCancel) onCancel();
  }

  close() {
    this.isOpen = false;
    this.page = null;
    this.root.setVisible(false);
    this.backdrop.setVisible(false);
    this.scene.input.setDefaultCursor('default');
  }

  // Center in a view of the given size, in screen pixels. Called with nothing, it centers
  // again in the same view (the panel's height changes from page to page).
  place(viewWidth = this.view.width, viewHeight = this.view.height, scale = this.view.scale) {
    this.view = { width: viewWidth, height: viewHeight, scale };
    this.backdrop.setSize(viewWidth, viewHeight);
    this.root.setScale(scale);
    this.root.setPosition(
      Math.round((viewWidth - PANEL.width * scale) / 2),
      Math.round((viewHeight - this.height * scale) / 2),
    );
  }
}
