// Shared by the genetics tests: quick ways to make genomes and animals by hand.

import { ALLELES, LOCUS_NAMES, TRAIT_NAMES } from '../genome.js';
import { YEAR_DAYS } from '../config.js';
import Genetics from '../Genetics.js';
import { newAlpaca } from '../breeding.js';

export const zeroTraits = () => Object.fromEntries(TRAIT_NAMES.map((trait) => [trait, 0]));

// A genome with the same kind of genotype at every locus — 'het', 'dom' or 'rec' — and
// breeding values of zero. `loci` overrides single loci: { MC1R: ['e', 'e'] }.
export function uniformGenome(kind, loci = {}) {
  const all = {};
  LOCUS_NAMES.forEach((locus) => {
    const [dominant, recessive] = ALLELES[locus];
    all[locus] = {
      het: [dominant, recessive], dom: [dominant, dominant], rec: [recessive, recessive],
    }[kind];
  });
  return { loci: { ...all, ...loci }, breedingValues: zeroTraits() };
}

// A plain, sound, solid-coloured genome: recessive at every colour locus (a fawn Huacaya)
// and clear of every defect. `loci` overrides single loci.
export function plainGenome(loci = {}) {
  const genome = uniformGenome('rec');
  LOCUS_NAMES.forEach((locus) => {
    if (ALLELES[locus][0] === 'N') genome.loci[locus] = ['N', 'N'];
  });
  Object.assign(genome.loci, loci);
  return genome;
}

// An empty world. Every test names its seed, so every test is the same on every run.
export const makeWorld = (seed, options = {}) => new Genetics({ seed, ...options });

// Register a sound adult made by hand: average in every trait unless `bv` says otherwise
// ({ fertility: 10 }), plain in colour unless `loci` does ({ CHOANAL: ['N', 'd'] }).
export function adult(world, sex, {
  loci = {}, bv = {}, ownerId = 'player', age = 3 * YEAR_DAYS, sireId = null, damId = null, F = 0, flags = {},
} = {}) {
  const genome = plainGenome(loci);
  Object.assign(genome.breedingValues, bv);
  return world.pedigree.add(newAlpaca({
    sex, ownerId, sireId, damId, birthDay: world.day - age, genome, permEnv: zeroTraits(), inbreedingF: F, flags,
  }));
}

// The dam is pregnant by the sire and gives birth on `day`, skipping conception and the
// wait: returns the cria.
export function birth(world, sire, dam, day = world.day, modifiers = []) {
  dam.pregnancy = { sireId: sire.id, conceivedDay: day, dueDay: day, modifiers, known: false };
  return world.breeding.giveBirth(dam.id, day);
}

// Everything an event emitter says, in order: [{ name, ...payload }].
export function eventLog(world) {
  const log = [];
  world.events.on('*', (payload, name) => log.push({ name, ...payload }));
  return log;
}
