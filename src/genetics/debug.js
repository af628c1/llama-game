// Dev-console commands for the genetics. In the browser they are on `window.genetics`
// (main.js puts them there):
//
//   genetics.help()
//   genetics.herd()                                   the player's animals, as they truly are
//   genetics.spawnFounder('fine_fleece', 'M')
//   genetics.forceBreed(sireId, damId)
//   genetics.fastForwardPregnancy(damId)
//   genetics.showGenome(id)
//   genetics.showPedigree(id, 3)
//   genetics.kinship(a, b)
//   genetics.playerView(id, 2)
//   genetics.simulateGenerations(8, 30, 'best-to-best')
//
// These see and change everything, hidden or not: they are for building and balancing the
// game, never for the game itself. Each prints what it did and returns the data.

import {
  PLAYER_ID, GESTATION_DAYS, YEAR_DAYS, TRAITS, DEFECTS, AGE,
} from './config.js';
import Genetics from './Genetics.js';
import { spawnFounder } from './founders.js';
import { ofAlpaca as coatOf, getFleece } from './color.js';
import { affectedBy, DEFECT_IDS } from './defects.js';
import { copies, TRAIT_NAMES } from './genome.js';
import { ageOn } from './traits.js';

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

// One line about an animal, with nothing held back.
function describe(world, alpaca) {
  const traits = world.phenotype(alpaca);
  return {
    id: alpaca.id,
    name: alpaca.name,
    sex: alpaca.sex,
    owner: alpaca.ownerId,
    alive: alpaca.alive,
    ageYears: round(ageOn(alpaca, world.day) / YEAR_DAYS, 1),
    color: coatOf(alpaca).colorKey,
    fleece: getFleece(alpaca.genome),
    F: round(alpaca.inbreedingF, 3),
    defects: affectedBy(alpaca.genome).join(' '),
    carries: DEFECT_IDS.filter((id) => copies(alpaca.genome, DEFECTS[id].locus, 'd') === 1).join(' '),
    pregnant: alpaca.pregnancy ? `due day ${alpaca.pregnancy.dueDay}` : '',
    microns: round(traits.fiberDiameter, 1),
    density: round(traits.density),
    hardiness: round(traits.hardiness),
    fertility: round(traits.fertility),
  };
}

// --- simulateGenerations -----------------------------------------------------------------
// Breed a herd for n generations in a world of its own (the game's is not touched) and
// report how it fares, generation by generation. For checking the balance of config.js.
//   strategy  'random'        any male to any female
//             'best-to-best'  the finest-fleeced fifth of the males to the finest half of
//                             the females
//             'sibling'       brother to sister wherever there is such a pair, and the
//                             closest relatives otherwise
//   options   seed, and bloodline (the herd the simulation starts from; default 'starter')

function choosePairs(world, herd, strategy) {
  const { rng, pedigree } = world;
  const males = herd.filter((a) => a.sex === 'M');
  const females = herd.filter((a) => a.sex === 'F');
  if (!males.length || !females.length) return [];

  if (strategy === 'best-to-best') {
    const fineness = (a) => world.phenotype(a).fiberDiameter;
    const best = (list, share) => [...list].sort((a, b) => fineness(a) - fineness(b))
      .slice(0, Math.max(1, Math.round(list.length * share)));
    const sires = best(males, 0.2);
    return best(females, 0.5).map((dam, i) => [sires[i % sires.length], dam]);
  }
  if (strategy === 'sibling') {
    return females.map((dam) => {
      const closest = males.reduce((a, b) => (
        pedigree.kinship(b.id, dam.id) > pedigree.kinship(a.id, dam.id) ? b : a
      ));
      return [closest, dam];
    });
  }
  if (strategy !== 'random') throw new Error(`no such strategy: '${strategy}'`);
  return females.map((dam) => [rng.pick(males), dam]);
}

function summarize(world, generation, herd, births) {
  const adultDay = (alpaca) => alpaca.birthDay + AGE.adultDays;
  const traitMean = (trait) => round(mean(herd.map((a) => world.phenotype(a, adultDay(a))[trait])), 2);
  const row = {
    generation,
    herd: herd.length,
    microns: traitMean('fiberDiameter'),
    density: traitMean('density'),
    hardiness: traitMean('hardiness'),
    fertility: traitMean('fertility'),
    size: traitMean('size'),
    meanF: round(mean(herd.map((a) => a.inbreedingF)), 3),
    births: births.length,
    criaDeaths: births.filter((a) => !a.alive).length,
    deathRate: births.length ? round(births.filter((a) => !a.alive).length / births.length, 3) : 0,
    affected: births.filter((a) => affectedBy(a.genome).length).length,
  };
  // How common each defect's allele is in the herd.
  DEFECT_IDS.forEach((id) => {
    row[`d:${id}`] = round(mean(herd.map((a) => copies(a.genome, DEFECTS[id].locus, 'd') / 2)), 3);
  });
  return row;
}

export function simulateGenerations(n, herdSize, strategy = 'random', { seed = 1, bloodline = 'starter' } = {}) {
  const world = new Genetics({ seed });
  let herd = world.generateHerd(bloodline, herdSize, { ownerId: 'sim' });
  const rows = [summarize(world, 0, herd, [])];
  const longestDeath = Math.max(0, ...Object.values(DEFECTS).map((d) => d.lethalWithinDays || 0));

  for (let generation = 1; generation <= n; generation++) {
    // On to when the last generation has grown up. (Nobody is pregnant in between.)
    world.day += AGE.adultDays;
    const pairs = choosePairs(world, herd, strategy);
    if (!pairs.length) break; // one sex has died out

    // Each pair breeds in turn, round and round, until the herd is replaced — or it is
    // plain that it won't be.
    const births = [];
    for (let i = 0; i < herdSize * 8 && births.filter((a) => a.alive).length < herdSize; i++) {
      const [sire, dam] = pairs[i % pairs.length];
      dam.pregnancy = { sireId: sire.id, conceivedDay: world.day, dueDay: world.day, modifiers: [], known: true };
      births.push(world.breeding.giveBirth(dam.id, world.day));
    }
    world.tick(world.day + longestDeath + 1); // crias with a lethal defect die in their first days
    herd = births.filter((a) => a.alive);
    rows.push(summarize(world, generation, herd, births));
    if (!herd.length) break;
  }
  return rows;
}

// --- The console -------------------------------------------------------------------------

// The commands, for whatever world `getWorld()` returns at the time (the game's world is
// replaced when a save is loaded). `out` is where they print: the console.
export function createDebug(getWorld, out = console) {
  const table = (rows) => (out.table ? out.table(rows) : out.log(rows));
  const need = (id) => getWorld().pedigree.need(id);

  const commands = {
    help() {
      out.log([
        'herd(ownerId = "player")              list a herd, hiding nothing',
        'spawnFounder(bloodline, sex)          add an unrelated adult to the player\'s herd',
        'forceBreed(sireId, damId)             make the dam pregnant by the sire, whatever the odds',
        'fastForwardPregnancy(damId)           she gives birth now',
        'showGenome(id)                        raw genotypes, breeding values, F',
        'showPedigree(id, generations = 3)     the family tree',
        'kinship(idA, idB)                     kinship coefficient of two animals',
        'playerView(id, skill = 3)             what the player is shown (quipu.getPlayerView)',
        'forecast(sireId, damId, skill = 3)    what the player is told of a pairing',
        'simulateGenerations(n, herdSize, strategy = "random", { seed, bloodline })',
        '                                      strategy: "random" | "best-to-best" | "sibling"',
      ].join('\n'));
    },

    herd(ownerId = PLAYER_ID) {
      const world = getWorld();
      const rows = world.pedigree.herdOf(ownerId).map((alpaca) => describe(world, alpaca));
      table(rows);
      return rows;
    },

    spawnFounder(profile = 'starter', sex = 'F') {
      const world = getWorld();
      const alpaca = spawnFounder(profile, sex, world.rng, {
        pedigree: world.pedigree, ownerId: PLAYER_ID, day: world.day,
      });
      world.quipu.record(alpaca.id);
      table([describe(world, alpaca)]);
      return alpaca;
    },

    forceBreed(sireId, damId) {
      const world = getWorld();
      const [sire, dam] = [need(sireId), need(damId)];
      if (sire.sex !== 'M' || dam.sex !== 'F' || !sire.alive || !dam.alive) {
        throw new Error('forceBreed needs a living male and a living female, in that order');
      }
      dam.lastMating = { sireId, day: world.day };
      dam.pregnancy = {
        sireId, conceivedDay: world.day, dueDay: world.day + GESTATION_DAYS, modifiers: [], known: false,
      };
      world.quipu.onMating(sire, dam);
      world.events.emit('conceived', { damId, sireId, day: world.day, dueDay: dam.pregnancy.dueDay });
      out.log(`${damId} is pregnant by ${sireId}, due on day ${dam.pregnancy.dueDay}`);
      return dam.pregnancy;
    },

    fastForwardPregnancy(damId) {
      const world = getWorld();
      const cria = world.breeding.giveBirth(damId, world.day);
      if (!cria) {
        out.log(`${damId} is not pregnant`);
        return null;
      }
      table([describe(world, cria)]);
      if (!cria.alive) out.log(`the cria died at birth: ${cria.deathCause}`);
      else if (cria.fate) out.log(`the cria will die on day ${cria.fate.day}: ${cria.fate.cause}`);
      return cria;
    },

    showGenome(id) {
      const world = getWorld();
      const alpaca = need(id);
      const traits = world.phenotype(alpaca);
      out.log(`#${id} ${alpaca.sex}  F = ${round(alpaca.inbreedingF, 4)}  ${coatOf(alpaca).colorKey}, ${getFleece(alpaca.genome)}`);
      out.log(Object.entries(alpaca.genome.loci).map(([locus, pair]) => `${locus} ${pair.join('/')}`).join('   '));
      table(TRAIT_NAMES.map((trait) => ({
        trait,
        breedingValue: round(alpaca.genome.breedingValues[trait], 3),
        permEnv: round(alpaca.permEnv[trait], 3),
        mean: TRAITS[trait].mu,
        phenotype: round(traits[trait], 3),
      })));
      return alpaca;
    },

    showPedigree(id, generations = 3) {
      const world = getWorld();
      need(id);
      const lines = [];
      const print = (node, label, depth) => {
        if (!node) return;
        const a = world.pedigree.get(node.id);
        lines.push(`${'    '.repeat(depth)}${label} #${a.id} ${a.sex} ${coatOf(a).colorKey} F=${round(a.inbreedingF, 3)}${a.alive ? '' : ' (dead)'}`);
        print(node.sire, 'sire', depth + 1);
        print(node.dam, 'dam ', depth + 1);
      };
      print(world.pedigree.tree(id, generations), '    ', 0);
      out.log(lines.join('\n'));
      return world.pedigree.tree(id, generations);
    },

    kinship(idA, idB) {
      const value = getWorld().pedigree.kinship(idA, idB);
      out.log(`kinship(${idA}, ${idB}) = ${value}: their cria's inbreeding coefficient would be ${round(value * 100, 2)}%`);
      return value;
    },

    playerView(id, skill = 3) {
      const view = getWorld().quipu.getPlayerView(id, skill);
      out.log(view);
      return view;
    },

    forecast(sireId, damId, skill = 3) {
      const forecast = getWorld().quipu.getPairingForecast(sireId, damId, skill);
      out.log(forecast);
      return forecast;
    },

    simulateGenerations(n = 6, herdSize = 30, strategy = 'random', options = {}) {
      const rows = simulateGenerations(n, herdSize, strategy, options);
      table(rows);
      return rows;
    },
  };
  return commands;
}
