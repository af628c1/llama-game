import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUIPU, QUIPU_SKILL, PLAYER_ID, TRAITS, YEAR_DAYS, POSTPARTUM_REST_DAYS,
} from '../config.js';
import Genetics from '../Genetics.js';
import { TRAIT_NAMES, randomBreedingValues, rollPermEnv } from '../genome.js';
import { DEFECT_IDS } from '../defects.js';
import { heritability } from '../traits.js';
import { makeWorld, adult, birth } from './helpers.js';

const SKILLS = [0, 1, 2, 3];
const view = (world, alpaca, skill, day) => world.quipu.getPlayerView(alpaca.id, skill, day);
// A cria that is grown enough to have been looked over, on record.
const grownCria = (world, sire, dam) => {
  let cria;
  do { cria = birth(world, sire, dam, world.day - QUIPU.minObservationAgeDays - 10); } while (!cria.alive);
  world.quipu.record(cria.id);
  return cria;
};
// Give an animal real, random genetic and environmental values.
const randomize = (world, alpaca) => {
  alpaca.genome.breedingValues = randomBreedingValues(world.rng);
  alpaca.permEnv = rollPermEnv(world.rng);
  return alpaca;
};

// A world that has been lived in: three years of the player breeding their herd to their
// own and to other families' studs, testing for pregnancies as they go.
function livedIn(seed) {
  const world = Genetics.newGame({ seed });
  const mine = () => world.pedigree.herdOf(PLAYER_ID);
  const studs = world.pedigree.living().filter((a) => a.sex === 'M');
  for (let day = 1; day <= 3 * YEAR_DAYS; day++) {
    world.tick(day);
    if (day % 6 !== 0) continue;
    mine().filter((a) => a.sex === 'F').forEach((dam, i) => {
      const sire = studs[(day + i) % studs.length];
      world.breeding.attemptConception(sire.id, dam.id, day);
      if (day % 12 === 0) world.breeding.spitOffTest(dam.id, day);
    });
  }
  return world;
}

test('the player view never leaks a genotype, a breeding value, or anything else hidden', () => {
  const HIDDEN_KEYS = ['genome', 'loci', 'breedingValues', 'permEnv', 'inbreedingF', 'fate', 'dueDay', 'modifiers', 'flags'];
  let views = 0;
  [3, 4].forEach((seed) => {
    const world = livedIn(seed);
    assert.ok(world.pedigree.herdOf(PLAYER_ID).length > 6, 'the herd grew');

    world.pedigree.all().forEach((alpaca) => {
      // Every number the player must never be shown as it is.
      const secrets = new Set([
        ...Object.values(alpaca.genome.breedingValues), ...Object.values(alpaca.permEnv),
        ...TRAIT_NAMES.map((t) => TRAITS[t].mu + alpaca.genome.breedingValues[t]),
      ]);
      if (alpaca.inbreedingF > 0) secrets.add(alpaca.inbreedingF);
      const truth = world.phenotype(alpaca);

      SKILLS.forEach((skill) => {
        const v = view(world, alpaca, skill);
        views += 1;
        const walk = (node, path) => {
          if (node === null || typeof node !== 'object') {
            if (typeof node === 'number') {
              assert.ok(!secrets.has(node), `${path} is a hidden value (animal ${alpaca.id}, skill ${skill})`);
            }
            return;
          }
          Object.entries(node).forEach(([key, value]) => {
            assert.ok(!HIDDEN_KEYS.includes(key), `${path}.${key} (animal ${alpaca.id}, skill ${skill})`);
            walk(value, `${path}.${key}`);
          });
        };
        walk(v, 'view');

        // Traits are shown in words, never as measurements.
        Object.values(v.traits).forEach((word) => assert.equal(typeof word, 'string'));
        if (v.estimates) {
          TRAIT_NAMES.forEach((t) => assert.notEqual(v.estimates[t].value, truth[t], 'an estimate is not the measurement'));
        }
        // A pregnancy shows only once it has been found out.
        const { pregnancy } = alpaca;
        assert.equal(v.pregnancy !== null, Boolean(pregnancy && pregnancy.known));
        // Nothing in the view is a live part of the animal.
        assert.doesNotThrow(() => JSON.stringify(v));
      });
    });
  });
  assert.ok(views > 2000);
});

test('the view is a copy, and looking changes nothing and rolls nothing', () => {
  const world = livedIn(5);
  const before = JSON.stringify({ animals: world.pedigree.all(), rng: world.rng.save(), recorded: [...world.quipu.recorded] });
  const animals = world.pedigree.all();
  animals.forEach((alpaca) => {
    const v = view(world, alpaca, 3);
    v.color.colorKey = 'tampered';
    v.defects.push('tampered');
    v.parents.sireId = -1;
    if (v.lastMating) v.lastMating.day = -1;
  });
  const males = animals.filter((a) => a.sex === 'M').slice(0, 12);
  const females = animals.filter((a) => a.sex === 'F').slice(0, 12);
  males.forEach((sire) => females.forEach((dam) => world.quipu.getPairingForecast(sire.id, dam.id, 3)));
  const after = JSON.stringify({ animals: world.pedigree.all(), rng: world.rng.save(), recorded: [...world.quipu.recorded] });
  assert.equal(after, before);
  assert.equal(world.quipu.getPlayerView(99999, 3), null);
  assert.equal(world.quipu.getPairingForecast(99999, 1, 3), null);
});

test('skill gates what is shown', () => {
  const world = livedIn(6);
  const [alpaca] = world.pedigree.herdOf(PLAYER_ID);
  const keys = (skill) => Object.keys(view(world, alpaca, skill)).sort();
  const base = keys(0);
  assert.deepEqual(base, [
    'ageDays', 'alive', 'blueEyed', 'color', 'deaf', 'death', 'defects', 'fleece', 'id', 'lastBirthDay',
    'lastMating', 'name', 'offspring', 'ownerId', 'parents', 'predatorRisk', 'pregnancy', 'recorded', 'sex', 'traits',
  ]);
  assert.deepEqual(keys(QUIPU_SKILL.traitEstimates), [...base, 'estimates'].sort());
  assert.deepEqual(keys(QUIPU_SKILL.carrierOdds), [...base, 'estimates', 'carrier'].sort());
  assert.deepEqual(keys(3), [...base, 'estimates', 'carrier', 'colorGenes'].sort());

  const v = view(world, alpaca, 3);
  assert.deepEqual(Object.keys(v.estimates), TRAIT_NAMES);
  assert.deepEqual(Object.keys(v.carrier), DEFECT_IDS);
  assert.deepEqual(Object.keys(v.colorGenes), ['MC1R', 'ASIP', 'GREY', 'SPOT', 'FLEECE']);
  // Traits you can't see by looking have no word.
  assert.equal(v.traits.fertility, undefined);
  assert.equal(v.traits.shade, undefined);
  assert.equal(typeof v.traits.fiberDiameter, 'string');

  const sire = world.pedigree.herdOf(PLAYER_ID).find((a) => a.sex === 'M');
  const dam = world.pedigree.herdOf(PLAYER_ID).find((a) => a.sex === 'F');
  const forecastKeys = (skill) => Object.keys(world.quipu.getPairingForecast(sire.id, dam.id, skill)).sort();
  assert.deepEqual(forecastKeys(0), ['canBreed', 'damId', 'sireId']);
  assert.deepEqual(forecastKeys(1), ['canBreed', 'damId', 'sireId', 'traits']);
  assert.deepEqual(forecastKeys(2), ['canBreed', 'damId', 'defects', 'sireId', 'traits']);
  assert.deepEqual(forecastKeys(3), ['canBreed', 'damId', 'defects', 'inbreeding', 'sireId', 'traits']);
});

test('what is plain to see: looks, age, defects, deafness, death', () => {
  const world = makeWorld(7);
  world.day = 400;
  const sire = adult(world, 'M', { loci: { MC1R: ['E', 'e'], ASIP: ['A', 'a'], WRY: ['d', 'd'] }, bv: { fiberDiameter: -6, hardiness: 14, shade: 0.3 }, age: 500 });
  const v = view(world, sire, 0);
  assert.equal(v.sex, 'M');
  assert.equal(v.ageDays, 500);
  assert.deepEqual(v.color, { family: 'brown', shadeTier: 'dark', grey: false, spotted: false, bew: false, colorKey: 'brown_dark' });
  assert.equal(v.fleece, 'huacaya');
  assert.deepEqual(v.defects, ['wry_face']);
  assert.equal(v.traits.fiberDiameter, 'very fine');
  assert.equal(v.recorded, false);
  assert.deepEqual(v.parents, { sireId: null, damId: null });
  assert.equal(v.death, null);

  const deaf = adult(world, 'F', { loci: { GREY: ['G', 'g'], SPOT: ['S', 's'] }, flags: { blueEyed: true, deaf: true } });
  assert.deepEqual([view(world, deaf, 0).deaf, view(world, deaf, 0).blueEyed, view(world, deaf, 0).color.colorKey], [false, true, 'bew']);
  deaf.flags.deafKnown = true;
  assert.deepEqual([view(world, deaf, 0).deaf, view(world, deaf, 0).predatorRisk], [true, true]);

  world.die(sire, 410, 'weak_cria');
  world.day = 900;
  const dead = view(world, sire, 0);
  assert.deepEqual([dead.alive, dead.ageDays, dead.death], [false, 510, { day: 410, cause: 'weak_cria' }]);
});

test('records: parents and offspring are known only as far as the records go', () => {
  const world = makeWorld(8);
  const sire = adult(world, 'M', { ownerId: 'family:x' });
  const dam = adult(world, 'F', { ownerId: 'family:x' });
  const [a, b] = [birth(world, sire, dam), birth(world, sire, dam)];
  assert.deepEqual(view(world, a, 3).parents, { sireId: null, damId: null }, 'not on record');
  assert.equal(world.quipu.getPairingForecast(sire.id, b.id, 3, 400).inbreeding.coefficient, 0);

  // Bought by the player: now on record, with who its parents were.
  world.transfer(a.id, PLAYER_ID);
  assert.deepEqual(view(world, a, 0).parents, { sireId: sire.id, damId: dam.id });
  assert.equal(view(world, a, 0).recorded, true);
  assert.deepEqual(view(world, sire, 0).offspring, [a.id], 'the stud\'s offspring on record');

  // a and b are full siblings, but b has no record: nothing shows...
  const pairing = () => world.quipu.getPairingForecast(a.sex === 'M' ? a.id : b.id, a.sex === 'M' ? b.id : a.id, 3, 400).inbreeding;
  a.sex = 'M'; b.sex = 'F';
  assert.deepEqual(pairing(), { coefficient: 0, percent: 0, warning: 'none' });
  // ...until the family opens its herd book.
  world.quipu.recordHerd('family:x');
  assert.deepEqual(pairing(), { coefficient: 0.25, percent: 25, warning: 'close' });
  assert.equal(world.pedigree.kinship(a.id, b.id), 0.25, 'which was true all along');

  // Using a stud puts him on record; a cria born to the player is recorded at birth.
  const stud = adult(world, 'M', { ownerId: 'family:y' });
  const mine = adult(world, 'F', { ownerId: PLAYER_ID });
  assert.equal(world.quipu.isRecorded(stud.id), false);
  world.breeding.attemptConception(stud.id, mine.id, 0);
  assert.equal(world.quipu.isRecorded(stud.id) && world.quipu.isRecorded(mine.id), true);
  const cria = birth(world, stud, mine);
  assert.equal(world.quipu.isRecorded(cria.id), true);
  // Other families' business stays their own.
  const theirs = birth(world, stud, adult(world, 'F', { ownerId: 'family:y' }));
  assert.equal(world.quipu.isRecorded(theirs.id), false);
});

test('kinship warnings come in steps', () => {
  const world = makeWorld(9);
  const [gs, gd] = [adult(world, 'M'), adult(world, 'F')];
  const [s1, d1] = [adult(world, 'M', { sireId: gs.id, damId: gd.id }), adult(world, 'F', { sireId: gs.id, damId: gd.id })];
  const cousinA = adult(world, 'M', { sireId: s1.id, damId: adult(world, 'F').id });
  const cousinB = adult(world, 'F', { sireId: adult(world, 'M').id, damId: d1.id });
  world.pedigree.all().forEach((a) => world.quipu.record(a.id));
  const warn = (s, d) => world.quipu.getPairingForecast(s.id, d.id, 3).inbreeding;
  assert.deepEqual(warn(gs, gd), { coefficient: 0, percent: 0, warning: 'none' });
  assert.deepEqual(warn(cousinA, cousinB), { coefficient: 0.0625, percent: 6.3, warning: 'related' });
  assert.deepEqual(warn(s1, d1), { coefficient: 0.25, percent: 25, warning: 'close' });
  assert.equal(world.quipu.getPairingForecast(s1.id, d1.id, 2).inbreeding, undefined);
});

test('a pregnancy stays out of sight until it is found out', () => {
  const world = makeWorld(10);
  const sire = adult(world, 'M');
  const dam = adult(world, 'F');
  while (!dam.pregnancy) world.breeding.attemptConception(sire.id, dam.id, 0);
  const forecast = () => world.quipu.getPairingForecast(sire.id, dam.id, 3, 20).canBreed;

  assert.equal(view(world, dam, 3, 20).pregnancy, null);
  assert.deepEqual(view(world, dam, 3, 20).lastMating, { sireId: sire.id, day: 0 });
  assert.deepEqual(forecast(), { ok: true }, 'as far as the player can tell');
  assert.equal(world.breeding.canBreed(sire.id, dam.id, 20).reason, 'pregnant', 'the truth, for the game');

  while (!world.breeding.spitOffTest(dam.id, 20).spits);
  assert.deepEqual(view(world, dam, 0, 20).pregnancy, { sireId: sire.id, sinceDay: 0 });
  assert.deepEqual(forecast(), { ok: false, reason: 'pregnant', who: 'dam' });

  // What the player does know still shows: she has just given birth.
  world.tick(dam.pregnancy.dueDay);
  const due = world.day;
  assert.equal(view(world, dam, 0).lastBirthDay, due);
  assert.equal(world.quipu.getPairingForecast(sire.id, dam.id, 0, due + POSTPARTUM_REST_DAYS - 1).canBreed.reason, 'resting');
});

test('trait estimates: accuracy rises with the offspring on record', () => {
  const world = makeWorld(11);
  world.day = 2000;
  const sire = randomize(world, adult(world, 'M', { ownerId: 'family:x' }));
  const accuracy = () => view(world, sire, 1).estimates.fiberDiameter.accuracy;

  // By looking alone, an estimate is as good as the square root of the heritability.
  const alone = accuracy();
  assert.equal(alone, Math.round(Math.sqrt(heritability('fiberDiameter')) * 100) / 100);

  const steps = [alone];
  let born = 0;
  [1, 3, 8, 20, 60].forEach((target) => {
    while (born < target) {
      grownCria(world, sire, randomize(world, adult(world, 'F', { ownerId: 'family:x' })));
      born += 1;
    }
    steps.push(accuracy());
  });
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1], `accuracy ${steps.join(' -> ')}`);
  assert.ok(steps.at(-1) > 0.9 && steps.at(-1) < 1, `after 60 offspring: ${steps.at(-1)}`);

  // Offspring that aren't on record, or are too young to judge, add nothing.
  const fresh = randomize(world, adult(world, 'M', { ownerId: 'family:x' }));
  const before = view(world, fresh, 1).estimates.fiberDiameter.accuracy;
  const mate = adult(world, 'F', { ownerId: 'family:x' });
  for (let i = 0; i < 10; i++) birth(world, fresh, mate, world.day - 100); // not recorded
  const newborn = birth(world, fresh, mate, world.day);
  world.quipu.record(newborn.id);
  assert.equal(view(world, fresh, 1).estimates.fiberDiameter.accuracy, before);
});

test('trait estimates close in on the truth as the records grow', () => {
  const world = makeWorld(12);
  world.day = 2000;
  const trait = 'density';
  const errors = { alone: [], proven: [] };
  for (let i = 0; i < 150; i++) {
    const sire = randomize(world, adult(world, 'M', { ownerId: 'family:x' }));
    const truth = TRAITS[trait].mu + sire.genome.breedingValues[trait];
    errors.alone.push(Math.abs(view(world, sire, 1).estimates[trait].value - truth));
    for (let n = 0; n < 25; n++) grownCria(world, sire, randomize(world, adult(world, 'F', { ownerId: 'family:x' })));
    errors.proven.push(Math.abs(view(world, sire, 1).estimates[trait].value - truth));
  }
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const guessingTheMean = TRAITS[trait].sigmaA * Math.sqrt(2 / Math.PI);
  assert.ok(mean(errors.alone) < guessingTheMean, `by looks: off by ${mean(errors.alone)} (blind: ${guessingTheMean})`);
  assert.ok(mean(errors.proven) < 0.75 * mean(errors.alone), `with 25 offspring: off by ${mean(errors.proven)}`);
});

test('trait estimates: a cria starts as the average of its parents', () => {
  const world = makeWorld(13);
  world.day = 2000;
  const sire = randomize(world, adult(world, 'M'));
  const dam = randomize(world, adult(world, 'F'));
  [sire, dam].forEach((a) => world.quipu.record(a.id));
  let cria;
  do { cria = birth(world, sire, dam, world.day); } while (!cria.alive);
  world.quipu.record(cria.id);

  const est = (alpaca, day) => view(world, alpaca, 1, day).estimates;
  TRAIT_NAMES.forEach((trait) => {
    const expected = (est(sire)[trait].value + est(dam)[trait].value) / 2;
    assert.ok(Math.abs(est(cria)[trait].value - expected) < 0.011, trait);
    assert.ok(est(cria)[trait].accuracy < est(sire)[trait].accuracy);
  });
  // Once it has grown enough to be judged itself, the estimate firms up.
  const later = world.day + QUIPU.minObservationAgeDays;
  assert.ok(est(cria, later).size.accuracy > est(cria).size.accuracy);
  // With nothing to go on at all, the estimate is the population mean, accuracy zero.
  const stranger = birth(world, adult(world, 'M', { ownerId: 'family:x' }), adult(world, 'F', { ownerId: 'family:x' }), world.day);
  assert.deepEqual(est(stranger).size, { value: TRAITS.size.mu, accuracy: 0 });
});

test('carrier status: from unknown to proven, by what the records show', () => {
  const world = makeWorld(14);
  world.day = 1000;
  const carrier = { CHOANAL: ['N', 'd'] };
  const sire = adult(world, 'M', { loci: carrier });
  const dam = adult(world, 'F', { loci: carrier });
  [sire, dam].forEach((a) => world.quipu.record(a.id));
  const status = (alpaca, defect = 'choanal_atresia') => view(world, alpaca, 2).carrier[defect];

  // A carrier looks like any other animal: nothing is known.
  assert.deepEqual(status(sire), { status: 'unknown' });
  assert.deepEqual(world.quipu.getPairingForecast(sire.id, dam.id, 2).defects.choanal_atresia, { risk: null, severity: 'lethal' });

  // Breed them until an affected cria is born, keeping the healthy ones.
  const healthy = [];
  let affected = null;
  while (!affected) {
    const cria = birth(world, sire, dam, 900);
    world.quipu.record(cria.id);
    if (cria.genome.loci.CHOANAL.join('') === 'dd') affected = cria;
    else healthy.push(cria);
  }
  while (healthy.length < 2) {
    const cria = birth(world, sire, dam, 900);
    world.quipu.record(cria.id);
    if (cria.genome.loci.CHOANAL.join('') !== 'dd') healthy.push(cria);
  }
  assert.deepEqual(status(affected), { status: 'affected' });
  assert.deepEqual(status(sire), { status: 'proven_carrier', chance: 1 });
  assert.deepEqual(status(dam), { status: 'proven_carrier', chance: 1 });
  // A healthy cria of two carriers carries it two times in three.
  assert.deepEqual(status(healthy[0]), { status: 'possible', chance: 0.67 });
  assert.deepEqual(status(healthy[0], 'wry_face'), { status: 'unknown' }, 'defect by defect');
  assert.equal(world.quipu.getPairingForecast(sire.id, dam.id, 2).defects.choanal_atresia.risk, 0.25);

  // One proven-carrier parent and one nothing is known of: an even chance.
  const outsider = adult(world, 'F');
  const half = grownCria(world, sire, outsider);
  if (half.genome.loci.CHOANAL.join('') !== 'dd') assert.deepEqual(status(half), { status: 'possible', chance: 0.5 });
  // ...and it runs on down the generations, halving.
  const grand = grownCria(world, adult(world, 'M'), Object.assign(half, { sex: 'F' }));
  assert.deepEqual(status(grand), { status: 'possible', chance: 0.25 });

  // The risk for a pair is each one's chance of passing it on, multiplied.
  const risk = (s, d) => world.quipu.getPairingForecast(s.id, d.id, 2).defects.choanal_atresia.risk;
  const son = Object.assign(healthy[0], { sex: 'M' });
  const daughter = Object.assign(healthy[1], { sex: 'F' });
  assert.equal(risk(sire, daughter), 0.167);
  assert.equal(risk(son, daughter), 0.111);
  assert.equal(risk(sire, adult(world, 'F')), null, 'nothing is known of her');
  // One healthy cria by a known carrier is already a little evidence about its dam.
  assert.equal(risk(sire, outsider), 0.029);
});

test('carrier status: an affected parent, and what the unrecorded can\'t tell', () => {
  const world = makeWorld(15);
  world.day = 1000;
  const wry = adult(world, 'M', { loci: { WRY: ['d', 'd'] } });
  const dam = adult(world, 'F');
  const cria = grownCria(world, wry, dam);
  const status = (alpaca) => view(world, alpaca, 2).carrier.wry_face;

  // The cria's record names its sire, but the sire himself isn't on record: unknown.
  assert.deepEqual(status(cria), { status: 'unknown' });
  assert.deepEqual(status(wry), { status: 'affected' }, 'anyone can see he has it');
  world.quipu.record(wry.id);
  assert.deepEqual(status(cria), { status: 'proven_carrier', chance: 1 }, 'the cria of an affected animal must carry it');
  assert.equal(world.quipu.getPairingForecast(wry.id, Object.assign(cria, { sex: 'F' }).id, 2).defects.wry_face.risk, 0.5);
});

test('carrier status: test matings make an animal likely clear, never certain', () => {
  const world = makeWorld(16);
  world.day = 1000;
  const clear = adult(world, 'M');
  const knownCarrier = adult(world, 'F', { loci: { EARS: ['N', 'd'] } });
  // Prove her a carrier with an affected cria by another carrier.
  const other = adult(world, 'M', { loci: { EARS: ['N', 'd'] } });
  [clear, knownCarrier, other].forEach((a) => world.quipu.record(a.id));
  let proof;
  do { proof = birth(world, other, knownCarrier, 900); } while (proof.genome.loci.EARS.join('') !== 'dd');
  world.quipu.record(proof.id);
  const status = () => view(world, clear, 2).carrier.short_ears;
  assert.deepEqual(status(), { status: 'unknown' });

  // Every healthy cria by a known carrier is a test passed (one that died young of
  // something else counts too: it was seen not to have the defect).
  const expected = (n) => { const p = QUIPU.carrierPrior * 0.75 ** n; return Math.round((p / (p + 1 - QUIPU.carrierPrior)) * 100) / 100; };
  const chances = [];
  for (let n = 1; n <= 12; n++) {
    grownCria(world, clear, knownCarrier);
    const tests = view(world, clear, 2).offspring.length;
    assert.equal(status().chance, Math.max(0.01, expected(tests)), `after ${tests} test matings`);
    assert.equal(status().status, expected(tests) <= QUIPU.likelyClearBelow ? 'likely_clear' : 'possible');
    chances.push(status().chance);
  }
  for (let i = 1; i < chances.length; i++) assert.ok(chances[i] <= chances[i - 1], `chances ${chances}`);
  assert.ok(chances[0] > QUIPU.likelyClearBelow, 'one test is not enough');
  // However many healthy crias, the odds never reach nothing.
  for (let n = 0; n < 30; n++) grownCria(world, clear, knownCarrier);
  assert.deepEqual(status(), { status: 'likely_clear', chance: 0.01 });
  assert.equal(view(world, clear, 2).carrier.choanal_atresia.status, 'unknown', 'a test for one defect says nothing of another');

  // Matings to animals not known to carry prove nothing.
  const untested = adult(world, 'M');
  world.quipu.record(untested.id);
  for (let n = 0; n < 12; n++) grownCria(world, untested, adult(world, 'F'));
  assert.deepEqual(view(world, untested, 2).carrier.short_ears, { status: 'unknown' });
});

test('colour genes: read from looks, sharpened by relatives', () => {
  const world = makeWorld(17);
  world.day = 1000;
  const genes = (alpaca) => view(world, alpaca, 3).colorGenes;
  const brownHet = { MC1R: ['E', 'e'], ASIP: ['A', 'a'] };
  const sire = adult(world, 'M', { loci: brownHet });
  const dam = adult(world, 'F', { loci: brownHet });
  [sire, dam].forEach((a) => world.quipu.record(a.id));

  // A brown shows one E and one A; what is behind them can't be seen.
  assert.deepEqual(genes(sire), { MC1R: 'E/?', ASIP: 'A/?', GREY: 'g/g', SPOT: 's/s', FLEECE: 'hu/hu' });

  // Two browns have a fawn: both carry e. A fawn's own ASIP stays hidden.
  let fawn;
  do { fawn = birth(world, sire, dam, 900); } while (fawn.genome.loci.MC1R.join('') !== 'ee');
  world.quipu.record(fawn.id);
  assert.equal(genes(sire).MC1R, 'E/e');
  assert.equal(genes(dam).MC1R, 'E/e');
  assert.equal(genes(sire).ASIP, 'A/?');
  // (Neither parent is grey or spotted, so the cria can't be hiding either.)
  assert.deepEqual([genes(fawn).MC1R, genes(fawn).ASIP, genes(fawn).GREY], ['e/e', '?/?', 'g/g']);

  // ...and a black: both carry a.
  let black;
  do { black = birth(world, sire, dam, 900); } while (!(black.genome.loci.ASIP.join('') === 'aa' && black.genome.loci.MC1R[0] === 'E'));
  world.quipu.record(black.id);
  assert.deepEqual([genes(sire).ASIP, genes(dam).ASIP, genes(black).ASIP], ['A/a', 'A/a', 'a/a']);
  // The black cria of two e-carriers may carry e or not: its looks don't say.
  assert.equal(genes(black).MC1R, 'E/?');

  // A cria of a fawn must carry e.
  const fawnDam = adult(world, 'F');
  world.quipu.record(fawnDam.id);
  const pure = adult(world, 'M', { loci: { MC1R: ['E', 'E'], ASIP: ['A', 'A'] } });
  world.quipu.record(pure.id);
  const cria = grownCria(world, pure, fawnDam);
  assert.equal(genes(cria).MC1R, 'E/e');
  assert.equal(genes(pure).MC1R, 'E/?', 'a brown cria doesn\'t show what else its sire has');

  // Relatives not on record show nothing.
  const lone = adult(world, 'M', { loci: brownHet, ownerId: 'family:x' });
  let hidden;
  do { hidden = birth(world, lone, adult(world, 'F', { ownerId: 'family:x' }), 900); } while (hidden.genome.loci.MC1R.join('') !== 'ee');
  assert.equal(genes(lone).MC1R, 'E/?');
  world.quipu.record(hidden.id);
  assert.equal(genes(lone).MC1R, 'E/e');
});

test('colour genes: hidden grey, spots, fleece and the blue-eyed white', () => {
  const world = makeWorld(18);
  world.day = 1000;
  const genes = (alpaca) => view(world, alpaca, 3).colorGenes;
  const rec = (...animals) => animals.forEach((a) => world.quipu.record(a.id));

  // A fawn carrying grey unseen, bred to a black without it: a grey cria gives it away.
  const fawnGrey = adult(world, 'M', { loci: { GREY: ['G', 'G'] } });
  const black = adult(world, 'F', { loci: { MC1R: ['E', 'E'] } });
  rec(fawnGrey, black);
  assert.equal(genes(fawnGrey).GREY, '?/?');
  assert.equal(genes(black).GREY, 'g/g');
  const greyCria = grownCria(world, fawnGrey, black);
  assert.deepEqual([view(world, greyCria, 0).color.colorKey, genes(greyCria).GREY], ['black_grey', 'G/g']);
  assert.equal(genes(fawnGrey).GREY, 'G/?');

  // Suri is dominant: a Huacaya cria shows a Suri parent to be carrying hu.
  const suri = adult(world, 'M', { loci: { FLEECE: ['Su', 'hu'] } });
  const huacaya = adult(world, 'F');
  rec(suri, huacaya);
  assert.equal(genes(suri).FLEECE, 'Su/?');
  let plain;
  do { plain = birth(world, suri, huacaya, 900); } while (plain.genome.loci.FLEECE.join('') !== 'huhu');
  world.quipu.record(plain.id);
  assert.equal(genes(suri).FLEECE, 'Su/hu');

  // A blue-eyed white shows grey and spots and hides the rest.
  const bew = adult(world, 'F', { loci: { MC1R: ['E', 'e'], GREY: ['G', 'g'], SPOT: ['S', 's'] } });
  assert.deepEqual(genes(bew), { MC1R: '?/?', ASIP: '?/?', GREY: 'G/?', SPOT: 'S/?', FLEECE: 'hu/hu' });
  // White hides spots.
  const white = adult(world, 'F', { bv: { shade: -0.45 } });
  assert.deepEqual([view(world, white, 0).color.colorKey, genes(white).SPOT], ['white', '?/?']);
});

test('colour genes are always true, as far as they go', () => {
  const world = livedIn(19);
  world.quipu.recordHerd('family:fine_fleece');
  world.pedigree.all().forEach((alpaca) => {
    const hints = view(world, alpaca, 3).colorGenes;
    Object.entries(hints).forEach(([locus, hint]) => {
      const real = [...alpaca.genome.loci[locus]];
      hint.split('/').filter((allele) => allele !== '?').forEach((allele) => {
        const at = real.indexOf(allele);
        assert.ok(at >= 0, `animal ${alpaca.id} ${locus}: shown ${hint}, has ${alpaca.genome.loci[locus].join('/')}`);
        real.splice(at, 1);
      });
    });
  });
});

test('pairing forecast: trait ranges that hold about two times in three', () => {
  const world = makeWorld(20);
  world.day = 2000;
  let inside = 0;
  let total = 0;
  for (let i = 0; i < 300; i++) {
    const sire = randomize(world, adult(world, 'M'));
    const dam = randomize(world, adult(world, 'F'));
    const { traits } = world.quipu.getPairingForecast(sire.id, dam.id, 1);
    const cria = birth(world, sire, dam, world.day - 2 * YEAR_DAYS);
    const grown = world.phenotype(cria, cria.birthDay + 2 * YEAR_DAYS);
    ['density', 'stapleLength', 'docility', 'size', 'hardiness'].forEach((trait) => {
      assert.ok(traits[trait].low < traits[trait].high);
      total += 1;
      if (grown[trait] >= traits[trait].low && grown[trait] <= traits[trait].high) inside += 1;
    });
  }
  assert.ok(inside / total > 0.58 && inside / total < 0.8, `${inside / total} of crias inside the forecast`);

  // Knowing the parents better narrows the range.
  const sire = randomize(world, adult(world, 'M'));
  const dam = randomize(world, adult(world, 'F'));
  const width = () => { const { low, high } = world.quipu.getPairingForecast(sire.id, dam.id, 1).traits.density; return high - low; };
  const before = width();
  for (let n = 0; n < 30; n++) grownCria(world, sire, randomize(world, adult(world, 'F')));
  assert.ok(width() < before);
});

test('pairing forecast: what the player can see stands in the way', () => {
  const world = makeWorld(21);
  const sire = adult(world, 'M');
  const young = adult(world, 'F', { age: 20 });
  assert.deepEqual(world.quipu.getPairingForecast(sire.id, young.id, 0).canBreed, { ok: false, reason: 'too_young', who: 'dam' });
  assert.deepEqual(world.quipu.getPairingForecast(young.id, sire.id, 0).canBreed, { ok: false, reason: 'wrong_sex', who: 'sire' });
});
