// Saving and loading the genetics world: the whole pedigree — every animal ever born, the
// dead and their genomes included — with the pregnancies under way, the player's records,
// the day, and the state of the random numbers, so that a loaded game goes on rolling
// exactly as the saved one would have.
//
//   serialize(world)            -> plain data, fit for JSON
//   deserialize(data, options)  -> a world; `options` as for new Genetics()
//
// The data, at schema version 1:
//
//   { geneticsSchemaVersion, day, rng, nextId, recorded,
//     loci:   ['MC1R', ...],    the loci, in the order of each animal's `genes`
//     traits: ['fiberDiameter', ...],   the traits, in the order of its `bv` and `env`
//     animals: [{ id, sex, birthDay, sireId, damId, ownerId, F,
//                 genes: '0100...',   two digits per locus: 0 the dominant allele, 1 the other
//                 bv: [...], env: [...],   breeding values and permanent environment
//                 ...and, only where they aren't empty: name, death: [day, cause], flags,
//                 modifiers, pregnancy, lastMating, lastBirthDay, fate }] }
//
// Naming the loci and traits in the data means the game can grow without breaking a save:
// an animal saved before a defect existed simply lacks its locus (and reads as normal),
// and one saved before a trait existed is average for it. A change that this can't absorb
// needs a raise of GENETICS_SCHEMA_VERSION and an entry in MIGRATIONS.

import { GENETICS_SCHEMA_VERSION } from './config.js';
import { ALLELES, LOCUS_NAMES, TRAIT_NAMES } from './genome.js';
import Genetics from './Genetics.js';
import Rng from './rng.js';
import { newAlpaca } from './breeding.js';

// How to bring data saved at an older schema version up by one:
//   1: (data) => ({ ...data, something: renamed }),   // version 1 -> version 2
const MIGRATIONS = {};

const isEmpty = (object) => Object.keys(object).length === 0;

function packAnimal(alpaca) {
  const row = {
    id: alpaca.id,
    sex: alpaca.sex,
    birthDay: alpaca.birthDay,
    sireId: alpaca.sireId,
    damId: alpaca.damId,
    ownerId: alpaca.ownerId,
    F: alpaca.inbreedingF,
    genes: LOCUS_NAMES.map((locus) => {
      const pair = alpaca.genome.loci[locus];
      // A locus the animal doesn't have (a defect newer than it is) is left blank.
      return pair ? pair.map((allele) => ALLELES[locus].indexOf(allele)).join('') : '--';
    }).join(''),
    bv: TRAIT_NAMES.map((trait) => alpaca.genome.breedingValues[trait]),
    env: TRAIT_NAMES.map((trait) => alpaca.permEnv[trait]),
  };
  if (alpaca.name !== null) row.name = alpaca.name;
  if (!alpaca.alive) row.death = [alpaca.deathDay, alpaca.deathCause];
  if (!isEmpty(alpaca.flags)) row.flags = { ...alpaca.flags };
  if (alpaca.modifiers.length) row.modifiers = [...alpaca.modifiers];
  if (alpaca.pregnancy) row.pregnancy = { ...alpaca.pregnancy, modifiers: [...alpaca.pregnancy.modifiers] };
  if (alpaca.lastMating) row.lastMating = { ...alpaca.lastMating };
  if (alpaca.lastBirthDay !== null) row.lastBirthDay = alpaca.lastBirthDay;
  if (alpaca.fate) row.fate = { ...alpaca.fate };
  return row;
}

export function serialize(world) {
  return {
    geneticsSchemaVersion: GENETICS_SCHEMA_VERSION,
    day: world.day,
    rng: world.rng.save(),
    nextId: world.pedigree.nextId,
    recorded: [...world.quipu.recorded],
    loci: [...LOCUS_NAMES],
    traits: [...TRAIT_NAMES],
    animals: world.pedigree.all().map(packAnimal),
  };
}

// Anything wrong with the data is thrown, so that a bad save is refused whole.
function check(condition, what) {
  if (!condition) throw new Error(`genetics save: ${what}`);
}

const isCount = (n) => Number.isInteger(n) && n >= 0;
const isIdOrNull = (n) => n === null || isCount(n);
const isNumbers = (list, length) => Array.isArray(list) && list.length === length
  && list.every((n) => typeof n === 'number' && Number.isFinite(n));

function unpackAnimal(row, data) {
  check(row !== null && typeof row === 'object', 'an animal is not an object');
  check(isCount(row.id) && row.id > 0, 'an animal has no id');
  const what = `animal ${row.id}`;
  check(row.sex === 'M' || row.sex === 'F', `${what} has no sex`);
  check(Number.isInteger(row.birthDay), `${what} has no birthday`);
  check(isIdOrNull(row.sireId) && isIdOrNull(row.damId), `${what}: bad parents`);
  check(typeof row.F === 'number' && row.F >= 0 && row.F <= 1, `${what}: bad inbreeding coefficient`);
  check(typeof row.genes === 'string' && row.genes.length === 2 * data.loci.length, `${what}: bad genes`);
  check(isNumbers(row.bv, data.traits.length) && isNumbers(row.env, data.traits.length), `${what}: bad trait values`);

  const loci = {};
  data.loci.forEach((locus, i) => {
    const digits = row.genes.slice(2 * i, 2 * i + 2);
    if (digits === '--' || !ALLELES[locus]) return; // not in this animal, or no longer in the game
    const pair = [...digits].map((digit) => ALLELES[locus][Number(digit)]);
    check(pair.every(Boolean), `${what}: bad ${locus} genotype`);
    loci[locus] = pair;
  });
  LOCUS_NAMES.forEach((locus) => {
    check(loci[locus] || ALLELES[locus][0] === 'N', `${what} has no ${locus} locus`);
  });

  // A trait the save doesn't know of: the animal is average for it.
  const byTrait = (list) => Object.fromEntries(TRAIT_NAMES.map((trait) => {
    const at = data.traits.indexOf(trait);
    return [trait, at < 0 ? 0 : list[at]];
  }));

  const { death, pregnancy, lastMating, fate } = row;
  check(death === undefined || (Array.isArray(death) && death.length === 2), `${what}: bad death`);
  check(pregnancy === undefined || (isCount(pregnancy.sireId) && Number.isInteger(pregnancy.conceivedDay)
    && Number.isInteger(pregnancy.dueDay) && Array.isArray(pregnancy.modifiers)
    && typeof pregnancy.known === 'boolean'), `${what}: bad pregnancy`);
  check(lastMating === undefined || (isCount(lastMating.sireId) && Number.isInteger(lastMating.day)), `${what}: bad mating`);
  check(fate === undefined || (Number.isInteger(fate.day) && typeof fate.cause === 'string'), `${what}: bad fate`);

  return newAlpaca({
    id: row.id,
    name: row.name ?? null,
    sex: row.sex,
    birthDay: row.birthDay,
    sireId: row.sireId,
    damId: row.damId,
    ownerId: row.ownerId ?? null,
    alive: death === undefined,
    deathDay: death ? death[0] : null,
    deathCause: death ? death[1] : null,
    genome: { loci, breedingValues: byTrait(row.bv) },
    permEnv: byTrait(row.env),
    inbreedingF: row.F,
    flags: { ...row.flags },
    modifiers: [...(row.modifiers || [])],
    pregnancy: pregnancy ? { ...pregnancy, modifiers: [...pregnancy.modifiers] } : null,
    lastMating: lastMating ? { ...lastMating } : null,
    lastBirthDay: row.lastBirthDay ?? null,
    fate: fate ? { ...fate } : null,
  });
}

// Build a world from saved data. `options` are those of new Genetics(): the events, hooks
// and modifiers the world should be wired to. Throws if the data is from a newer version
// of the game (an error with `newer` set) or isn't sound.
export function deserialize(saved, options = {}) {
  check(saved !== null && typeof saved === 'object', 'not an object');
  const version = saved.geneticsSchemaVersion;
  check(Number.isInteger(version) && version >= 1, 'no schema version');
  if (version > GENETICS_SCHEMA_VERSION) {
    throw Object.assign(new Error('genetics save: made by a newer version of the game'), { newer: true });
  }
  let data = saved;
  for (let v = version; v < GENETICS_SCHEMA_VERSION; v++) data = MIGRATIONS[v](data);

  check(isCount(data.day), 'bad day');
  check(isNumbers(data.rng, 4) && data.rng.every(Number.isInteger), 'bad random number state');
  check(Array.isArray(data.loci) && Array.isArray(data.traits), 'no list of loci or traits');
  check(Array.isArray(data.animals) && Array.isArray(data.recorded), 'no animals or records');

  const world = new Genetics({ ...options, seed: 0 });
  world.rng = new Rng(data.rng);
  world.day = data.day;
  data.animals.forEach((row) => {
    const alpaca = unpackAnimal(row, data);
    // Parents are always saved before their offspring: they were registered first.
    [alpaca.sireId, alpaca.damId].forEach((parentId) => {
      check(parentId === null || world.pedigree.get(parentId), `animal ${alpaca.id}: its parent ${parentId} is missing`);
    });
    world.pedigree.add(alpaca);
  });
  check(isCount(data.nextId) && data.nextId >= world.pedigree.nextId, 'bad next id');
  world.pedigree.nextId = data.nextId;
  data.recorded.forEach((id) => {
    check(world.pedigree.get(id), `a record of a missing animal ${id}`);
    world.quipu.record(id);
  });
  return world;
}
