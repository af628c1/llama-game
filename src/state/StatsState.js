// Numbers kept about the playthrough itself.

import Section from './Section.js';

export default class StatsState extends Section {
  static fields() {
    return {
      // Real milliseconds of play, not counting time spent in menus, questions or fades.
      playedMs: 0,
    };
  }
}
