import test from 'node:test';
import assert from 'node:assert/strict';

import Rng from '../rng.js';
import { TRAITS, AGE, YEAR_DAYS, DEFECTS, DEAF } from '../config.js';
import {
  TRAIT_NAMES, randomBreedingValues, rollPermEnv, inheritBreedingValues,
} from '../genome.js';
import { getPhenotype, heritability, describe, ageAdjusted, ageOn } from '../traits.js';
import {
  affectedBy, isCarrier, lethalDefect, traitEffects, valueMultiplier, nutritionPenalty, DEFECT_IDS,
} from '../defects.js';
import { plainGenome, zeroTraits } from './helpers.js';

const ADULT = AGE.adultDays;
const animal = (over = {}) => ({
  birthDay: 0, alive: true, deathDay: null, inbreedingF: 0, flags: {},
  genome: plainGenome(), permEnv: zeroTraits(), ...over,
});

test('an average adult has the mean of every trait', () => {
  const traits = getPhenotype(animal(), ADULT);
  TRAIT_NAMES.forEach((trait) => {
    const expected = trait === 'fiberDiameter'
      ? TRAITS[trait].mu + ((ADULT - AGE.fiberCoarsenFromDays) / YEAR_DAYS) * AGE.fiberCoarsenPerYear
      : TRAITS[trait].mu;
    assert.ok(Math.abs(traits[trait] - expected) < 1e-9, `${trait}: ${traits[trait]}`);
  });
});

test('breeding value and permanent environment add to the phenotype', () => {
  const a = animal();
  a.genome.breedingValues.density = 5;
  a.permEnv.density = -2;
  assert.equal(getPhenotype(a, ADULT).density, TRAITS.density.mu + 3);
});

test('age: crias are small, fibre coarsens, fertility fades', () => {
  const a = animal();
  const at = (day) => getPhenotype(a, day);
  assert.ok(Math.abs(at(0).size - TRAITS.size.mu * AGE.birthSizeFraction) < 1e-9);
  assert.ok(at(60).size > at(0).size && at(60).size < at(ADULT).size);
  assert.equal(at(ADULT * 3).size, TRAITS.size.mu);

  assert.equal(at(0).fiberDiameter, TRAITS.fiberDiameter.mu);
  assert.ok(Math.abs(at(5 * YEAR_DAYS).fiberDiameter - (TRAITS.fiberDiameter.mu + 4 * AGE.fiberCoarsenPerYear)) < 1e-9);

  assert.equal(at(AGE.fertilityDeclineFromDays).fertility, TRAITS.fertility.mu);
  assert.ok(at(AGE.fertilityDeclineFromDays + 2 * YEAR_DAYS).fertility < TRAITS.fertility.mu - 9);

  // Judged for its age, the animal is the same at every age.
  [0, 60, ADULT, 9 * YEAR_DAYS, 13 * YEAR_DAYS].forEach((day) => {
    TRAIT_NAMES.forEach((trait) => {
      assert.ok(Math.abs(ageAdjusted(trait, at(day)[trait], day) - TRAITS[trait].mu) < 1e-9, `${trait} at ${day}`);
    });
  });
});

test('the dead stop ageing', () => {
  const a = animal({ alive: false, deathDay: 30 });
  assert.equal(ageOn(a, 500), 30);
  assert.equal(getPhenotype(a, 500).size, getPhenotype(animal(), 30).size);
});

test('inbreeding depression: -F x the trait\'s depression', () => {
  const inbred = getPhenotype(animal({ inbreedingF: 0.25 }), ADULT);
  const outbred = getPhenotype(animal(), ADULT);
  TRAIT_NAMES.forEach((trait) => {
    assert.ok(Math.abs((outbred[trait] - inbred[trait]) - 0.25 * TRAITS[trait].depression) < 1e-9, trait);
  });
  assert.ok(inbred.fertility < outbred.fertility && inbred.hardiness < outbred.hardiness);
  assert.equal(inbred.fiberDiameter, outbred.fiberDiameter);
});

test('nutrition is a hook: neutral by default, and moves the traits it should', () => {
  const fed = getPhenotype(animal(), ADULT, { nutritionScore: 1 });
  const starved = getPhenotype(animal(), ADULT, { nutritionScore: -1 });
  const neutral = getPhenotype(animal(), ADULT);
  assert.equal(fed.size - neutral.size, TRAITS.size.nutrition);
  assert.equal(neutral.size - starved.size, TRAITS.size.nutrition);
  assert.ok(fed.fiberDiameter > neutral.fiberDiameter, 'well-fed animals grow coarser fibre');
  assert.deepEqual(getPhenotype(animal(), ADULT, { nutritionScore: 5 }), fed, 'the score is limited to 1');
});

test('phenotypes stay inside their limits', () => {
  const a = animal();
  a.genome.breedingValues.hardiness = 500;
  a.genome.breedingValues.fiberDiameter = -500;
  const traits = getPhenotype(a, ADULT);
  assert.equal(traits.hardiness, TRAITS.hardiness.max);
  assert.equal(traits.fiberDiameter, TRAITS.fiberDiameter.min);
});

test('modifiers can change the phenotype through onPhenotype', () => {
  const blessing = { id: 'test', onPhenotype: (alpaca, traits) => ({ ...traits, density: traits.density + 10 }) };
  const silent = { id: 'none' };
  const traits = getPhenotype(animal(), ADULT, { modifiers: [silent, blessing] });
  assert.equal(traits.density, TRAITS.density.mu + 10);
});

test('traits are described in words, for the animal\'s age', () => {
  assert.equal(describe('fiberDiameter', TRAITS.fiberDiameter.mu - 5, 0), 'very fine');
  assert.equal(describe('fiberDiameter', TRAITS.fiberDiameter.mu, 0), 'medium');
  assert.equal(describe('hardiness', TRAITS.hardiness.mu + 8, 0), 'sturdy');
  assert.equal(describe('hardiness', 99, 0), 'very sturdy');
  assert.equal(describe('fertility', 50, 0), null, 'fertility can\'t be seen');
  // An average newborn is "average" for its size, not "very small".
  assert.equal(describe('size', getPhenotype(animal(), 0).size, 0), 'average');
});

test('defects: only d/d animals are affected, and carriers are untouched', () => {
  const clear = animal();
  DEFECT_IDS.forEach((id) => {
    const { locus } = DEFECTS[id];
    const carrier = animal({ genome: plainGenome({ [locus]: ['N', 'd'] }) });
    const affected = animal({ genome: plainGenome({ [locus]: ['d', 'd'] }) });

    assert.deepEqual(affectedBy(carrier.genome), []);
    assert.equal(isCarrier(carrier.genome, id), true);
    assert.deepEqual(getPhenotype(carrier, ADULT), getPhenotype(clear, ADULT), `${id} carrier`);
    assert.equal(valueMultiplier(carrier), 1);
    assert.equal(lethalDefect(carrier.genome), null);

    assert.deepEqual(affectedBy(affected.genome), [id]);
    assert.equal(isCarrier(affected.genome, id), false);
    assert.equal(valueMultiplier(affected), DEFECTS[id].valueMultiplier);
  });
});

test('defects: effects come from the config', () => {
  const wry = animal({ genome: plainGenome({ WRY: ['d', 'd'] }) });
  const traits = getPhenotype(wry, ADULT);
  const sound = getPhenotype(animal(), ADULT);
  const expected = DEFECTS.wry_face.traitEffects.hardiness
    - DEFECTS.wry_face.nutritionPenalty * TRAITS.hardiness.nutrition;
  assert.ok(Math.abs((traits.hardiness - sound.hardiness) - expected) < 1e-9);
  assert.equal(nutritionPenalty(wry), DEFECTS.wry_face.nutritionPenalty);
  assert.ok(traits.size < sound.size, 'it feeds badly');

  assert.deepEqual(lethalDefect(plainGenome({ CHOANAL: ['d', 'd'] })), {
    id: 'choanal_atresia', withinDays: DEFECTS.choanal_atresia.lethalWithinDays,
  });
  assert.equal(lethalDefect(plainGenome({ EARS: ['d', 'd'] })), null);

  const deaf = animal({ flags: { deaf: true } });
  assert.deepEqual(traitEffects(deaf), DEAF.traitEffects);
  assert.equal(getPhenotype(deaf, ADULT).docility, TRAITS.docility.mu + DEAF.traitEffects.docility);
});

test('heritability: offspring on mid-parent regresses with slope h² for every trait', () => {
  const rng = new Rng(8675309);
  const FAMILIES = 6000;
  const make = (genome) => animal({ genome, permEnv: rollPermEnv(rng) });
  const founder = () => make({ ...plainGenome(), breedingValues: randomBreedingValues(rng) });

  const sums = Object.fromEntries(TRAIT_NAMES.map((t) => [t, { x: 0, y: 0, xx: 0, xy: 0 }]));
  for (let i = 0; i < FAMILIES; i++) {
    const sire = founder();
    const dam = founder();
    const cria = make({ ...plainGenome(), breedingValues: inheritBreedingValues(rng, sire, dam) });
    // Everyone measured at the same adult age, so age doesn't come into it.
    const [ps, pd, pc] = [sire, dam, cria].map((a) => getPhenotype(a, ADULT));
    TRAIT_NAMES.forEach((trait) => {
      const x = (ps[trait] + pd[trait]) / 2;
      const y = pc[trait];
      const s = sums[trait];
      s.x += x; s.y += y; s.xx += x * x; s.xy += x * y;
    });
  }
  TRAIT_NAMES.forEach((trait) => {
    const s = sums[trait];
    const slope = (s.xy / FAMILIES - (s.x / FAMILIES) * (s.y / FAMILIES))
      / (s.xx / FAMILIES - (s.x / FAMILIES) ** 2);
    const h2 = heritability(trait);
    assert.ok(Math.abs(slope - h2) < 0.06, `${trait}: slope ${slope.toFixed(3)} vs h² ${h2.toFixed(3)}`);
  });
});

test('heritabilities sit where the design wants them', () => {
  const h2 = Object.fromEntries(TRAIT_NAMES.map((t) => [t, heritability(t)]));
  ['fiberDiameter', 'density', 'stapleLength'].forEach((t) => assert.ok(h2[t] >= 0.3 && h2[t] <= 0.6, t));
  ['fertility', 'hardiness'].forEach((t) => assert.ok(h2[t] >= 0.1 && h2[t] <= 0.2, t));
  ['docility', 'size'].forEach((t) => assert.ok(h2[t] >= 0.3 && h2[t] <= 0.4, t));
});
