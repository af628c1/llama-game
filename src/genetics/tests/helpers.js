// Shared by the genetics tests: quick ways to make genomes and animals by hand.

import { ALLELES, LOCUS_NAMES, TRAIT_NAMES } from '../genome.js';

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
