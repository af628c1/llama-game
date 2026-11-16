// Where the rancher is. During play it is the world scene on screen that knows this, so
// `place` is only filled in at the moment of saving (by that scene's savePlace()), and
// read once after loading, to start the right scene with the rancher where they were.

import Section from './Section.js';

export default class PlayerState extends Section {
  static fields() {
    return {
      // null in a new game (the rancher starts at the ranch's spawn tile). Otherwise:
      //   scene    the key of the world scene to start
      //   data     what to start it with (for a room: { id })
      //   name     what the menu calls the place
      //   rancher  the rancher there, as Player.save() gave it
      place: null,
    };
  }

  load(data) {
    super.load(data);
    const { place } = this;
    if (place === null) return;
    const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isObject(place) || typeof place.scene !== 'string' || !isObject(place.data)
      || !isObject(place.rancher)) {
      throw new Error("'place' is not a place");
    }
  }
}
