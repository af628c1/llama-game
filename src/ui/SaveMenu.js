// The menu behind the button in the top-left corner: Save and Load, each leading to the
// list of save slots. It is a set of pages shown on the HUD's ChoicePanel, so the game is
// held still for as long as it is up.
//
//   Menu ─ Save ─ pick a slot ─ (Overwrite? if it holds a save) ─ saved, back at the slots
//        └ Load ─ pick a slot ─ Load? ─ the screen fades over to the loaded game
//
// Esc goes back a page; the menu button, or a click outside the panel, closes the menu.

import SaveError from '../save/SaveError.js';

// What to say when saving or loading can't be done, by SaveError kind.
const PROBLEMS = {
  blocked: 'This browser is blocking saves.',
  full: 'The browser has no room left.',
  failed: 'That did not work. Try again?',
  damaged: 'That save is damaged.',
  newer: 'That save needs a newer version.',
  empty: 'That slot is empty.',
};

// What a slot's card says when it doesn't hold a save that can be loaded.
const CARD_TEXT = {
  empty: 'Empty',
  damaged: 'Damaged save',
  newer: 'Newer version',
  blocked: 'Unavailable',
};

const TITLES = { save: 'Save game', load: 'Load game' };

export default class SaveMenu {
  // `store` is the SaveStore, for listing the slots. `save(slot)` and `load(slot)` do the
  // saving and loading (HudScene's saveGame and loadGame); they throw a SaveError when
  // they can't.
  constructor(panel, store, { save, load }) {
    this.panel = panel;
    this.store = store;
    this.actions = { save, load };
  }

  open() {
    this.showMain();
  }

  showMain(focus = 0) {
    this.panel.show({
      title: 'Menu',
      focus,
      buttons: [
        { label: 'Save', onPick: () => this.showSlots('save') },
        { label: 'Load', onPick: () => this.showSlots('load') },
        { label: 'Close' },
      ],
    });
  }

  // The slots, to save into or to load from. `note` is shown under them, and `focus` is
  // the slot to start on (otherwise the first that can be picked).
  showSlots(mode, { note = '', focus } = {}) {
    const slots = this.store.list();
    const back = () => this.showMain(mode === 'save' ? 0 : 1);

    const buttons = slots.map(({ slot, status, summary }) => ({
      card: {
        caption: `Slot ${slot}`,
        lines: status === 'ok'
          ? [String(summary.date), [summary.year, summary.clock, summary.place].filter(Boolean).join(' · ')]
          : [CARD_TEXT[status]],
      },
      // Any slot can be saved over; only a good save can be loaded.
      disabled: mode === 'load' && status !== 'ok',
      onPick: () => this.pick(mode, slot, status),
    }));
    buttons.push({ label: 'Back', onPick: back });

    this.panel.show({
      title: TITLES[mode],
      buttons,
      note,
      focus: focus === 'back' ? buttons.length - 1 : slots.findIndex((s) => s.slot === focus),
      onCancel: back,
    });
  }

  pick(mode, slot, status) {
    const again = () => this.showSlots(mode, { focus: slot });
    if (mode === 'save' && status === 'empty') {
      this.run(mode, slot); // nothing to lose: no need to ask
      return;
    }
    this.panel.show({
      title: mode === 'save' ? `Overwrite slot ${slot}?` : `Load slot ${slot}?`,
      buttons: [{ label: 'Yes', onPick: () => this.run(mode, slot) }, { label: 'No', onPick: again }],
      note: mode === 'load' ? 'Unsaved progress will be lost.' : '',
      onCancel: again,
    });
  }

  run(mode, slot) {
    try {
      this.actions[mode](slot);
    } catch (e) {
      if (!(e instanceof SaveError)) throw e;
      console.error(`Could not ${mode} slot ${slot}:`, e.kind, e.cause || '');
      this.showSlots(mode, { note: PROBLEMS[e.kind], focus: slot });
      return;
    }
    // A loaded game fades in with the menu gone. A saved one shows up in its slot.
    if (mode === 'save') this.showSlots(mode, { note: `Saved to slot ${slot}.`, focus: 'back' });
  }
}
