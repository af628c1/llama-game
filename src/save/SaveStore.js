// The save slots. Each slot is one entry in the browser's localStorage holding a save
// file as JSON:
//
//   { game, format, savedAt, summary, sections }
//
// `sections` is the whole GameState (state/GameState.js) — this file never looks inside
// it, so new kinds of state need no change here. `summary` is the few words the menu
// shows for the slot, and `savedAt` the real-world time of the save, in milliseconds.
//
// Saves belong to the address the game is served from: the same folder served on another
// port, or opened in another browser, has slots of its own.
//
// Everything that can go wrong is thrown as a SaveError, and nothing is ever half done:
// a save that can't be written leaves the slot as it was, and a slot that can't be read
// leaves the game as it was.

import { SAVE } from '../config.js';
import SaveError from './SaveError.js';

export default class SaveStore {
  constructor(state) {
    this.state = state;
  }

  // Run something against the browser's storage, which may be switched off altogether.
  withStorage(use) {
    let storage;
    try {
      storage = window.localStorage;
    } catch (e) {
      throw new SaveError('blocked', e);
    }
    if (!storage) throw new SaveError('blocked');
    try {
      return use(storage);
    } catch (e) {
      throw new SaveError(e.name === 'QuotaExceededError' ? 'full' : 'blocked', e);
    }
  }

  key(slot) {
    return `${SAVE.storageKey}${slot}`;
  }

  // Write the game as it is right now into a slot, replacing what was there.
  save(slot) {
    const text = JSON.stringify({
      game: SAVE.game,
      format: SAVE.format,
      savedAt: Date.now(),
      summary: this.state.summary,
      sections: this.state.save(),
    });

    // Never put a file in a slot that this game couldn't load again.
    try {
      this.parse(text);
    } catch (e) {
      throw new SaveError('failed', e);
    }

    this.withStorage((storage) => storage.setItem(this.key(slot), text));
    if (this.withStorage((storage) => storage.getItem(this.key(slot))) !== text) {
      throw new SaveError('failed');
    }
  }

  // Read a slot: { file, sections }, where `sections` are ready for GameState.adopt().
  // Reading changes nothing — the game only changes when the sections are adopted.
  load(slot) {
    const text = this.withStorage((storage) => storage.getItem(this.key(slot)));
    if (text === null) throw new SaveError('empty');
    return this.parse(text);
  }

  parse(text) {
    let file;
    try {
      file = JSON.parse(text);
    } catch (e) {
      throw new SaveError('damaged', e);
    }
    const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isObject(file) || file.game !== SAVE.game || !Number.isInteger(file.format)
      || !isObject(file.sections)) {
      throw new SaveError('damaged');
    }
    if (file.format > SAVE.format) throw new SaveError('newer');
    return { file, sections: this.state.build(file.sections) };
  }

  // What is in each slot, for the menu: { slot, status, summary }. `status` is 'ok' for
  // a save that can be loaded, and otherwise the kind of SaveError loading it would give
  // ('empty', 'damaged', 'newer', 'blocked'). `summary` is there when status is 'ok'.
  list() {
    return Array.from({ length: SAVE.slots }, (unused, i) => {
      const slot = i + 1;
      try {
        const { summary } = this.load(slot).file;
        return { slot, status: 'ok', summary: summary && typeof summary === 'object' ? summary : {} };
      } catch (e) {
        if (!(e instanceof SaveError)) throw e;
        return { slot, status: e.kind };
      }
    });
  }
}
