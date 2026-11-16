import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOUNDERS, BLOODLINES, WORLD_HERDS, PLAYER_ID, DEFECTS, MIN_BREED_AGE_M, MAX_BREED_AGE,
} from '../config.js';
import Genetics from '../Genetics.js';
import { LOCUS_NAMES, genotype, copies } from '../genome.js';
import { affectedBy, isCarrier, lethalDefect } from '../defects.js';
import { getFleece } from '../color.js';
import { bloodline } from '../founders.js';
import { makeWorld } from './helpers.js';

const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

test('a herd: the right number of living animals, of both sexes, old enough to breed', () => {
  const world = makeWorld(1);
  const herd = world.generateHerd('hardy_highland', 10, { ownerId: 'family:test', day: 50 });
  assert.equal(herd.length, 10);
  assert.deepEqual(world.pedigree.herdOf('family:test'), herd);
  assert.equal(herd.filter((a) => a.sex === 'F').length, Math.round(10 * FOUNDERS.femaleFraction));
  herd.forEach((a) => {
    const age = 50 - a.birthDay;
    assert.ok(age >= FOUNDERS.ageDays[0] && age <= FOUNDERS.ageDays[1], `age ${age}`);
    assert.ok(age >= MIN_BREED_AGE_M && age <= MAX_BREED_AGE);
    assert.equal(a.alive, true);
    assert.deepEqual(affectedBy(a.genome).filter((d) => DEFECTS[d].lethalWithinDays !== undefined), []);
  });

  // Small herds still get one of each sex.
  [2, 3, 4].forEach((count) => {
    const small = makeWorld(count).generateHerd('starter', count, { ownerId: 'x' });
    assert.ok(small.some((a) => a.sex === 'M') && small.some((a) => a.sex === 'F'), `herd of ${count}`);
  });
});

test('behind the herd are its ancestors: registered, dead, and older than their offspring', () => {
  const world = makeWorld(2);
  const herd = world.generateHerd('fine_fleece', 8, { ownerId: 'f' });
  const all = world.pedigree.all();
  const ancestors = all.filter((a) => !a.alive);
  assert.equal(all.length, FOUNDERS.baseSize + (FOUNDERS.generations - 1) * FOUNDERS.baseSize + 8);
  assert.ok(ancestors.every((a) => a.deathCause === 'ancestor' && a.ownerId === 'f'));
  assert.equal(all.filter((a) => a.sireId === null).length, FOUNDERS.baseSize, 'only the base animals have no parents');

  all.forEach((a) => {
    if (a.sireId === null) {
      assert.equal(a.damId, null);
      assert.equal(a.inbreedingF, 0);
      assert.deepEqual(affectedBy(a.genome), [], 'a base animal can carry a defect but never has one');
      return;
    }
    const sire = world.pedigree.get(a.sireId);
    const dam = world.pedigree.get(a.damId);
    assert.deepEqual([sire.sex, dam.sex], ['M', 'F']);
    assert.ok(a.birthDay - sire.birthDay >= MIN_BREED_AGE_M && a.birthDay > dam.birthDay);
    assert.equal(a.inbreedingF, world.pedigree.kinship(a.sireId, a.damId));
    assert.equal(lethalDefect(a.genome), null);
  });
  assert.equal(world.pedigree.getAncestors(herd[0].id, FOUNDERS.generations + 2)
    .filter((x) => x.generation === FOUNDERS.generations).length > 0, true);
});

test('a herd\'s animals are related to each other, and not to another family\'s', () => {
  const insideKinship = [];
  const inbreeding = [];
  for (let seed = 1; seed <= 20; seed++) {
    const world = makeWorld(seed);
    const ours = world.generateHerd('hardy_highland', 10, { ownerId: 'a' });
    const theirs = world.generateHerd('fine_fleece', 10, { ownerId: 'b' });
    ours.forEach((a) => {
      inbreeding.push(a.inbreedingF);
      ours.forEach((b) => { if (a.id < b.id) insideKinship.push(world.pedigree.kinship(a.id, b.id)); });
      theirs.forEach((b) => assert.equal(world.pedigree.kinship(a.id, b.id), 0));
    });
  }
  assert.ok(mean(insideKinship) > 0.05 && mean(insideKinship) < 0.2, `kinship within a herd ${mean(insideKinship)}`);
  assert.ok(mean(inbreeding) > 0.01 && mean(inbreeding) < 0.08, `mean F ${mean(inbreeding)}`);
  assert.ok(inbreeding.some((f) => f > 0) && inbreeding.some((f) => f === 0));
});

test('every animal\'s alleles come from its parents', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const world = Genetics.newGame({ seed });
    world.pedigree.all().forEach((a) => {
      if (a.sireId === null) return;
      const sire = world.pedigree.get(a.sireId).genome;
      const dam = world.pedigree.get(a.damId).genome;
      LOCUS_NAMES.forEach((locus) => {
        const [x, y] = genotype(a.genome, locus);
        const fits = (fromSire, fromDam) => copies(sire, locus, fromSire) > 0 && copies(dam, locus, fromDam) > 0;
        assert.ok(fits(x, y) || fits(y, x), `seed ${seed}, animal ${a.id}, ${locus}: ${x}/${y}`);
      });
    });
  }
});

test('bloodlines differ in what they are known for', () => {
  const herds = {};
  for (let seed = 1; seed <= 25; seed++) {
    const world = makeWorld(seed);
    Object.keys(BLOODLINES).forEach((name) => {
      (herds[name] ||= []).push(...world.generateHerd(name, 10, { ownerId: name }));
    });
  }
  const bv = (name, trait) => mean(herds[name].map((a) => a.genome.breedingValues[trait]));
  const share = (name, yes) => herds[name].filter(yes).length / herds[name].length;
  const carriers = (name, defect) => share(name, (a) => isCarrier(a.genome, defect));

  assert.ok(bv('fine_fleece', 'fiberDiameter') < -2 && bv('hardy_highland', 'fiberDiameter') > 2);
  assert.ok(bv('hardy_highland', 'hardiness') > 5 && bv('fine_fleece', 'hardiness') < -2);
  assert.ok(carriers('fine_fleece', 'choanal_atresia') > 2 * carriers('hardy_highland', 'choanal_atresia'));
  assert.ok(share('suri_keepers', (a) => getFleece(a.genome) === 'suri') > 0.6);
  assert.ok(share('hardy_highland', (a) => getFleece(a.genome) === 'suri') < 0.2, 'Huacaya is the rule');
  assert.ok(carriers('grey_painted', 'short_ears') > carriers('fine_fleece', 'short_ears'));
  // The player's inheritance: below average where it counts.
  assert.ok(bv('starter', 'fiberDiameter') > 1 && bv('starter', 'density') < -3 && bv('starter', 'size') < -1.5);

  // A profile only lists what is special about it; the rest is the default.
  assert.equal(bloodline('fine_fleece').dominantFreq.MC1R, 0.15);
  assert.equal(bloodline('fine_fleece').dominantFreq.ASIP, bloodline('starter').dominantFreq.ASIP);
  assert.throws(() => bloodline('no_such_line'));
});

test('the player\'s herd always hides a carrier', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const world = makeWorld(seed);
    const herd = world.generateHerd('starter', 4, { ownerId: PLAYER_ID });
    assert.ok(herd.some((a) => isCarrier(a.genome, 'choanal_atresia')), `seed ${seed}`);
    assert.ok(herd.every((a) => affectedBy(a.genome).length === 0 || !affectedBy(a.genome).includes('choanal_atresia')));
  }
});

test('founders are deterministic, and take their randomness from the rng they are given', () => {
  const snapshot = (seed) => JSON.stringify(Genetics.newGame({ seed }).pedigree.all());
  assert.equal(snapshot(5), snapshot(5));
  assert.notEqual(snapshot(5), snapshot(6));
});

test('a new game: the herds of WORLD_HERDS, the player\'s herd book on record', () => {
  const world = Genetics.newGame({ seed: 9 });
  WORLD_HERDS.forEach(({ ownerId, count }) => {
    assert.equal(world.pedigree.herdOf(ownerId).length, count, ownerId);
  });
  const mine = world.pedigree.herdOf(PLAYER_ID);
  assert.ok(mine.length >= 2);
  // The player's animals and their ancestors are on record; nobody else's are.
  world.pedigree.all().forEach((a) => assert.equal(world.quipu.isRecorded(a.id), a.ownerId === PLAYER_ID));
  assert.ok(world.pedigree.all().some((a) => a.ownerId === PLAYER_ID && !a.alive));
  assert.equal(world.day, 0);
  // So the quipu can see how related the player's own animals are...
  const [first, second] = [mine.find((a) => a.sex === 'M'), mine.find((a) => a.sex === 'F')];
  assert.equal(
    world.quipu.getPairingForecast(first.id, second.id, 3).inbreeding.coefficient,
    Math.round(world.pedigree.kinship(first.id, second.id) * 1e4) / 1e4,
  );
  // ...but not another family's.
  const theirs = world.pedigree.herdOf(WORLD_HERDS[1].ownerId);
  const [stud, ewe] = [theirs.find((a) => a.sex === 'M'), theirs.find((a) => a.sex === 'F')];
  assert.equal(world.quipu.getPairingForecast(stud.id, ewe.id, 3).inbreeding.coefficient, 0);

  // The player can start breeding at once.
  const sire = mine.find((a) => a.sex === 'M');
  const dam = mine.find((a) => a.sex === 'F');
  assert.deepEqual(world.breeding.canBreed(sire.id, dam.id), { ok: true });
});
