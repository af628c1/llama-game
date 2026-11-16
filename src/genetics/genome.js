// Genomes and how they are passed on. A genome is
//
//   { loci: { MC1R: ['E', 'e'], ..., CHOANAL: ['N', 'd'] },   two alleles at each locus
//     breedingValues: { fiberDiameter: -1.3, ... } }          one number per quantitative trait
//
// and is hidden from the player: only quipu.js decides what of it can be known.
//
// A cria gets one allele of each pair from each parent, chosen at random and separately
// for every locus (no linkage), and breeding values that are the average of its parents'
// plus a random Mendelian sampling term.

import { LOCI, DEFECTS, DEFECT_ALLELES, TRAITS } from './config.js';

export const TRAIT_NAMES = Object.keys(TRAITS);

// Every locus by name -> its [dominant, recessive] alleles: the colour and fleece loci,
// then one per defect.
export const ALLELES = {};
Object.entries(LOCI).forEach(([locus, { alleles }]) => { ALLELES[locus] = alleles; });
Object.values(DEFECTS).forEach(({ locus }) => { ALLELES[locus] = DEFECT_ALLELES; });
export const LOCUS_NAMES = Object.keys(ALLELES);

const DEFECT_LOCI = new Set(Object.values(DEFECTS).map(({ locus }) => locus));

// A pair of alleles in a fixed order (dominant first), so that E/e and e/E are one thing.
export function pair(locus, first, second) {
  const order = ALLELES[locus];
  return order.indexOf(first) <= order.indexOf(second) ? [first, second] : [second, first];
}

// An animal's two alleles at a locus. A defect locus the genome doesn't have (the defect
// was added to the game after the animal was born) reads as normal.
export function genotype(genome, locus) {
  const alleles = genome.loci[locus];
  if (alleles) return alleles;
  if (DEFECT_LOCI.has(locus)) return [DEFECT_ALLELES[0], DEFECT_ALLELES[0]];
  throw new Error(`genome has no ${locus} locus`);
}

// How many copies (0, 1 or 2) of an allele an animal has at a locus.
export function copies(genome, locus, allele) {
  const [first, second] = genotype(genome, locus);
  return (first === allele ? 1 : 0) + (second === allele ? 1 : 0);
}

// Does the animal show the dominant allele of a locus (carry at least one copy)?
export const hasDominant = (genome, locus) => copies(genome, locus, ALLELES[locus][0]) > 0;

// A genotype for a base animal: each allele is the dominant one with probability
// `dominantFreq`.
export function randomGenotype(rng, locus, dominantFreq) {
  const [dominant, recessive] = ALLELES[locus];
  const draw = () => (rng.chance(dominantFreq) ? dominant : recessive);
  return pair(locus, draw(), draw());
}

// Meiosis and fertilisation: for every locus, one allele from the sire and one from the dam.
export function inheritLoci(rng, sireGenome, damGenome) {
  const loci = {};
  LOCUS_NAMES.forEach((locus) => {
    const fromSire = rng.pick(genotype(sireGenome, locus));
    const fromDam = rng.pick(genotype(damGenome, locus));
    loci[locus] = pair(locus, fromSire, fromDam);
  });
  return loci;
}

// A cria's breeding values: the parents' average plus Mendelian sampling,
//
//   BV = (BV_sire + BV_dam) / 2 + Normal(0, sqrt(sigmaA² / 2 × (1 − (F_sire + F_dam) / 2)))
//
// Inbred parents have less variation left to hand on, so their crias vary less.
export function inheritBreedingValues(rng, sire, dam) {
  const meanF = (sire.inbreedingF + dam.inbreedingF) / 2;
  const values = {};
  TRAIT_NAMES.forEach((trait) => {
    const { sigmaA } = TRAITS[trait];
    const sd = Math.sqrt((sigmaA ** 2 / 2) * (1 - meanF));
    const midParent = (sire.genome.breedingValues[trait] + dam.genome.breedingValues[trait]) / 2;
    values[trait] = midParent + rng.normal(0, sd);
  });
  return values;
}

// Breeding values for a base animal, around the population mean shifted by `means`
// (a bloodline's traitMeans).
export function randomBreedingValues(rng, means = {}) {
  const values = {};
  TRAIT_NAMES.forEach((trait) => {
    values[trait] = rng.normal(means[trait] || 0, TRAITS[trait].sigmaA);
  });
  return values;
}

// The permanent environmental deviation of each trait, rolled once at birth: everything
// about how an animal turned out that it can't pass on.
export function rollPermEnv(rng) {
  const permEnv = {};
  TRAIT_NAMES.forEach((trait) => { permEnv[trait] = rng.normal(0, TRAITS[trait].sigmaE); });
  return permEnv;
}
