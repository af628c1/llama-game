// Founders: the herds that already exist when the story begins.
//
// A herd is not made of strangers. Each family's herd is grown from a handful of unrelated
// base animals by quietly breeding a few generations from them, using only a few sires
// each time and never the closest relatives, as a real herd is bred. So the animals of one
// family share ancestors: they are somewhat related, a little inbred, and their ancestors
// are in the pedigree (as long-dead 'ancestor's) for kinship to find.
//
// What a family's animals are like is its bloodline (BLOODLINES in config.js).

import { FOUNDERS, BLOODLINES, BLOODLINE_DEFAULTS, LOCI, DEFECTS } from './config.js';
import { randomGenotype, randomBreedingValues, rollPermEnv, copies } from './genome.js';
import { getPhenotype as coatOf } from './color.js';
import { lethalDefect } from './defects.js';
import { makeCria, newAlpaca } from './breeding.js';

// A bloodline, by name or as an object, with everything it doesn't say filled in.
export function bloodline(profile) {
  const given = typeof profile === 'string' ? BLOODLINES[profile] : profile;
  if (!given) throw new Error(`there is no bloodline '${profile}'`);
  return {
    ...given,
    dominantFreq: { ...BLOODLINE_DEFAULTS.dominantFreq, ...given.dominantFreq },
    traitMeans: { ...BLOODLINE_DEFAULTS.traitMeans, ...given.traitMeans },
    carrierRate: { ...BLOODLINE_DEFAULTS.carrierRate, ...given.carrierRate },
    ensureCarrier: given.ensureCarrier || BLOODLINE_DEFAULTS.ensureCarrier,
  };
}

// An unrelated base animal of a bloodline. It can carry a defect but never has one.
function baseAnimal(rng, line) {
  const loci = {};
  Object.keys(LOCI).forEach((locus) => {
    loci[locus] = randomGenotype(rng, locus, line.dominantFreq[locus]);
  });
  Object.entries(DEFECTS).forEach(([id, { locus }]) => {
    loci[locus] = rng.chance(line.carrierRate[id] || 0) ? ['N', 'd'] : ['N', 'N'];
  });
  const genome = { loci, breedingValues: randomBreedingValues(rng, line.traitMeans) };
  const flags = coatOf(genome).bew ? { blueEyed: true } : {};
  return newAlpaca({ genome, permEnv: rollPermEnv(rng), flags });
}

// Make sure someone in the herd carries a defect. If nobody does, one animal is given a
// copy — and so is one line of its ancestors back to the base animals, so that the
// pedigree still tells a true story of where it came from.
function ensureCarrier(rng, pedigree, herd, defect) {
  const { locus } = DEFECTS[defect];
  if (herd.some((alpaca) => copies(alpaca.genome, locus, 'd') > 0)) return;
  let alpaca = rng.pick(herd);
  while (alpaca) {
    if (copies(alpaca.genome, locus, 'd') > 0) return; // from here up it is already there
    alpaca.genome.loci[locus] = ['N', 'd'];
    alpaca = pedigree.get(rng.chance(0.5) ? alpaca.sireId : alpaca.damId);
  }
}

// Make a herd of `count` living animals of a bloodline, register them (and the ancestors
// behind them) in the pedigree, and return them.
//
//   profile   a bloodline's name, or a bloodline object
//   rng       the Rng to draw from
//   pedigree  the registry to add to
//   ownerId   who the herd belongs to
//   day       today: the herd's ages are counted back from it
export function generateHerd(profile, count, rng, { pedigree, ownerId = null, day = 0 }) {
  const line = bloodline(profile);
  const { generations, baseSize, siresPerGeneration, femaleFraction, generationGapDays } = FOUNDERS;
  const [youngest, oldest] = FOUNDERS.ageDays;
  // A birthday for an animal `back` generations before the herd that exists today.
  const birthDay = (back) => Math.round(day - rng.between(youngest, oldest) - back * generationGapDays);
  const asAncestor = { alive: false, deathCause: 'ancestor' };

  // The base animals, alternately male and female.
  let parents = [];
  for (let i = 0; i < baseSize; i++) {
    parents.push(pedigree.add({
      ...baseAnimal(rng, line), ...asAncestor, sex: i % 2 ? 'F' : 'M', ownerId, birthDay: birthDay(generations),
    }));
  }

  for (let g = 1; g <= generations; g++) {
    const last = g === generations;
    const size = last ? count : Math.max(baseSize, count);
    // Who is male and who female is settled here rather than by makeCria's roll: every
    // generation needs both, and the herd of today its share of females.
    let females = Math.round(size * (last ? femaleFraction : 0.5));
    if (size >= 2) females = Math.min(size - 1, Math.max(1, females));
    const sexes = rng.shuffle(Array.from({ length: size }, (unused, i) => (i < females ? 'F' : 'M')));

    const sires = rng.shuffle(parents.filter((a) => a.sex === 'M')).slice(0, siresPerGeneration);
    const dams = parents.filter((a) => a.sex === 'F');
    const born = [];
    while (born.length < size) {
      // As a careful breeder would, each dam goes to the sire she is least related to.
      const dam = rng.pick(dams);
      const sire = rng.shuffle(sires).reduce((best, candidate) => (
        pedigree.kinship(candidate.id, dam.id) < pedigree.kinship(best.id, dam.id) ? candidate : best
      ));
      const cria = makeCria(rng, pedigree, sire, dam, 0);
      // A cria with a lethal defect didn't live to be anyone's ancestor.
      if (lethalDefect(cria.genome)) continue;
      cria.sex = sexes[born.length];
      cria.birthDay = birthDay(generations - g);
      cria.ownerId = ownerId;
      if (cria.flags.deaf) cria.flags.deafKnown = true; // everyone knows by now
      born.push(pedigree.add(last ? cria : Object.assign(cria, asAncestor)));
    }
    parents = born;
  }

  line.ensureCarrier.forEach((defect) => ensureCarrier(rng, pedigree, parents, defect));
  return parents;
}
