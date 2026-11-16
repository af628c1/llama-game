// The state of the things in the world. For now that is the objects in rooms that look
// different by state — the shed's trough 'empty' or 'full', its dung pile '0' to '2' —
// kept here rather than in the room's scene so that they are saved, and so that they can
// change while the rancher is somewhere else.

import Section from './Section.js';

export default class WorldState extends Section {
  static fields() {
    return {
      // interior id -> object id -> state. An object that has never been changed isn't
      // listed, and shows the `defaultState` of its interior spec.
      objectStates: {},
    };
  }

  // The state an object was last put in, or undefined if it never has been.
  objectState(interior, objectId) {
    const room = this.objectStates[interior];
    return room && Object.hasOwn(room, objectId) ? room[objectId] : undefined;
  }

  setObjectState(interior, objectId, state) {
    if (!Object.hasOwn(this.objectStates, interior)) this.objectStates[interior] = {};
    this.objectStates[interior][objectId] = state;
  }
}
