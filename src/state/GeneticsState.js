// The alpacas: the `genetics` section of the game state. It holds the genetics world
// (src/genetics/Genetics.js) — every animal, its hidden genes, the pregnancies under way,
// the player's records — so that all of it is saved and loaded with the game.
//
//   const { world } = this.registry.get('state').genetics;
//   world.quipu.getPlayerView(id, skill)     what the screen may show of an animal
//   world.breeding.attemptConception(...)    and so on: see src/genetics/README.md
//
// Loading a game replaces the world, so don't keep `world` in a variable for long; reach
// it through the state. What must outlive a world is in `genetics` below: listen for
// events, set hooks and register modifiers there, once, when the game starts.

import Genetics from '../genetics/Genetics.js';
import Emitter from '../genetics/events.js';
import Modifiers from '../genetics/modifiers.js';
import { serialize, deserialize } from '../genetics/serialize.js';
import SaveError from '../save/SaveError.js';

// The game's side of the genetics, shared by every world there will be:
//   events     genetics.events.on('cria_born', ({ criaId }) => ...)   (genetics/events.js)
//   hooks      getNutritionScore, getWeatherStress, canUseStud: neutral until they are set
//   modifiers  genetics.modifiers.register({ id, onConception, ... })   (genetics/modifiers.js)
export const genetics = {
  events: new Emitter(),
  hooks: {},
  modifiers: new Modifiers(),
};

export default class GeneticsState {
  // The saved data carries a version of its own (geneticsSchemaVersion) and is brought up
  // to date by genetics/serialize.js, so this one stays at 1.
  static version = 1;
  static migrations = {};

  // A new game. Its herds are bred from this seed the first time the world is asked
  // for — the same herds whenever that is — so that making a state costs nothing.
  constructor() {
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.made = null;
  }

  get world() {
    if (!this.made) this.made = Genetics.newGame({ seed: this.seed, ...genetics });
    return this.made;
  }

  save() {
    return serialize(this.world);
  }

  load(data) {
    try {
      this.made = deserialize(data, genetics);
    } catch (e) {
      throw e.newer ? new SaveError('newer', e) : e;
    }
  }
}
