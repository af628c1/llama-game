// The pedigree: the registry of every alpaca ever born — the dead included, because how
// inbred a cria is depends on ancestors long gone — and the kinship between any two.
//
// Kinship (the coefficient of coancestry) is the chance that an allele taken at random
// from one animal and one taken from the other are copies of the same ancestral allele:
//
//   kinship(a, b) = 0                               if either is unknown
//   kinship(a, a) = (1 + F(a)) / 2
//   kinship(a, b) = (kinship(x.sire, y) + kinship(x.dam, y)) / 2
//                   where x is whichever of the two was born later, and y the other
//   F(a)          = kinship(a.sire, a.dam)          the inbreeding coefficient
//
// So a parent and its offspring, or two full siblings, have kinship 0.25; half siblings
// 0.125; first cousins 0.0625. A cria's F is its parents' kinship.

// Kinship over any view of who an animal's parents are. `lookup(id)` gives
// { id, birthDay, sireId, damId } for an animal — the registry answers with the truth,
// the quipu (quipu.js) with only as much of it as the player has on record.
export class Kinship {
  constructor(lookup) {
    this.lookup = lookup;
    this.memo = new Map();
  }

  // Forget what has been worked out. Needed when the view changes: when an animal's
  // parents become known that weren't. (Births never change an answer already given.)
  clear() {
    this.memo.clear();
  }

  between(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return 0;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const known = this.memo.get(key);
    if (known !== undefined) return known;

    const A = this.lookup(a);
    const B = this.lookup(b);
    let value = 0;
    if (A && B) {
      if (a === b) {
        value = (1 + this.between(A.sireId, A.damId)) / 2;
      } else {
        // Go up from the younger of the two, so that the recursion can never pass the
        // other animal on its way to their common ancestors.
        const aIsLater = A.birthDay > B.birthDay || (A.birthDay === B.birthDay && a > b);
        const [x, y] = aIsLater ? [A, b] : [B, a];
        value = (this.between(x.sireId, y) + this.between(x.damId, y)) / 2;
      }
    }
    this.memo.set(key, value);
    return value;
  }
}

export default class Pedigree {
  constructor() {
    this.animals = new Map(); // id -> alpaca, in order of registration
    this.children = new Map(); // id -> ids of its offspring
    this.nextId = 1;
    this.kin = new Kinship((id) => this.animals.get(id) || null);
  }

  // Register an animal, giving it the next id unless it already has one (when loading).
  add(alpaca) {
    if (alpaca.id === undefined || alpaca.id === null) alpaca.id = this.nextId;
    if (this.animals.has(alpaca.id)) throw new Error(`pedigree already has an animal ${alpaca.id}`);
    this.nextId = Math.max(this.nextId, alpaca.id + 1);
    this.animals.set(alpaca.id, alpaca);
    [alpaca.sireId, alpaca.damId].forEach((parentId) => {
      if (parentId === null) return;
      if (!this.children.has(parentId)) this.children.set(parentId, []);
      this.children.get(parentId).push(alpaca.id);
    });
    return alpaca;
  }

  get(id) {
    return this.animals.get(id) || null;
  }

  // Like get(), for when not finding the animal is a mistake.
  need(id) {
    const alpaca = this.animals.get(id);
    if (!alpaca) throw new Error(`there is no alpaca ${id}`);
    return alpaca;
  }

  all() {
    return [...this.animals.values()];
  }

  living() {
    return this.all().filter((alpaca) => alpaca.alive);
  }

  // The living animals of an owner.
  herdOf(ownerId) {
    return this.living().filter((alpaca) => alpaca.ownerId === ownerId);
  }

  offspringOf(id) {
    return (this.children.get(id) || []).map((childId) => this.animals.get(childId));
  }

  // Kinship between two animals (by id): see the top of this file. This is also the
  // inbreeding coefficient their cria would have, so it can warn about a pairing before
  // it is made.
  kinship(idA, idB) {
    return this.kin.between(idA, idB);
  }

  // An animal's ancestors up to `generations` back: [{ id, generation }], parents being
  // generation 1, nearest first. An ancestor reached by more than one path is listed once,
  // at its nearest.
  getAncestors(id, generations = Infinity) {
    return this.walk(id, generations, (alpaca) => [alpaca.sireId, alpaca.damId]);
  }

  // An animal's descendants: [{ id, generation }], its own offspring being generation 1.
  getDescendants(id, generations = Infinity) {
    return this.walk(id, generations, (alpaca) => this.children.get(alpaca.id) || []);
  }

  walk(id, generations, next) {
    const found = new Map();
    let frontier = [id];
    for (let generation = 1; generation <= generations && frontier.length; generation++) {
      const reached = [];
      frontier.forEach((currentId) => {
        const current = this.animals.get(currentId);
        if (!current) return;
        next(current).forEach((otherId) => {
          if (otherId === null || found.has(otherId) || !this.animals.has(otherId)) return;
          found.set(otherId, generation);
          reached.push(otherId);
        });
      });
      frontier = reached;
    }
    return [...found].map(([foundId, generation]) => ({ id: foundId, generation }));
  }

  // An animal's family tree as nested { id, sire, dam }, `generations` deep, for printing.
  tree(id, generations) {
    const alpaca = this.get(id);
    if (!alpaca) return null;
    if (generations <= 0) return { id };
    return {
      id,
      sire: this.tree(alpaca.sireId, generations - 1),
      dam: this.tree(alpaca.damId, generations - 1),
    };
  }
}
