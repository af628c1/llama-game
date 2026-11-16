// The short way to write a section of the game state (see GameState.js): list its fields
// and their new-game values in `fields()`, and saving and loading are taken care of.
//
//   export default class Purse extends Section {
//     static fields() { return { coins: 50, bills: [] }; }
//   }
//
// Fields must be things JSON can hold: numbers, strings, true/false, null, and lists and
// objects of those. A section with more to it than that (TimeState) can be written by
// hand instead — all a section needs is a constructor that makes a new game's state,
// save() and load().
//
// CHANGING A SECTION LATER
//   - A new field: just add it to fields(). Loading a save from before it existed leaves
//     it at its new-game value.
//   - A field that changes meaning, name or shape: raise `version` by one and add a
//     migration from the old version, so old saves keep loading:
//
//       static version = 2;
//       static migrations = {
//         1: (data) => ({ ...data, coins: data.money }), // version 1 -> version 2
//       };

const kind = (value) => (Array.isArray(value) ? 'array' : typeof value);

export default class Section {
  static version = 1;
  static migrations = {};

  static fields() {
    return {};
  }

  // A new game.
  constructor() {
    Object.assign(this, this.constructor.fields());
  }

  // The section as plain data, for the save file.
  save() {
    const data = {};
    Object.keys(this.constructor.fields()).forEach((name) => { data[name] = this[name]; });
    return data;
  }

  // Take the saved data over. Throwing (anything) says the data is no good, and the
  // load is called off with the game left as it was.
  load(data) {
    Object.entries(this.constructor.fields()).forEach(([name, fresh]) => {
      if (!(name in data)) return;
      const value = data[name];
      // A field that starts as null can hold anything; the others must keep their type.
      if (fresh !== null && kind(value) !== kind(fresh)) {
        throw new Error(`'${name}' should be ${kind(fresh)}, not ${value === null ? 'null' : kind(value)}`);
      }
      this[name] = value;
    });
  }
}
