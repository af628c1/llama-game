// Breeding: pairing, conception, pregnancy and birth.
//
// Alpacas are induced ovulators — there is no heat cycle and no season: any sound adult
// pair can be mated on any day — and they carry one cria at a time. The timescale is
// squeezed to the game's short year (GESTATION_DAYS and its neighbours in config.js).
//
//   canBreed(sire, dam)          may this pair be mated today?
//   attemptConception(sire, dam) mate them: the mating may or may not take
//   spitOffTest(dam)             the farmer's pregnancy test: a pregnant female spits
//   tick(day)                    a day passes: pregnancies advance, may be lost, or end
//   giveBirth(dam)               ...in a birth: a new animal, made from its parents
//
// A pregnancy is not known to the player until a spit-off test shows it or the cria
// arrives: `pregnancy.known` says which. Every roll comes from the world's seeded Rng, in
// a fixed order, so the same seed and the same calls always give the same herd.

import {
  BREEDING, GESTATION_DAYS, GESTATION_JITTER_DAYS, POSTPARTUM_REST_DAYS, MIN_BREED_AGE_F,
  MIN_BREED_AGE_M, MAX_BREED_AGE, BEW_DEAF_CHANCE, DEAF, BASE_CRIA_SURVIVAL,
  INBREEDING_SURVIVAL_PENALTY, CRIA_SURVIVAL, TRAITS,
} from './config.js';
import { inheritLoci, inheritBreedingValues, rollPermEnv } from './genome.js';
import { getPhenotype as coatOf } from './color.js';
import { affectedBy, lethalDefect } from './defects.js';
import { ageOn } from './traits.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// A new animal with everything an Alpaca has, and `fields` on top.
export function newAlpaca(fields) {
  return {
    id: null,
    name: null,
    sex: 'F',
    birthDay: 0, // absolute game day
    sireId: null, // null for founders
    damId: null,
    ownerId: null, // the player, or an NPC family
    alive: true,
    deathDay: null,
    deathCause: null, // 'defect:<id>', 'inbreeding_weakness', 'weak_cria', 'ancestor'
    genome: null, // hidden: { loci, breedingValues }
    permEnv: null, // hidden: permanent environmental deviation of each trait
    inbreedingF: 0, // the inbreeding coefficient, worked out once at birth
    flags: {}, // blueEyed, deaf, deafKnown
    modifiers: [], // ids of the modifiers whose onPhenotype applies to this animal
    pregnancy: null, // females: { sireId, conceivedDay, dueDay, modifiers, known }
    lastMating: null, // females: { sireId, day } of the last time she was mated
    lastBirthDay: null,
    fate: null, // hidden: { day, cause } of a death that is already certain
    ...fields,
  };
}

// Put a cria together from its parents: sex, genome, permanent environment, inbreeding
// coefficient, and — for a blue-eyed white — whether it can hear. It is not yet
// registered, and nothing has been decided about whether it lives.
//
// Rolls, in order: sex, one allele pair per locus, a breeding value per trait, a permanent
// environmental deviation per trait, then deafness if the cria is a blue-eyed white.
export function makeCria(rng, pedigree, sire, dam, day, modifiers = []) {
  const sex = rng.chance(BREEDING.maleBirthRate) ? 'M' : 'F';
  let genome = {
    loci: inheritLoci(rng, sire.genome, dam.genome),
    breedingValues: inheritBreedingValues(rng, sire, dam),
  };
  const permEnv = rollPermEnv(rng);

  const ctx = { sire, dam, day };
  modifiers.forEach((modifier) => {
    if (modifier.onGenome) genome = modifier.onGenome(genome, ctx) || genome;
  });

  const flags = {};
  if (coatOf(genome).bew) {
    flags.blueEyed = true;
    if (rng.chance(BEW_DEAF_CHANCE)) flags.deaf = true;
  }

  return newAlpaca({
    sex,
    birthDay: day,
    sireId: sire.id,
    damId: dam.id,
    ownerId: dam.ownerId,
    genome,
    permEnv,
    inbreedingF: pedigree.kinship(sire.id, dam.id),
    flags,
    modifiers: modifiers.map((modifier) => modifier.id),
  });
}

export default class Breeding {
  constructor(world) {
    this.world = world;
  }

  // May this sire and dam be mated on this day? { ok: true }, or { ok: false, reason }
  // with one of: 'no_such_animal', 'wrong_sex', 'dead', 'too_young', 'too_old', 'pregnant',
  // 'resting', 'stud_unavailable' — and `who` ('sire' or 'dam') where that matters.
  //
  // This is the truth, for the game's own logic: it knows about a pregnancy the player
  // has not found out about. The screen should ask quipu.getPairingForecast() instead,
  // which passes `asPlayerKnows` to have such a pregnancy overlooked.
  canBreed(sireId, damId, day = this.world.day, { asPlayerKnows = false } = {}) {
    const { pedigree, hooks } = this.world;
    const sire = pedigree.get(sireId);
    const dam = pedigree.get(damId);
    const no = (reason, who) => ({ ok: false, reason, ...(who ? { who } : {}) });

    if (!sire || !dam) return no('no_such_animal');
    if (sire.sex !== 'M') return no('wrong_sex', 'sire');
    if (dam.sex !== 'F') return no('wrong_sex', 'dam');
    if (!sire.alive) return no('dead', 'sire');
    if (!dam.alive) return no('dead', 'dam');
    if (ageOn(sire, day) < MIN_BREED_AGE_M) return no('too_young', 'sire');
    if (ageOn(dam, day) < MIN_BREED_AGE_F) return no('too_young', 'dam');
    if (ageOn(sire, day) > MAX_BREED_AGE) return no('too_old', 'sire');
    if (ageOn(dam, day) > MAX_BREED_AGE) return no('too_old', 'dam');
    if (dam.pregnancy && (dam.pregnancy.known || !asPlayerKnows)) return no('pregnant', 'dam');
    if (dam.lastBirthDay !== null && day - dam.lastBirthDay < POSTPARTUM_REST_DAYS) {
      return no('resting', 'dam');
    }
    // Another herd's stud is only there to be used if its owner lends him.
    if (sire.ownerId !== dam.ownerId && !hooks.canUseStud(sireId, dam.ownerId)) {
      return no('stud_unavailable', 'sire');
    }
    return { ok: true };
  }

  // The chance that a mating of this pair takes, before any modifier has its say.
  conceptionChance(sire, dam, day) {
    const { conception } = BREEDING;
    const world = this.world;
    const chance = conception.base
      + (world.phenotype(dam, day).fertility - TRAITS.fertility.mu) * conception.perDamFertility
      + (world.phenotype(sire, day).fertility - TRAITS.fertility.mu) * conception.perSireFertility
      + world.nutritionOf(dam) * conception.nutrition;
    return clamp(chance, conception.min, conception.max);
  }

  // Mate a pair. `modifiers` are the ids (or the objects) of registered modifiers that
  // apply to this mating; they stay with the pregnancy and then the cria.
  //
  // Returns canBreed()'s refusal if they can't be mated, and otherwise
  // { ok: true, conceived }. Whether it took is for the game's logic, not for the player:
  // they find out by a spit-off test, or when the cria comes.
  attemptConception(sireId, damId, day = this.world.day, modifiers = []) {
    const check = this.canBreed(sireId, damId, day);
    if (!check.ok) return check;

    const { pedigree, rng, events, quipu } = this.world;
    const sire = pedigree.get(sireId);
    const dam = pedigree.get(damId);
    const ids = this.world.modifiers.ids(modifiers);

    let ctx = { sire, dam, day, chance: this.conceptionChance(sire, dam, day) };
    this.world.modifiers.resolve(ids).forEach((modifier) => {
      if (modifier.onConception) ctx = modifier.onConception(ctx) || ctx;
    });

    dam.lastMating = { sireId, day };
    quipu.onMating(sire, dam);

    const conceived = rng.chance(clamp(ctx.chance, 0, 1));
    if (conceived) {
      const jitter = rng.int(2 * GESTATION_JITTER_DAYS + 1) - GESTATION_JITTER_DAYS;
      dam.pregnancy = {
        sireId,
        conceivedDay: day,
        dueDay: day + Math.max(1, GESTATION_DAYS + jitter),
        modifiers: ids,
        known: false,
      };
      events.emit('conceived', { damId, sireId, day, dueDay: dam.pregnancy.dueDay });
    }
    return { ok: true, conceived };
  }

  // The spit-off test: put the female with a male and see whether she spits at him and
  // drives him off, as a pregnant female does. { spits }. A pregnancy only shows from a
  // few days in, and now and then not even then: no spitting doesn't prove she is empty.
  spitOffTest(damId, day = this.world.day) {
    const dam = this.world.pedigree.need(damId);
    const { pregnancy } = dam;
    if (!pregnancy) return { spits: false };
    if (pregnancy.known) return { spits: true };

    const { minDays, reliability } = BREEDING.spitOff;
    if (day - pregnancy.conceivedDay < minDays || !this.world.rng.chance(reliability)) {
      return { spits: false };
    }
    pregnancy.known = true;
    this.world.events.emit('pregnancy_revealed', { damId, sireId: pregnancy.sireId, day });
    return { spits: true };
  }

  // One day in the life of the herd. Call once for each new day, in order (the world's
  // tick() does). For every living animal, lowest id first: a death that was already
  // certain comes due; a deaf cria is noticed; a pregnancy is lost, goes on, or ends in a
  // birth.
  tick(day) {
    const world = this.world;
    world.pedigree.living().forEach((alpaca) => {
      if (alpaca.fate && day >= alpaca.fate.day) {
        world.die(alpaca, day, alpaca.fate.cause);
        return;
      }
      if (alpaca.flags.deaf && !alpaca.flags.deafKnown && ageOn(alpaca, day) >= DEAF.detectAgeDays) {
        alpaca.flags.deafKnown = true;
        world.events.emit('deafness_detected', { alpacaId: alpaca.id, day });
      }
      if (!alpaca.pregnancy) return;
      if (day >= alpaca.pregnancy.dueDay) {
        this.giveBirth(alpaca.id, day);
      } else if (world.rng.chance(this.miscarriageChance(alpaca, day))) {
        const { sireId, known } = alpaca.pregnancy;
        alpaca.pregnancy = null;
        world.events.emit('miscarriage', { damId: alpaca.id, sireId, day, known });
      }
    });
  }

  // The chance that a pregnancy is lost on a given day: worse for a frail or hungry dam,
  // and in hard weather.
  miscarriageChance(dam, day) {
    const { miscarriage } = BREEDING;
    const world = this.world;
    const hardiness = world.phenotype(dam, day).hardiness - TRAITS.hardiness.mu;
    const factor = (1 - hardiness * miscarriage.perHardiness)
      * (1 - world.nutritionOf(dam) * miscarriage.nutrition)
      * (1 + world.hooks.getWeatherStress(day) * miscarriage.weather);
    return miscarriage.dailyBase * clamp(factor, miscarriage.minFactor, miscarriage.maxFactor);
  }

  // The chance that a newborn lives, and what it would have been had it not been inbred.
  survivalChance(cria, dam, day) {
    const world = this.world;
    const hardiness = world.phenotype(cria, day).hardiness - TRAITS.hardiness.mu;
    const outbred = BASE_CRIA_SURVIVAL + hardiness * CRIA_SURVIVAL.perHardiness;
    const limit = (chance) => clamp(chance, CRIA_SURVIVAL.min, CRIA_SURVIVAL.max);
    return {
      chance: limit(outbred - cria.inbreedingF * INBREEDING_SURVIVAL_PENALTY),
      outbred: limit(outbred),
    };
  }

  // The pregnant dam gives birth: the cria is made (makeCria), registered in the pedigree
  // for good, and its luck decided. Returns the cria — which may already be dead — or
  // null if the dam isn't pregnant.
  //
  // After makeCria's rolls come: the survival roll, then, for a cria that lived but has a
  // lethal defect, the day it dies.
  giveBirth(damId, day = this.world.day) {
    const world = this.world;
    const { pedigree, rng, events } = world;
    const dam = pedigree.need(damId);
    const { pregnancy } = dam;
    if (!pregnancy) return null;
    const sire = pedigree.need(pregnancy.sireId);
    const modifiers = world.modifiers.resolve(pregnancy.modifiers);

    const cria = pedigree.add(makeCria(rng, pedigree, sire, dam, day, modifiers));
    dam.pregnancy = null;
    dam.lastBirthDay = day;
    world.quipu.onBirth(cria);
    events.emit('cria_born', { criaId: cria.id, damId, sireId: sire.id, day });

    // Defects show at birth, and an affected cria proves both of its parents carriers.
    affectedBy(cria.genome).forEach((defect) => {
      events.emit('defect_revealed', { alpacaId: cria.id, defect, day });
      [sire, dam].forEach((parent) => {
        if (affectedBy(parent.genome).includes(defect)) return; // that was plain to see
        const provenBefore = pedigree.offspringOf(parent.id)
          .some((other) => other.id !== cria.id && affectedBy(other.genome).includes(defect));
        if (!provenBefore) {
          events.emit('carrier_proven', { alpacaId: parent.id, defect, day, offspringId: cria.id });
        }
      });
    });

    const { chance, outbred } = this.survivalChance(cria, dam, day);
    const roll = rng.next();
    if (roll >= chance) {
      // It would have lived, had its parents not been related?
      world.die(cria, day, roll < outbred ? 'inbreeding_weakness' : 'weak_cria');
    } else {
      const lethal = lethalDefect(cria.genome);
      if (lethal) {
        cria.fate = { day: day + 1 + rng.int(Math.max(1, lethal.withinDays)), cause: `defect:${lethal.id}` };
      }
    }

    const ctx = { sire, dam, day };
    modifiers.forEach((modifier) => { if (modifier.onBirth) modifier.onBirth(cria, ctx); });
    return cria;
  }
}
