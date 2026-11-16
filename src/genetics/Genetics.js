// The genetics world: every alpaca there is or has been, and the rules by which they
// breed. It is pure logic — no rendering, no Phaser — that the game holds in its state
// (state/GeneticsState.js) and the tests run on their own.
//
//   world.pedigree   the registry of animals; kinship, ancestors, descendants
//   world.breeding   canBreed, attemptConception, spitOffTest, giveBirth
//   world.quipu      what the player knows: getPlayerView, getPairingForecast
//   world.modifiers  the registry of blessings and the like
//   world.events     conceived, cria_born, cria_died... (events.js)
//   world.rng        the seeded random numbers everything draws from
//   world.day        the last day that was ticked
//
// THE FRONT END READS ANIMALS ONLY THROUGH world.quipu. Everything else here knows
// things the player doesn't: genotypes, breeding values, unannounced pregnancies.
//
// The world asks the rest of the game three things, through `hooks`. All are neutral
// until the systems behind them exist:
//   getNutritionScore(alpacaId) -> -1 (starving) .. 1 (perfectly fed)     now 0
//   getWeatherStress(day)       -> 0 (fair) .. 1 (the worst)              now 0
//   canUseStud(sireId, ownerId) -> may this owner use another's stud?     now true

import { WORLD_HERDS, PLAYER_ID } from './config.js';
import Rng from './rng.js';
import Emitter from './events.js';
import Pedigree from './pedigree.js';
import Modifiers from './modifiers.js';
import Breeding from './breeding.js';
import Quipu from './quipu.js';
import { getPhenotype } from './traits.js';
import { generateHerd } from './founders.js';

export const DEFAULT_HOOKS = {
  getNutritionScore: () => 0,
  getWeatherStress: () => 0,
  canUseStud: () => true,
};

export default class Genetics {
  // An empty world. `seed` fixes everything random that will ever happen in it. `events`,
  // `hooks` and `modifiers` can be handed in, to be shared with the game and to outlive
  // this world when a saved one is loaded in its place.
  constructor({ seed = 1, events = new Emitter(), hooks = {}, modifiers = new Modifiers() } = {}) {
    this.rng = new Rng(seed);
    this.events = events;
    this.modifiers = modifiers;
    this.hooks = hooks;
    Object.entries(DEFAULT_HOOKS).forEach(([name, neutral]) => {
      if (typeof hooks[name] !== 'function') hooks[name] = neutral;
    });

    this.day = 0;
    this.pedigree = new Pedigree();
    this.quipu = new Quipu(this);
    this.breeding = new Breeding(this);
  }

  // The world a new game starts in: the herds of WORLD_HERDS.
  static newGame(options) {
    const world = new Genetics(options);
    WORLD_HERDS.forEach(({ ownerId, bloodline, count }) => {
      world.generateHerd(bloodline, count, { ownerId });
    });
    return world;
  }

  // Add a herd of `count` animals of a bloodline (founders.js) to the world. The player's
  // own herd comes with its herd book: its ancestors are on record too. Other families'
  // are their own business until the story opens them (quipu.recordHerd).
  generateHerd(profile, count, { ownerId = null, day = this.day, rng = this.rng } = {}) {
    const herd = generateHerd(profile, count, rng, { pedigree: this.pedigree, ownerId, day });
    if (ownerId === PLAYER_ID) this.quipu.recordHerd(PLAYER_ID);
    return herd;
  }

  // An animal's traits on a day (traits.js), with its nutrition and its modifiers applied.
  // Takes the animal or its id. These are the true values: the player sees them only as
  // far as the quipu shows.
  phenotype(alpacaOrId, day = this.day) {
    const alpaca = typeof alpacaOrId === 'object' ? alpacaOrId : this.pedigree.need(alpacaOrId);
    return getPhenotype(alpaca, day, {
      nutritionScore: this.nutritionOf(alpaca),
      modifiers: this.modifiers.resolve(alpaca.modifiers),
    });
  }

  // How well fed an animal is, -1 to 1: the nutrition hook's answer. (An animal not in
  // the pedigree yet, a cria being born, has no id to ask about and is neutral.)
  nutritionOf(alpaca) {
    return alpaca.id === null ? 0 : this.hooks.getNutritionScore(alpaca.id);
  }

  // Death is permanent: the animal stays in the pedigree, marked dead, for good.
  die(alpaca, day, cause) {
    if (!alpaca.alive) return;
    alpaca.alive = false;
    alpaca.deathDay = day;
    alpaca.deathCause = cause;
    alpaca.pregnancy = null;
    alpaca.fate = null;
    this.events.emit('cria_died', { alpacaId: alpaca.id, day, cause });
  }

  // An animal changes hands. What comes into the player's herd goes on record.
  transfer(alpacaId, ownerId) {
    const alpaca = this.pedigree.need(alpacaId);
    alpaca.ownerId = ownerId;
    if (ownerId === PLAYER_ID) this.quipu.record(alpacaId);
  }

  // The daily tick: bring the world up to `day`, one day at a time. Call it whenever the
  // game's day changes; days that were skipped are caught up, and a day already ticked
  // is not ticked again.
  tick(day) {
    while (this.day < day) {
      this.day += 1;
      this.breeding.tick(this.day);
    }
  }
}
