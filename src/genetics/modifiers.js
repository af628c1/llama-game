// Modifiers: the hook through which blessings, charms and the like will bend the genetics
// (the chullumpi goes here, once its effect is designed). A modifier is an object with an
// id and any of four hooks:
//
//   {
//     id: 'chullumpi',
//     onConception(ctx)        -> ctx      a mating is about to be rolled: ctx.chance can be
//                                          changed. ctx = { sire, dam, day, chance }
//     onGenome(genome, ctx)    -> genome   a cria's genome has just been put together.
//                                          ctx = { sire, dam, day }
//     onPhenotype(alpaca, traits) -> traits  whenever the traits of an animal carrying
//                                          the modifier are worked out
//     onBirth(cria, ctx)                   the cria has been born (alive or not).
//                                          ctx = { sire, dam, day }
//   }
//
// A hook that returns nothing leaves things as they were. Modifiers are registered once,
// in code, when the game starts; matings name the ones that apply by id
// (attemptConception's last argument). The ids travel with the pregnancy and then with the
// cria, and only ids are ever saved — so a modifier must be registered again before a
// saved game that uses it is played on. None are registered by default.

export default class Modifiers {
  constructor() {
    this.byId = new Map();
  }

  register(modifier) {
    if (!modifier || typeof modifier.id !== 'string') throw new Error('a modifier needs an id');
    this.byId.set(modifier.id, modifier);
    return modifier;
  }

  unregister(id) {
    this.byId.delete(id);
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  // The ids of a list of modifiers, given as ids or as the objects themselves.
  ids(list = []) {
    return list.map((entry) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      if (!this.byId.has(id)) throw new Error(`modifier '${id}' is not registered`);
      return id;
    });
  }

  // The registered modifiers for a list of ids. An id that is no longer registered (the
  // modifier was taken out of the game) is skipped.
  resolve(ids = []) {
    return ids.map((id) => this.byId.get(id)).filter(Boolean);
  }
}
