// Everything about a playthrough that a save file must hold, in one object. It is made of
// sections — the clock and weather, where the rancher is, the state of the world, the
// alpacas — and is kept in the registry as 'state', where every scene can reach it:
//
//   const state = this.registry.get('state');
//   state.time.isNight, state.world.objectState('shed', 'feed_trough'), ...
//
// The rule that keeps saves complete: whatever changes during play and should still be
// so tomorrow lives in a section. Scenes and sprites show the state; they don't own it.
// (The one thing a scene does own, where the rancher is standing right now, it hands
// over in savePlace() at the moment of saving.)
//
// MAKING SOMETHING NEW SAVEABLE
//   Write a section for it (Section.js shows the short way) and add it to SECTIONS
//   below. It is then created with every new game, written into every save, and read
//   back from every save that has it. A save from before the section existed loads with
//   it as in a new game. Nothing else — the save store, the menu — needs to change.
//
// Always reach a section through the state (`state.time`), and don't keep it in a
// variable for longer than a scene lives: loading a game replaces every section.

import SaveError from '../save/SaveError.js';
import TimeState from './TimeState.js';
import PlayerState from './PlayerState.js';
import WorldState from './WorldState.js';
import StatsState from './StatsState.js';
import GeneticsState from './GeneticsState.js';

// The sections, by the name they have on the state and in save files. Renaming one
// orphans its data in existing saves, so don't.
export const SECTIONS = {
  time: TimeState,
  player: PlayerState,
  world: WorldState,
  stats: StatsState,
  genetics: GeneticsState,
};

// Bring one section's saved { version, data } up to the version the game is at now.
function upToDate(Section, saved) {
  const { version, data } = saved;
  if (!Number.isInteger(version) || version < 1 || data === null || typeof data !== 'object') {
    throw new SaveError('damaged');
  }
  if (version > Section.version) throw new SaveError('newer');

  let current = data;
  for (let v = version; v < Section.version; v++) current = Section.migrations[v](current);
  return current;
}

export default class GameState {
  // A new game. `content` is what sections need to know about the game itself, from the
  // art packs: { events } — the HUD pack's list of festivals and birthdays.
  constructor(content) {
    this.content = content;
    this.adopt(this.build({}));
  }

  // The whole state as plain data: { <section>: { version, data } }.
  save() {
    const saved = {};
    Object.entries(SECTIONS).forEach(([name, Section]) => {
      saved[name] = { version: Section.version, data: this[name].save() };
    });
    return saved;
  }

  // Make a full set of sections from saved data, without touching the game in play: a
  // section the save doesn't have comes out as in a new game. Throws a SaveError if any
  // of it can't be used, so a load is all or nothing.
  build(saved) {
    const sections = {};
    Object.entries(SECTIONS).forEach(([name, Section]) => {
      const section = new Section(this.content);
      if (Object.hasOwn(saved, name)) {
        try {
          section.load(upToDate(Section, saved[name]));
        } catch (e) {
          throw e instanceof SaveError ? e : new SaveError('damaged', e);
        }
      }
      sections[name] = section;
    });
    return sections;
  }

  // Switch the game over to a set of sections made by build().
  adopt(sections) {
    Object.assign(this, sections);
  }

  // A night passes: the clock moves on to the next morning, and everything that lives by
  // the day has its day. This is the one way a new day begins — whatever needs a daily
  // tick is given it here.
  nextDay() {
    this.time.sleep();
    this.genetics.world.tick(this.time.absoluteDay);
  }

  // The few words the menu shows for a slot holding this game.
  get summary() {
    const { time, player } = this;
    return {
      date: time.dateText,
      year: time.yearText,
      clock: time.clockText,
      place: player.place ? player.place.name : '',
    };
  }
}
