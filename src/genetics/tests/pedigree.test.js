import test from 'node:test';
import assert from 'node:assert/strict';

import Pedigree, { Kinship } from '../pedigree.js';

// A pedigree builder: born(sire, dam) registers an animal a day later than the last.
function family() {
  const pedigree = new Pedigree();
  let day = 0;
  const born = (sire = null, dam = null) => pedigree.add({
    sireId: sire, damId: dam, birthDay: day++, alive: true, ownerId: 'test',
  }).id;
  return { pedigree, born, k: (a, b) => pedigree.kinship(a, b) };
}

test('kinship of the textbook relationships', () => {
  const { born, k } = family();
  const [gs1, gd1, gs2, gd2, stranger] = [born(), born(), born(), born(), born()];
  const sire = born(gs1, gd1);
  const uncle = born(gs1, gd1); // full sibling of `sire`
  const dam = born(gs2, gd2);
  const aunt = born(gs2, gd2);
  const cria = born(sire, dam);
  const fullSib = born(sire, dam);
  const halfSib = born(sire, aunt);
  const cousin = born(uncle, born());
  const doubleCousin = born(uncle, aunt);

  assert.equal(k(gs1, gd1), 0, 'unrelated');
  assert.equal(k(cria, stranger), 0, 'unrelated');
  assert.equal(k(cria, cria), 0.5, 'itself');
  assert.equal(k(sire, cria), 0.25, 'parent and offspring');
  assert.equal(k(cria, dam), 0.25, 'parent and offspring, either order');
  assert.equal(k(cria, fullSib), 0.25, 'full siblings');
  assert.equal(k(cria, halfSib), 0.125 + 0.0625, 'half siblings whose dams are sisters');
  assert.equal(k(sire, uncle), 0.25, 'full siblings');
  assert.equal(k(cria, gs1), 0.125, 'grandparent and grandchild');
  assert.equal(k(cria, uncle), 0.125, 'uncle and niece');
  assert.equal(k(cria, cousin), 0.0625, 'first cousins');
  assert.equal(k(cria, doubleCousin), 0.125, 'double first cousins');
});

test('half siblings, plainly', () => {
  const { born, k } = family();
  const sire = born();
  const a = born(sire, born());
  const b = born(sire, born());
  assert.equal(k(a, b), 0.125);
});

test('inbreeding coefficient: a cria\'s F is its parents\' kinship', () => {
  const { pedigree, born, k } = family();
  const F = (id) => { const a = pedigree.get(id); return k(a.sireId, a.damId); };
  const [s, d] = [born(), born()];
  const [b1, b2] = [born(s, d), born(s, d)];
  const fromSibs = born(b1, b2);
  const fromParent = born(s, b2);
  const sire2 = born();
  const fromHalfSibs = born(born(sire2, born()), born(sire2, born()));

  assert.equal(F(s), 0, 'a founder');
  assert.equal(F(b1), 0, 'unrelated parents');
  assert.equal(F(fromSibs), 0.25, 'full-sibling mating');
  assert.equal(F(fromParent), 0.25, 'parent-offspring mating');
  assert.equal(F(fromHalfSibs), 0.125, 'half-sibling mating');
  assert.equal(k(fromSibs, fromSibs), 0.625, 'an inbred animal is closer to itself');

  // Two generations of full-sibling mating in a row.
  const [c1, c2] = [born(b1, b2), born(b1, b2)];
  assert.equal(F(born(c1, c2)), 0.375);
});

test('kinship does not depend on the order animals are asked about', () => {
  const { pedigree, born } = family();
  const ids = [born(), born(), born()];
  for (let i = 0; i < 40; i++) {
    ids.push(born(ids[(i * 7) % ids.length], ids[(i * 11 + 3) % ids.length]));
  }
  const table = (order) => {
    const kin = new Kinship((id) => pedigree.get(id));
    const out = {};
    order.forEach((a) => order.forEach((b) => { out[`${Math.min(a, b)}:${Math.max(a, b)}`] = kin.between(a, b); }));
    return out;
  };
  assert.deepEqual(table([...ids].reverse()), table(ids));
  ids.forEach((a) => ids.forEach((b) => assert.equal(pedigree.kinship(a, b), pedigree.kinship(b, a))));
});

test('unknown animals are unrelated to everything', () => {
  const { born, k } = family();
  const a = born();
  assert.equal(k(a, null), 0);
  assert.equal(k(null, null), 0);
  assert.equal(k(a, 999), 0);
});

test('a view that knows fewer parents sees less kinship', () => {
  const { pedigree, born, k } = family();
  const [s, d] = [born(), born()];
  const [a, b] = [born(s, d), born(s, d)];
  assert.equal(k(a, b), 0.25);
  // The same two animals, with b's parents not on record.
  const partial = new Kinship((id) => {
    const alpaca = pedigree.get(id);
    return id === b ? { ...alpaca, sireId: null, damId: null } : alpaca;
  });
  assert.equal(partial.between(a, b), 0);
  assert.equal(partial.between(a, s), 0.25);
});

test('ancestors and descendants, by generation', () => {
  const { pedigree, born } = family();
  const [gs, gd, other] = [born(), born(), born()];
  const sire = born(gs, gd);
  const dam = born(gs, other); // half sibling of the sire
  const cria = born(sire, dam);
  const grandCria = born(cria, born());

  assert.deepEqual(pedigree.getAncestors(cria, 1), [{ id: sire, generation: 1 }, { id: dam, generation: 1 }]);
  assert.deepEqual(
    pedigree.getAncestors(cria).map((a) => `${a.id}@${a.generation}`).sort(),
    [`${sire}@1`, `${dam}@1`, `${gs}@2`, `${gd}@2`, `${other}@2`].sort(),
    'the shared grandsire is listed once',
  );
  assert.deepEqual(pedigree.getAncestors(gs), []);
  assert.deepEqual(pedigree.getDescendants(gs).map((a) => `${a.id}@${a.generation}`).sort(), [
    `${sire}@1`, `${dam}@1`, `${cria}@2`, `${grandCria}@3`,
  ].sort());
  assert.deepEqual(pedigree.getDescendants(gs, 1).map((a) => a.id), [sire, dam]);
  assert.deepEqual(pedigree.offspringOf(cria).map((a) => a.id), [grandCria]);
  assert.deepEqual(pedigree.tree(cria, 1), { id: cria, sire: { id: sire }, dam: { id: dam } });
  assert.equal(pedigree.tree(gs, 2).sire, null);
});

test('the registry keeps everyone, and hands out ids in order', () => {
  const { pedigree, born } = family();
  const a = born();
  const b = born();
  assert.deepEqual([a, b], [1, 2]);
  pedigree.get(a).alive = false;
  assert.equal(pedigree.all().length, 2);
  assert.deepEqual(pedigree.living().map((x) => x.id), [b]);
  assert.deepEqual(pedigree.herdOf('test').map((x) => x.id), [b]);
  assert.throws(() => pedigree.add({ id: b, sireId: null, damId: null }));
  assert.throws(() => pedigree.need(77));
  // An animal loaded with its own id moves the counter past it.
  pedigree.add({ id: 10, sireId: null, damId: null, birthDay: 5, alive: true });
  assert.equal(born(), 11);
});
