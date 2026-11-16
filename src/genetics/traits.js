// Quantitative traits: what an animal is actually like, worked out from its hidden
// breeding values whenever it is asked for (never stored):
//
//   P = age( mu + BV + permEnv ) + nutrition + inbreeding depression + defects + modifiers
//
//   BV          the breeding value: the part the animal passes on
//   permEnv     its permanent environmental deviation, rolled at birth: the part it doesn't
//   age         fibre coarsens year by year, size grows to adult size, fertility fades
//   nutrition   the animal's nutrition score (-1 to 1) times the trait's `nutrition`
//   depression  -F × the trait's `depression`: inbred animals are less fertile, less hardy
//   defects     what its visible defects (and deafness) cost it
//   modifiers   blessings and the like, through their onPhenotype hook (modifiers.js)
//
// The numbers are TRAITS and AGE in config.js.

import { TRAITS, AGE, YEAR_DAYS, WORD_STEPS } from './config.js';
import { TRAIT_NAMES } from './genome.js';
import { traitEffects, nutritionPenalty } from './defects.js';

const clamp = (value, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, value));

// How old an animal is on a day, in days. The dead stop ageing.
export function ageOn(alpaca, day) {
  const end = !alpaca.alive && alpaca.deathDay !== null ? Math.min(day, alpaca.deathDay) : day;
  return Math.max(0, end - alpaca.birthDay);
}

// The share of its adult size an animal has reached: quick at first, then levelling off.
function grownFraction(ageDays) {
  const t = Math.min(1, ageDays / AGE.adultDays);
  return 1 - (1 - AGE.birthSizeFraction) * (1 - t) ** 2;
}

const yearsPast = (ageDays, fromDays) => Math.max(0, ageDays - fromDays) / YEAR_DAYS;

// What age does to a trait value...
function withAge(trait, value, ageDays) {
  if (trait === 'size') return value * grownFraction(ageDays);
  if (trait === 'fiberDiameter') {
    return value + yearsPast(ageDays, AGE.fiberCoarsenFromDays) * AGE.fiberCoarsenPerYear;
  }
  if (trait === 'fertility') {
    return value - yearsPast(ageDays, AGE.fertilityDeclineFromDays) * AGE.fertilityDeclinePerYear;
  }
  return value;
}

// ...and the same taken back out: what a measured value says about the animal "for its
// age". This is how a young animal's frame or an old one's fleece can be judged fairly.
export function ageAdjusted(trait, value, ageDays) {
  if (trait === 'size') return value / grownFraction(ageDays);
  if (trait === 'fiberDiameter') {
    return value - yearsPast(ageDays, AGE.fiberCoarsenFromDays) * AGE.fiberCoarsenPerYear;
  }
  if (trait === 'fertility') {
    return value + yearsPast(ageDays, AGE.fertilityDeclineFromDays) * AGE.fertilityDeclinePerYear;
  }
  return value;
}

// An animal's traits on a day: { trait: value }.
//   nutritionScore  -1 (starving) to 1 (perfectly fed); 0 is neutral
//   modifiers       Modifier objects whose onPhenotype applies to this animal
export function getPhenotype(alpaca, day, { nutritionScore = 0, modifiers = [] } = {}) {
  const ageDays = ageOn(alpaca, day);
  const nutrition = clamp(nutritionScore - nutritionPenalty(alpaca), -1, 1);
  const fromDefects = traitEffects(alpaca);

  let traits = {};
  TRAIT_NAMES.forEach((trait) => {
    const cfg = TRAITS[trait];
    const born = cfg.mu + alpaca.genome.breedingValues[trait] + alpaca.permEnv[trait];
    const value = withAge(trait, born, ageDays)
      + nutrition * cfg.nutrition
      - alpaca.inbreedingF * cfg.depression
      + (fromDefects[trait] || 0);
    traits[trait] = clamp(value, cfg.min, cfg.max);
  });

  modifiers.forEach((modifier) => {
    if (modifier.onPhenotype) traits = modifier.onPhenotype(alpaca, traits) || traits;
  });
  return traits;
}

// The spread of a trait across the population: the SD of its phenotype.
export const phenotypeSd = (trait) => Math.hypot(TRAITS[trait].sigmaA, TRAITS[trait].sigmaE);

export const heritability = (trait) => TRAITS[trait].sigmaA ** 2 / phenotypeSd(trait) ** 2;

// A trait value in a word ("fine", "sturdy"), judged for the animal's age. Traits that
// can't be seen by looking (fertility) have no words and give null.
export function describe(trait, value, ageDays) {
  const { words, mu } = TRAITS[trait];
  if (!words) return null;
  const z = (ageAdjusted(trait, value, ageDays) - mu) / phenotypeSd(trait);
  const step = WORD_STEPS.findIndex((limit) => z < limit);
  return words[step < 0 ? words.length - 1 : step];
}
