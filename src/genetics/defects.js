// Genetic defects: which an animal has, and what they do to it. The defects themselves are
// data (DEFECTS in config.js). Each is one locus with the alleles N and d; an animal with
// d/d is affected, one with N/d is a carrier and no different from a clear animal in any
// way that can be seen or measured.

import { DEFECTS, DEAF } from './config.js';
import { copies } from './genome.js';

export const DEFECT_IDS = Object.keys(DEFECTS);

// The defects an animal shows (d/d), by id.
export function affectedBy(genome) {
  return DEFECT_IDS.filter((id) => copies(genome, DEFECTS[id].locus, 'd') === 2);
}

// Does the animal carry one hidden copy? Never show this to the player: quipu.js works
// out what they can know about carriers from what they have seen.
export const isCarrier = (genome, id) => copies(genome, DEFECTS[id].locus, 'd') === 1;

// The lethal defect an animal has, if any: { id, withinDays }.
export function lethalDefect(genome) {
  const id = affectedBy(genome).find((d) => DEFECTS[d].lethalWithinDays !== undefined);
  return id ? { id, withinDays: DEFECTS[id].lethalWithinDays } : null;
}

// What an animal's defects, and deafness, add to its traits: { trait: change }.
export function traitEffects(alpaca) {
  const total = {};
  const add = (effects = {}) => Object.entries(effects).forEach(([trait, change]) => {
    total[trait] = (total[trait] || 0) + change;
  });
  affectedBy(alpaca.genome).forEach((id) => add(DEFECTS[id].traitEffects));
  if (alpaca.flags.deaf) add(DEAF.traitEffects);
  return total;
}

// How much an animal's defects take off its nutrition score (it can't feed well).
export function nutritionPenalty(alpaca) {
  return affectedBy(alpaca.genome).reduce((sum, id) => sum + (DEFECTS[id].nutritionPenalty || 0), 0);
}

// What the animal is worth at sale or show against a sound one: 1 for no defects. For the
// economy, later.
export function valueMultiplier(alpaca) {
  return affectedBy(alpaca.genome).reduce((value, id) => value * (DEFECTS[id].valueMultiplier ?? 1), 1);
}

// A deaf animal doesn't hear a predator coming.
export const predatorRisk = (alpaca) => Boolean(alpaca.flags.deaf);
