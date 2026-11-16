// Every number the genetics system runs on. Change the game's balance here — nothing in
// the other genetics modules has a rate, a threshold or a size of its own.
//
// Times are in game days. A year is four 30-day seasons (CALENDAR in ../config.js), so a
// real alpaca's life is squeezed hard: see BREEDING for how.

import { CALENDAR } from '../config.js';

export const SEASON_DAYS = CALENDAR.daysPerSeason;
export const YEAR_DAYS = CALENDAR.seasons.length * CALENDAR.daysPerSeason;

// The version of the saved genetics data (serialize.js). Raise it when that data changes
// shape, and add a migration from the old version there.
export const GENETICS_SCHEMA_VERSION = 1;

// --- Mendelian loci ----------------------------------------------------------------------
// Each locus has two alleles, the dominant one listed first. An animal carries two copies,
// one from each parent. Simplified from the real genes: MC1R and ASIP decide which pigment
// is made, and grey and white spotting (both KIT-linked in alpacas) are patterns on top.
export const LOCI = {
  MC1R: { alleles: ['E', 'e'] }, // e/e can't make black pigment: the fawn/white family
  ASIP: { alleles: ['A', 'a'] }, // a/a (with E) makes only black pigment: the black family
  GREY: { alleles: ['G', 'g'] }, // G dilutes black pigment to grey, with a white "tuxedo"
  SPOT: { alleles: ['S', 's'] }, // S adds white markings
  FLEECE: { alleles: ['Su', 'hu'] }, // Su = Suri (dominant), hu/hu = Huacaya
};

// --- Coat colour -------------------------------------------------------------------------
// Shade is a quantitative trait (see TRAITS), cut into tiers per colour family: a tier is
// used while the shade is below its `below`, and the last tier has no limit. The key is
// what the front end will map to a sprite; patterns add '_grey' and '_spotted' to it.
export const COLOR = {
  families: {
    fawn: [
      { tier: 'white', key: 'white', below: 0.25 },
      { tier: 'light', key: 'fawn_light', below: 0.45 },
      { tier: 'medium', key: 'fawn', below: 0.7 },
      { tier: 'dark', key: 'fawn_dark' },
    ],
    brown: [
      { tier: 'light', key: 'brown_light', below: 0.35 },
      { tier: 'medium', key: 'brown', below: 0.65 },
      { tier: 'dark', key: 'brown_dark' },
    ],
    black: [
      { tier: 'light', key: 'black_charcoal', below: 0.3 },
      { tier: 'medium', key: 'black', below: 0.65 },
      { tier: 'dark', key: 'black_true' },
    ],
  },
  bewKey: 'bew', // blue-eyed white: grey and spotting together
  // White markings can't be seen on a white coat, so these tiers never count as spotted.
  hidesSpots: ['white'],
};

// A blue-eyed white is often deaf. (The spec's BEW_DEAF_CHANCE.)
export const BEW_DEAF_CHANCE = 0.6;
export const DEAF = {
  traitEffects: { docility: -12 }, // hard to herd: it can't hear the herd, or you
  detectAgeDays: 4, // how old a cria is when it becomes clear that it can't hear
};

// --- Quantitative traits -----------------------------------------------------------------
// Each trait is a hidden breeding value (what the animal passes on) plus a permanent
// environmental deviation rolled at birth (what it doesn't).
//   mu          the population mean
//   sigmaA      SD of breeding values
//   sigmaE      SD of the environmental deviation
//               heritability h² = sigmaA² / (sigmaA² + sigmaE²), noted on each line
//   depression  what a fully inbred animal (F = 1) loses; at F = 0.25, a quarter of it
//   nutrition   what a perfectly fed animal (nutrition score +1) gains; -1 loses as much
//   min, max    limits on the phenotype
//   words       how the trait is described to the player, from lowest to highest
//               (traits without words aren't something you can see by looking)
export const TRAITS = {
  // Microns. Lower is finer, and better. Well-fed animals grow coarser fibre, as in life.
  fiberDiameter: {
    mu: 25, sigmaA: 2.0, sigmaE: 2.0, // h² 0.50
    depression: 0, nutrition: 1.0, min: 12, max: 45,
    words: ['very fine', 'fine', 'medium', 'coarse', 'very coarse'],
  },
  // Fleece density, on a 0–100 scale.
  density: {
    mu: 50, sigmaA: 6, sigmaE: 8, // h² 0.36
    depression: 4, nutrition: 4, min: 0, max: 100,
    words: ['sparse', 'thin', 'average', 'dense', 'very dense'],
  },
  // Centimetres of fleece grown in a year.
  stapleLength: {
    mu: 10, sigmaA: 1.0, sigmaE: 1.2, // h² 0.41
    depression: 0.5, nutrition: 0.8, min: 2, max: 25,
    words: ['very short', 'short', 'average', 'long', 'very long'],
  },
  // Resistance to cold, illness and hard seasons, 0–100.
  hardiness: {
    mu: 50, sigmaA: 4, sigmaE: 10, // h² 0.14
    depression: 30, nutrition: 8, min: 0, max: 100,
    words: ['frail', 'delicate', 'healthy', 'sturdy', 'very sturdy'],
  },
  // 0–100. Feeds the chance of conceiving (BREEDING.conception). Not visible.
  fertility: {
    mu: 50, sigmaA: 3.5, sigmaE: 10, // h² 0.11
    depression: 30, nutrition: 8, min: 0, max: 100,
  },
  // Temperament, 0–100.
  docility: {
    mu: 50, sigmaA: 6, sigmaE: 8.5, // h² 0.33
    depression: 0, nutrition: 0, min: 0, max: 100,
    words: ['wild', 'skittish', 'calm', 'gentle', 'very gentle'],
  },
  // Adult weight in kilograms.
  size: {
    mu: 65, sigmaA: 4, sigmaE: 5, // h² 0.39
    depression: 12, nutrition: 6, min: 3, max: 110,
    words: ['very small', 'small', 'average', 'large', 'very large'],
  },
  // How dark the coat is, 0 (palest) to 1 (darkest): see COLOR. Not limited here; the
  // colour tiers take whatever comes. It stands in for the many small genes that make real
  // alpaca colour so hard to predict.
  shade: {
    mu: 0.5, sigmaA: 0.15, sigmaE: 0.15, // h² 0.50
    depression: 0, nutrition: 0,
  },
};

// How far from the mean, in SDs of the trait, each of a trait's five words begins.
export const WORD_STEPS = [-1.2, -0.4, 0.4, 1.2];

// How traits change with age.
export const AGE = {
  adultDays: 2 * YEAR_DAYS, // full size is reached here
  birthSizeFraction: 0.12, // a cria is born at about an eighth of its adult weight
  // Fibre coarsens with every year after the first fleece.
  fiberCoarsenFromDays: YEAR_DAYS,
  fiberCoarsenPerYear: 0.5, // microns
  // Fertility falls away in old age.
  fertilityDeclineFromDays: 10 * YEAR_DAYS,
  fertilityDeclinePerYear: 5,
};

// --- Genetic defects ---------------------------------------------------------------------
// Each defect is a locus of its own with the alleles N (normal) and d. Carriers (N/d) are
// perfectly normal; only d/d animals are affected. To add a defect, add an entry: nothing
// else needs to change, and animals born before it existed count as N/N.
//   locus             its name in a genome
//   severity          'lethal' | 'moderate' | 'mild' (for the front end's wording)
//   lethalWithinDays  an affected cria dies this many days after birth, at the latest
//   traitEffects      added to an affected animal's traits
//   nutritionPenalty  taken off its nutrition score (it can't feed well)
//   valueMultiplier   what it is worth at sale or show, against a sound animal
export const DEFECT_ALLELES = ['N', 'd'];
export const DEFECTS = {
  // The nasal passages are closed: the cria can't breathe and nurse at once. (The spec's
  // CHOANAL_DEATH_DAYS is lethalWithinDays here.)
  choanal_atresia: { locus: 'CHOANAL', severity: 'lethal', lethalWithinDays: 3, valueMultiplier: 0 },
  wry_face: {
    locus: 'WRY', severity: 'moderate',
    traitEffects: { hardiness: -10 }, nutritionPenalty: 0.3, valueMultiplier: 0.4,
  },
  short_ears: { locus: 'EARS', severity: 'mild', valueMultiplier: 0.8 },
  polydactyly: {
    locus: 'TOES', severity: 'mild', traitEffects: { hardiness: -3 }, valueMultiplier: 0.75,
  },
};

// --- Breeding ----------------------------------------------------------------------------
// The timescale. A real alpaca carries for about 11.5 months and has one cria a year. Here
// a pregnancy takes one season, and the rest of the year is rest, so the rhythm stays one
// cria per female per year: two or three over the three-year story.
export const GESTATION_DAYS = SEASON_DAYS;
export const GESTATION_JITTER_DAYS = 2; // a birth comes up to this many days early or late
export const POSTPARTUM_REST_DAYS = 3 * SEASON_DAYS;
export const MIN_BREED_AGE_F = YEAR_DAYS;
export const MIN_BREED_AGE_M = 1.5 * YEAR_DAYS;
export const MAX_BREED_AGE = 14 * YEAR_DAYS;

export const BREEDING = {
  maleBirthRate: 0.5,

  // The chance that a mating takes: `base` for two animals of average fertility, moved by
  // each point of fertility away from 50, and by the dam's nutrition score (-1 to 1).
  conception: {
    base: 0.7, perDamFertility: 0.008, perSireFertility: 0.004, nutrition: 0.15, min: 0.05, max: 0.95,
  },

  // The spit-off test: a pregnant female spits at the male. From `minDays` after
  // conception it shows a pregnancy `reliability` of the time; before that, never.
  spitOff: { minDays: 5, reliability: 0.9 },

  // The chance, each day, that a pregnancy is lost: `dailyBase` (about 6% over a whole
  // pregnancy), multiplied up or down by the dam's hardiness (per point away from 50), her
  // nutrition score (-1 to 1) and the day's weather stress (0 to 1).
  miscarriage: {
    dailyBase: 0.002, perHardiness: 0.02, nutrition: 0.5, weather: 1.0, minFactor: 0.25, maxFactor: 4,
  },
};

// Whether a newborn lives: BASE_CRIA_SURVIVAL, less the inbreeding coefficient times
// INBREEDING_SURVIVAL_PENALTY (a sibling mating, F = 0.25, costs 0.2; a mating within one
// family's herd, F around 0.13, about 0.1), moved by each point of the cria's hardiness
// away from 50 — which inbreeding lowers too.
export const BASE_CRIA_SURVIVAL = 0.93;
export const INBREEDING_SURVIVAL_PENALTY = 0.8;
export const CRIA_SURVIVAL = { perHardiness: 0.004, min: 0.05, max: 0.99 };

// --- Quipu: what the player can know -----------------------------------------------------
// The spec's QUIPU_SKILL: the level (0–3, set by story progress) from which each kind of
// knowledge is shown.
export const QUIPU_SKILL = {
  looks: 0, // sex, age, colour, fleece, visible defects, parents, traits in words
  traitEstimates: 1, // an estimate of what the animal passes on, and how sure it is
  carrierOdds: 2, // carrier status for each defect
  colorGenes: 3, // which colour alleles the animal must carry
  kinship: 3, // how related a pair is, and the inbreeding of their cria
};

export const QUIPU = {
  // An animal younger than this has nothing worth recording about its fleece or frame yet.
  minObservationAgeDays: SEASON_DAYS,
  // With no family history to go on, the odds assumed that an animal carries a defect.
  // Only used once there is other evidence (offspring from a known carrier) to weigh.
  carrierPrior: 0.15,
  // At or below these odds of carrying, an animal that has been test-mated is "likely clear".
  likelyClearBelow: 0.1,
  // Kinship between a pair from which the forecast warns: their cria's inbreeding
  // coefficient is that kinship. 0.0625 is first cousins, 0.125 half siblings.
  kinshipWarning: { related: 0.03, close: 0.125 },
};

// --- Founders and bloodlines -------------------------------------------------------------
// A herd is not made of strangers: founders.js starts each family from `baseSize`
// unrelated animals and quietly breeds `generations` generations from them, using only a
// few sires each time, so the animals that exist when the story starts share ancestors.
// With these numbers a herd's animals are on average about as related as half siblings
// (kinship around 0.13) and slightly inbred themselves (F around 0.04). A bigger base or
// more sires makes them less so.
export const FOUNDERS = {
  generations: 3,
  baseSize: 16,
  siresPerGeneration: 4,
  femaleFraction: 0.7, // of the herd that exists when the story starts
  ageDays: [1.5 * YEAR_DAYS, 7 * YEAR_DAYS], // how old those animals are, at random
  generationGapDays: 7 * YEAR_DAYS, // how much earlier each generation before them was born
};

// A bloodline says what a family's animals are like.
//   dominantFreq  for each locus, how common the dominant allele is in the base animals
//   traitMeans    how far the base animals' breeding values sit from the population mean
//   carrierRate   for each defect, the share of base animals that carry it (N/d)
//   ensureCarrier defects that at least one animal of the herd is certain to carry
// A profile only lists what differs from BLOODLINE_DEFAULTS.
export const BLOODLINE_DEFAULTS = {
  dominantFreq: { MC1R: 0.45, ASIP: 0.6, GREY: 0.03, SPOT: 0.06, FLEECE: 0.04 },
  traitMeans: {},
  carrierRate: { choanal_atresia: 0.06, wry_face: 0.05, short_ears: 0.08, polydactyly: 0.06 },
  ensureCarrier: [],
};

export const BLOODLINES = {
  // The player's inheritance: a few plain animals, and trouble hidden in them.
  starter: {
    label: 'The old herd',
    traitMeans: {
      fiberDiameter: 2, density: -5, stapleLength: -0.6, hardiness: -3, fertility: -2, size: -3,
    },
    carrierRate: { choanal_atresia: 0.25, polydactyly: 0.15 },
    ensureCarrier: ['choanal_atresia'],
  },
  // Famous for fine, pale fleece — and for crias that don't live.
  fine_fleece: {
    label: 'Fine-fleece line',
    dominantFreq: { MC1R: 0.15 },
    traitMeans: { fiberDiameter: -3, density: 4, hardiness: -4, shade: -0.15 },
    carrierRate: { choanal_atresia: 0.3 },
  },
  // Dark, big, coarse-fleeced animals that shrug off the puna winter.
  hardy_highland: {
    label: 'Highland line',
    dominantFreq: { MC1R: 0.75, ASIP: 0.45 },
    traitMeans: { fiberDiameter: 3, hardiness: 8, fertility: 3, size: 4, shade: 0.1 },
    carrierRate: { choanal_atresia: 0.02, wry_face: 0.12 },
  },
  // Keepers of the rare Suri: long, lustrous locks on a delicate animal.
  suri_keepers: {
    label: 'Suri line',
    dominantFreq: { FLEECE: 0.6 },
    traitMeans: { stapleLength: 1.5, density: -3, fertility: -3 },
    carrierRate: { polydactyly: 0.2 },
  },
  // Greys and pintos, bred for looks and gentleness. Grey to spotted risks a deaf white.
  grey_painted: {
    label: 'Grey and painted line',
    dominantFreq: { MC1R: 0.7, ASIP: 0.35, GREY: 0.25, SPOT: 0.2 },
    traitMeans: { docility: 6, fiberDiameter: 1, hardiness: -2 },
    carrierRate: { short_ears: 0.25 },
  },
};

// The herds that exist when a new game starts: who owns each, its bloodline, and how many
// animals. The families are placeholders until the story's own exist.
export const PLAYER_ID = 'player';
export const WORLD_HERDS = [
  { ownerId: PLAYER_ID, bloodline: 'starter', count: 4 },
  { ownerId: 'family:fine_fleece', bloodline: 'fine_fleece', count: 10 },
  { ownerId: 'family:hardy_highland', bloodline: 'hardy_highland', count: 10 },
  { ownerId: 'family:suri_keepers', bloodline: 'suri_keepers', count: 8 },
  { ownerId: 'family:grey_painted', bloodline: 'grey_painted', count: 8 },
];
