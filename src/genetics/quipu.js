// Placeholder for the first breeding step: the quipu's records. Rewritten in full in the
// quipu step.

import { PLAYER_ID } from './config.js';

export default class Quipu {
  constructor(world) {
    this.world = world;
    this.recorded = new Set();
  }

  record(id) {
    this.recorded.add(id);
  }

  isRecorded(id) {
    return this.recorded.has(id);
  }

  onMating(sire, dam) {
    if (dam.ownerId === PLAYER_ID || sire.ownerId === PLAYER_ID) {
      this.record(sire.id);
      this.record(dam.id);
    }
  }

  onBirth(cria) {
    if (cria.ownerId === PLAYER_ID) this.record(cria.id);
  }
}
