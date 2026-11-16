import test from 'node:test';
import assert from 'node:assert/strict';

import { GENETICS_SCHEMA_VERSION, PLAYER_ID, YEAR_DAYS, DEFECTS } from '../config.js';
import Genetics from '../Genetics.js';
import Emitter from '../events.js';
import Modifiers from '../modifiers.js';
import { serialize, deserialize } from '../serialize.js';
import { genotype } from '../genome.js';
import { makeWorld, adult, eventLog } from './helpers.js';

// Play a world on for a while: the player breeds, tests, and lets the days pass.
function play(world, days) {
  const studs = () => world.pedigree.living().filter((a) => a.sex === 'M');
  for (let i = 0; i < days; i++) {
    const day = world.day + 1;
    world.tick(day);
    if (day % 5 !== 0) continue;
    world.pedigree.herdOf(PLAYER_ID).filter((a) => a.sex === 'F').forEach((dam, n) => {
      const sire = studs()[(day + n) % studs().length];
      world.breeding.attemptConception(sire.id, dam.id, day);
      world.breeding.spitOffTest(dam.id, day);
    });
  }
  return world;
}
const snapshot = (world) => ({
  day: world.day,
  rng: world.rng.save(),
  nextId: world.pedigree.nextId,
  recorded: [...world.quipu.recorded],
  animals: world.pedigree.all(),
});
const throughJson = (world) => deserialize(JSON.parse(JSON.stringify(serialize(world))));

test('round trip: a loaded world is the saved world', () => {
  const world = play(Genetics.newGame({ seed: 41 }), 2 * YEAR_DAYS + 50);
  // The save must catch things in mid-flight: a pregnancy under way, the dead, matings
  // and births on record.
  const all = world.pedigree.all();
  assert.ok(all.some((a) => a.pregnancy), 'someone is pregnant');
  assert.ok(all.some((a) => !a.alive && a.deathCause !== 'ancestor'), 'someone died');
  assert.ok(all.some((a) => a.lastBirthDay !== null) && all.some((a) => a.lastMating));

  const loaded = throughJson(world);
  assert.deepEqual(snapshot(loaded), snapshot(world));
  assert.deepEqual(serialize(loaded), serialize(world));
  // Kinship, which is worked out rather than saved, comes out the same.
  const mine = world.pedigree.herdOf(PLAYER_ID);
  mine.forEach((a) => mine.forEach((b) => {
    assert.equal(loaded.pedigree.kinship(a.id, b.id), world.pedigree.kinship(a.id, b.id));
  }));
  assert.deepEqual(loaded.quipu.getPlayerView(mine[0].id, 3), world.quipu.getPlayerView(mine[0].id, 3));
});

test('round trip: the same future, roll for roll', () => {
  const world = play(Genetics.newGame({ seed: 42 }), YEAR_DAYS);
  const loaded = throughJson(world);
  const [logA, logB] = [eventLog(world), eventLog(loaded)];
  play(world, 2 * YEAR_DAYS);
  play(loaded, 2 * YEAR_DAYS);
  assert.deepEqual(snapshot(loaded), snapshot(world));
  assert.deepEqual(logB, logA);
  assert.ok(logA.filter((e) => e.name === 'cria_born').length > 5, 'and plenty happened in it');
  assert.equal(loaded.rng.next(), world.rng.next());
});

test('round trip: every state an animal can be in', () => {
  const world = makeWorld(43);
  world.day = 77;
  world.modifiers.register({ id: 'charm' });
  const sire = adult(world, 'M', { loci: { FLEECE: ['Su', 'hu'], CHOANAL: ['N', 'd'] }, bv: { shade: 0.123456789 } });
  const dam = adult(world, 'F', { flags: { blueEyed: true, deaf: true, deafKnown: true }, ownerId: null });
  Object.assign(dam, {
    name: 'Ñusta', modifiers: ['charm'], lastBirthDay: 12, lastMating: { sireId: sire.id, day: 70 },
    pregnancy: { sireId: sire.id, conceivedDay: 70, dueDay: 101, modifiers: ['charm'], known: true },
  });
  const doomed = adult(world, 'F', { loci: { CHOANAL: ['d', 'd'] }, sireId: sire.id, damId: dam.id, F: 0.125, age: 1 });
  doomed.fate = { day: 79, cause: 'defect:choanal_atresia' };
  const dead = adult(world, 'M');
  world.die(dead, 60, 'weak_cria');
  const ancestor = adult(world, 'F');
  Object.assign(ancestor, { alive: false, deathCause: 'ancestor' });
  world.quipu.record(dam.id);
  world.pedigree.nextId = 40; // ids are never reused, even if the last animals were...

  const loaded = deserialize(JSON.parse(JSON.stringify(serialize(world))), { modifiers: world.modifiers });
  assert.deepEqual(snapshot(loaded), snapshot(world));
  assert.equal(loaded.pedigree.get(dam.id).name, 'Ñusta');
  assert.equal(adult(loaded, 'F').id, 40);
  // The loaded animals are their own objects, not the saved ones.
  loaded.pedigree.get(dam.id).pregnancy.known = false;
  assert.equal(dam.pregnancy.known, true);
});

test('a loaded world is wired to the events, hooks and modifiers it is given', () => {
  const world = makeWorld(44);
  const sire = adult(world, 'M');
  const dam = adult(world, 'F');
  dam.pregnancy = { sireId: sire.id, conceivedDay: 0, dueDay: 3, modifiers: ['m'], known: false };

  const events = new Emitter();
  const modifiers = new Modifiers();
  const calls = [];
  modifiers.register({ id: 'm', onBirth: () => calls.push('onBirth') });
  events.on('cria_born', () => calls.push('cria_born'));
  const hooks = { getNutritionScore: () => { calls.push('nutrition'); return 0; } };
  const loaded = deserialize(serialize(world), { events, hooks, modifiers });
  loaded.tick(3);
  assert.ok(calls.includes('cria_born') && calls.includes('onBirth') && calls.includes('nutrition'));
  assert.equal(typeof hooks.canUseStud, 'function', 'hooks that weren\'t given are neutral');
});

test('saves outlive growth: a defect or a trait added to the game later', () => {
  const world = play(Genetics.newGame({ seed: 45 }), 40);
  const data = JSON.parse(JSON.stringify(serialize(world)));

  // As if saved before polydactyly existed, and before density was a trait.
  const locusAt = data.loci.indexOf(DEFECTS.polydactyly.locus);
  const traitAt = data.traits.indexOf('density');
  data.loci.splice(locusAt, 1);
  data.traits.splice(traitAt, 1);
  data.animals.forEach((row) => {
    row.genes = row.genes.slice(0, 2 * locusAt) + row.genes.slice(2 * locusAt + 2);
    row.bv.splice(traitAt, 1);
    row.env.splice(traitAt, 1);
  });

  const loaded = deserialize(data);
  loaded.pedigree.all().forEach((alpaca) => {
    const original = world.pedigree.get(alpaca.id);
    assert.deepEqual(genotype(alpaca.genome, DEFECTS.polydactyly.locus), ['N', 'N'], 'reads as normal');
    assert.equal(alpaca.genome.breedingValues.density, 0, 'average for the new trait');
    assert.equal(alpaca.permEnv.density, 0);
    assert.deepEqual(alpaca.genome.loci.MC1R, original.genome.loci.MC1R);
    assert.equal(alpaca.genome.breedingValues.size, original.genome.breedingValues.size);
  });
  const [someone] = loaded.pedigree.herdOf(PLAYER_ID);
  assert.equal(loaded.phenotype(someone, someone.birthDay + 400).density > 0, true);
  // ...and it plays on: the old animals breed, and their crias have the new locus.
  play(loaded, 2 * YEAR_DAYS);
  const born = loaded.pedigree.all().filter((a) => a.birthDay > 40);
  assert.ok(born.length > 0 && born.every((a) => a.genome.loci[DEFECTS.polydactyly.locus].join('') === 'NN'));
  assert.equal(serialize(loaded).loci.length, serialize(world).loci.length, 'saved again in full');

  // A locus or trait the game no longer has is dropped.
  const extra = JSON.parse(JSON.stringify(serialize(world)));
  extra.loci.push('GONE');
  extra.traits.push('gone');
  extra.animals.forEach((row) => { row.genes += '01'; row.bv.push(1); row.env.push(1); });
  assert.deepEqual(snapshot(deserialize(extra)), snapshot(world));
});

test('bad data is refused whole', () => {
  const good = () => JSON.parse(JSON.stringify(serialize(play(Genetics.newGame({ seed: 46 }), 30))));
  const broken = (edit) => { const data = good(); edit(data); return () => deserialize(data); };

  assert.doesNotThrow(() => deserialize(good()));
  assert.throws(() => deserialize(null));
  assert.throws(broken((d) => { delete d.geneticsSchemaVersion; }));
  assert.throws(broken((d) => { d.geneticsSchemaVersion = GENETICS_SCHEMA_VERSION + 1; }), (e) => e.newer === true);
  assert.throws(broken((d) => { d.rng = [1, 2, 3]; }));
  assert.throws(broken((d) => { d.day = -1; }));
  assert.throws(broken((d) => { d.animals[30].genes = d.animals[30].genes.replace(/^../, '07'); }), /genotype/);
  assert.throws(broken((d) => { d.animals[30].genes += '0'; }), /genes/);
  assert.throws(broken((d) => { d.animals[30].bv[0] = 'fine'; }), /trait values/);
  assert.throws(broken((d) => { d.animals[30].bv[0] = null; }));
  assert.throws(broken((d) => { d.animals[30].sex = 'X'; }));
  assert.throws(broken((d) => { d.animals.find((a) => a.sireId !== null).sireId = 99999; }), /parent/);
  assert.throws(broken((d) => { d.animals[5].id = d.animals[4].id; }));
  assert.throws(broken((d) => {
    const { sireId } = d.animals.find((a) => a.sireId !== null);
    d.animals.splice(d.animals.findIndex((a) => a.id === sireId), 1);
  }), /parent/);
  assert.throws(broken((d) => { d.recorded.push(99999); }), /record/);
  assert.throws(broken((d) => { d.nextId = 3; }));
  assert.throws(broken((d) => { const i = d.loci.indexOf('MC1R'); d.loci[i] = 'XXXX'; }), /MC1R/);
});

test('a new game\'s save is a sensible size', () => {
  const bytes = JSON.stringify(serialize(Genetics.newGame({ seed: 47 }))).length;
  assert.ok(bytes < 200_000, `${bytes} bytes`);
});
