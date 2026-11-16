// The quipu: what the player knows. THIS IS THE ONLY WAY THE FRONT END READS AN ANIMAL.
//
//   quipu.getPlayerView(alpacaId, skillLevel)             everything known about one animal
//   quipu.getPairingForecast(sireId, damId, skillLevel)   what to expect of a mating
//
// The player never sees a genotype or a breeding value. They see what is on the outside
// of an animal, and what can be worked out from the outsides of its relatives — as a
// breeder does, and as the Quipu Reader teaches. How much is worked out for them depends
// on `skillLevel` (0–3, set by the story; QUIPU_SKILL in config.js):
//
//   0  looks: sex, age, colour, fleece, visible defects, parents, traits in words
//   1  + estimates of what the animal passes on, trait by trait, and how sure they are
//   2  + carrier status for each defect
//   3  + the colour alleles it must carry, and how related a pair is
//
// RECORDS. Working things out takes records, and the player only has records of some
// animals: every animal that is or was theirs, every cria born to them, every stud they
// have used, and whatever the story hands them (record(), recordHerd()). A record holds
// what the animal looks like and who its parents are. Relatives that aren't on record
// tell the player nothing, so two animals bought from one family may be closer kin than
// the quipu can show.
//
// HOW THIS FILE KEEPS THE SECRET. Nothing below reads a genome or a breeding value,
// except observe(): it turns an animal into what can be seen of it, and everything else
// is built on that. Nothing here uses the random numbers, or changes anything.

import {
  QUIPU, QUIPU_SKILL, PLAYER_ID, TRAITS, DEFECTS, LOCI, COLOR,
} from './config.js';
import { Kinship } from './pedigree.js';
import { ofAlpaca as coatOf, getFleece } from './color.js';
import { affectedBy, DEFECT_IDS } from './defects.js';
import {
  ageOn, ageAdjusted, describe, heritability,
} from './traits.js';
import { TRAIT_NAMES } from './genome.js';

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

// Put two sources of knowledge about one number together, each { value, reliability }
// (reliability 0–1: the share of the truth it accounts for). The surer one counts more.
function combine(sources) {
  let weight = 0;
  let sum = 0;
  sources.forEach(({ value, reliability }) => {
    if (reliability <= 0) return;
    const w = reliability / (1 - Math.min(reliability, 0.999));
    weight += w;
    sum += w * value;
  });
  return weight === 0 ? { value: 0, reliability: 0 } : { value: sum / weight, reliability: weight / (1 + weight) };
}

export default class Quipu {
  constructor(world) {
    this.world = world;
    this.recorded = new Set(); // ids of the animals the player has a record of

    // Kinship as far as the records go: an animal that isn't on record is known to
    // exist (it is somebody's sire), but not who its own parents were.
    this.kin = new Kinship((id) => {
      const alpaca = world.pedigree.get(id);
      if (!alpaca) return null;
      return this.recorded.has(id) ? alpaca : { ...alpaca, sireId: null, damId: null };
    });
  }

  // --- Records -----------------------------------------------------------------------

  record(id) {
    if (this.recorded.has(id) || !this.world.pedigree.get(id)) return;
    this.recorded.add(id);
    this.kin.clear(); // a newly known pair of parents can change any kinship
  }

  // A family opens its herd book: all of an owner's animals, their ancestors included.
  recordHerd(ownerId) {
    this.world.pedigree.all().forEach((alpaca) => {
      if (alpaca.ownerId === ownerId) this.record(alpaca.id);
    });
  }

  isRecorded(id) {
    return this.recorded.has(id);
  }

  // Called by breeding.js: the player has watched a mating, or had a cria born.
  onMating(sire, dam) {
    if (sire.ownerId !== PLAYER_ID && dam.ownerId !== PLAYER_ID) return;
    this.record(sire.id);
    this.record(dam.id);
  }

  onBirth(cria) {
    if (cria.ownerId === PLAYER_ID) this.record(cria.id);
  }

  // --- What can be seen --------------------------------------------------------------

  // An animal as it appears on a day. The one place a genome is read: all that leaves
  // here is the animal's outside.
  observe(alpaca, day) {
    const seenOn = alpaca.alive || alpaca.deathDay === null ? day : alpaca.deathDay;
    return {
      ageDays: ageOn(alpaca, day),
      coat: coatOf(alpaca),
      fleece: getFleece(alpaca.genome),
      defects: affectedBy(alpaca.genome),
      blueEyed: Boolean(alpaca.flags.blueEyed),
      deaf: Boolean(alpaca.flags.deaf && alpaca.flags.deafKnown),
      traits: this.world.phenotype(alpaca, seenOn),
    };
  }

  // One enquiry's working memory: the subject may be looked at whether or not it is on
  // record; everyone else only if they are.
  enquiry(subjectIds, day) {
    const { pedigree } = this.world;
    const seen = new Map();
    const subjects = new Set(subjectIds);
    const ask = {
      day,
      canSee: (id) => subjects.has(id) || this.recorded.has(id),
      // What an animal looks like, or null if the player has never seen it.
      look: (id) => {
        if (id === null || !ask.canSee(id)) return null;
        if (!seen.has(id)) {
          const alpaca = pedigree.get(id);
          seen.set(id, alpaca ? this.observe(alpaca, day) : null);
        }
        return seen.get(id);
      },
      // Its parents, if it has a record to say who they were: [sireId, damId].
      parents: (id) => {
        const alpaca = pedigree.get(id);
        return alpaca && this.recorded.has(id) ? [alpaca.sireId, alpaca.damId] : [null, null];
      },
      // Its offspring on record, each with the other parent: [{ id, mateId }].
      offspring: (id) => pedigree.offspringOf(id)
        .filter((child) => this.recorded.has(child.id))
        .map((child) => ({ id: child.id, mateId: child.sireId === id ? child.damId : child.sireId })),
      memo: new Map(),
    };
    return ask;
  }

  // --- Trait estimates (skill 1) -------------------------------------------------------
  // An estimate of an animal's breeding value for a trait, from three things: how it
  // turned out itself, what its parents are estimated at, and how its offspring turned
  // out. Each is weighted by how much it can be trusted — an animal's own measure by the
  // trait's heritability, offspring by their number — and the more there is, the higher
  // the accuracy. A simple selection index, not a full BLUP.

  // How far an animal's own measure of a trait sits from the mean, for its age; null
  // while it is too young to tell (or if it died that young).
  ownMeasure(ask, id, trait) {
    const look = ask.look(id);
    if (!look || look.ageDays < QUIPU.minObservationAgeDays) return null;
    return ageAdjusted(trait, look.traits[trait], look.ageDays) - TRAITS[trait].mu;
  }

  // The estimate from the animal itself and its ancestors: { value, reliability }.
  estimateFromAbove(ask, id, trait) {
    const key = `up:${trait}:${id}`;
    if (ask.memo.has(key)) return ask.memo.get(key);
    ask.memo.set(key, { value: 0, reliability: 0 }); // guards against a looped pedigree

    const h2 = heritability(trait);
    const sources = [];
    const own = this.ownMeasure(ask, id, trait);
    if (own !== null) sources.push({ value: h2 * own, reliability: h2 });

    const [sire, dam] = ask.parents(id).map((parentId) => (
      parentId === null ? { value: 0, reliability: 0 } : this.estimateFromAbove(ask, parentId, trait)
    ));
    sources.push({
      value: (sire.value + dam.value) / 2,
      reliability: (sire.reliability + dam.reliability) / 4,
    });

    const estimate = combine(sources);
    ask.memo.set(key, estimate);
    return estimate;
  }

  // The full estimate, with the offspring's evidence: { value, reliability }.
  estimate(ask, id, trait) {
    const h2 = heritability(trait);
    // Each offspring got half of its breeding value from this animal and half from its
    // mate: twice what is left after the mate's half says something about this one.
    const evidence = [];
    ask.offspring(id).forEach(({ id: childId, mateId }) => {
      const measure = this.ownMeasure(ask, childId, trait);
      if (measure === null) return;
      const mate = mateId === null ? 0 : this.estimateFromAbove(ask, mateId, trait).value;
      evidence.push(2 * (measure - mate / 2));
    });
    const sources = [this.estimateFromAbove(ask, id, trait)];
    if (evidence.length) {
      const n = evidence.length;
      const reliability = (n * h2) / (4 + (n - 1) * h2);
      const mean = evidence.reduce((a, b) => a + b, 0) / n;
      sources.push({ value: reliability * mean, reliability });
    }
    return combine(sources);
  }

  // --- Carrier status (skill 2) --------------------------------------------------------

  // Is the animal known for certain to carry a defect's allele? It shows the defect, or
  // has an offspring on record that does, or a parent that does.
  provenCarrier(ask, id, defect) {
    const shows = (otherId) => { const look = ask.look(otherId); return Boolean(look && look.defects.includes(defect)); };
    return shows(id)
      || ask.offspring(id).some((child) => shows(child.id))
      || ask.parents(id).some((parentId) => shows(parentId));
  }

  // The chance that the animal hands the allele to a cria; null if there is no telling.
  // `exceptChild` leaves one of its offspring out of the reckoning: see carrierOdds().
  passesOn(ask, id, defect, exceptChild = null) {
    if (id === null) return null;
    const look = ask.look(id);
    if (look && look.defects.includes(defect)) return 1;
    if (this.provenCarrier(ask, id, defect)) return 0.5;
    const odds = this.carrierOdds(ask, id, defect, exceptChild);
    return odds === null ? null : odds.chance / 2;
  }

  // For an animal that doesn't show a defect and isn't a proven carrier: the chance that
  // it carries it, { chance, testMatings }, or null if nothing bears on it.
  //
  // When this is asked about a parent in order to judge one of its offspring, that
  // offspring is `exceptChild` and is left out of the parent's test matings: its being
  // healthy can't be evidence about its parent and about itself at once.
  carrierOdds(ask, id, defect, exceptChild = null) {
    const key = `odds:${defect}:${id}:${exceptChild}`;
    if (ask.memo.has(key)) return ask.memo.get(key);
    ask.memo.set(key, null);

    // From its parents. A parent nothing is known about counts as clear, so that one
    // proven-carrier parent means an even chance.
    const [fromSire, fromDam] = ask.parents(id).map((parentId) => this.passesOn(ask, parentId, defect, id));
    let chance = null;
    if (fromSire !== null || fromDam !== null) {
      const a = fromSire || 0;
      const b = fromDam || 0;
      // It carries exactly one copy, given that it doesn't have two (it would show).
      chance = a * b === 1 ? 1 : (a * (1 - b) + b * (1 - a)) / (1 - a * b);
    }

    // From its own unaffected offspring by mates known to carry: each one is a test it
    // passed, which a carrier only passes three times in four (or half the time, if the
    // mate shows the defect itself).
    let passed = 1;
    let testMatings = 0;
    ask.offspring(id).forEach(({ id: childId, mateId }) => {
      if (mateId === null || childId === exceptChild) return;
      const mate = ask.look(mateId);
      if (mate && mate.defects.includes(defect)) {
        passed *= 1 / 2;
        testMatings += 1;
      } else if (this.provenCarrier(ask, mateId, defect)) {
        passed *= 3 / 4;
        testMatings += 1;
      }
    });
    if (testMatings > 0) {
      const before = chance === null ? QUIPU.carrierPrior : chance;
      chance = (before * passed) / (before * passed + (1 - before));
    }

    const odds = chance === null ? null : { chance, testMatings };
    ask.memo.set(key, odds);
    return odds;
  }

  // { status, chance } — status one of:
  //   'affected'        it shows the defect
  //   'proven_carrier'  it has produced an affected cria, or a parent of its is affected
  //   'possible'        it may carry it: `chance` is the odds
  //   'likely_clear'    test-mated to known carriers without an affected cria: `chance`
  //                     is what is left of the odds. Never certain.
  //   'unknown'         nothing on record bears on it
  carrierStatus(ask, id, defect) {
    const look = ask.look(id);
    if (look && look.defects.includes(defect)) return { status: 'affected' };
    if (this.provenCarrier(ask, id, defect)) return { status: 'proven_carrier', chance: 1 };
    const odds = this.carrierOdds(ask, id, defect);
    if (odds === null) return { status: 'unknown' };
    const likelyClear = odds.testMatings > 0 && odds.chance <= QUIPU.likelyClearBelow;
    // Short of proof either way, the odds are never shown as none or as certain.
    const chance = Math.min(0.99, Math.max(0.01, round(odds.chance)));
    return { status: likelyClear ? 'likely_clear' : 'possible', chance };
  }

  // --- Colour genes (skill 3) ----------------------------------------------------------
  // What an animal's looks say about its two alleles at each colour locus. Each locus
  // comes out as a pair, '?' where an allele can't be told: 'e/e', 'E/?', '?/?'.

  // From the animal's own appearance alone: { MC1R: ['E', null], ... }.
  genesFromLooks(look) {
    const { coat, fleece } = look;
    const pigment = !coat.bew && coat.family !== 'fawn'; // makes black pigment, visibly
    const genes = {
      MC1R: [null, null], ASIP: [null, null], GREY: [null, null], SPOT: [null, null],
      FLEECE: fleece === 'suri' ? ['Su', null] : ['hu', 'hu'],
    };
    if (coat.bew) {
      // Grey and spots together, hiding everything else.
      genes.GREY = ['G', null];
      genes.SPOT = ['S', null];
      return genes;
    }
    genes.MC1R = pigment ? ['E', null] : ['e', 'e'];
    if (coat.family === 'black') genes.ASIP = ['a', 'a'];
    if (coat.family === 'brown') genes.ASIP = ['A', null];
    // Grey always shows on an animal with black pigment; on a fawn it can hide.
    if (coat.grey) genes.GREY = ['G', null];
    else if (pigment) genes.GREY = ['g', 'g'];
    // Spots show on any coat but a white one.
    if (coat.spotted) genes.SPOT = ['S', null];
    else if (!COLOR.hidesSpots.includes(coat.colorKey)) genes.SPOT = ['s', 's'];
    return genes;
  }

  // ...and sharpened by its relatives. A parent or an offspring that is plainly
  // recessive (a fawn: two copies of e) shows that this animal has one recessive allele,
  // got or given; an offspring showing a dominant allele that its other parent plainly
  // lacks shows that it came from this one.
  colorGenes(ask, id) {
    const look = ask.look(id);
    if (!look) return null;
    const genes = this.genesFromLooks(look);
    const looksOf = (otherId) => { const other = ask.look(otherId); return other ? this.genesFromLooks(other) : null; };
    const isRecessive = (pair, locus) => pair[0] === LOCI[locus].alleles[1] && pair[1] === pair[0];

    // The animal has at least one copy of an allele. (Two relatives showing the same
    // allele don't make two copies: they may both have had the one.)
    const learn = (locus, allele) => {
      const pair = genes[locus];
      if (pair.includes(allele)) return;
      if (pair[0] === null) pair[0] = allele;
      else if (pair[1] === null) pair[1] = allele;
    };
    const parents = ask.parents(id).map(looksOf);
    Object.keys(LOCI).forEach((locus) => {
      const [dominant, recessive] = LOCI[locus].alleles;
      // One allele came from each parent: two plainly recessive parents make a
      // recessive animal, whatever hides it; one makes a carrier at the least.
      const fromRecessiveParents = parents.filter((parent) => parent && isRecessive(parent[locus], locus)).length;
      if (fromRecessiveParents === 2) genes[locus] = [recessive, recessive];
      else if (fromRecessiveParents === 1) learn(locus, recessive);

      ask.offspring(id).forEach(({ id: childId, mateId }) => {
        const child = looksOf(childId);
        if (!child) return;
        if (isRecessive(child[locus], locus)) learn(locus, recessive);
        // An offspring's dominant allele, when its other parent has none to give.
        const mate = mateId === null ? null : looksOf(mateId);
        if (mate && child[locus][0] === dominant && isRecessive(mate[locus], locus)) learn(locus, dominant);
      });
    });

    const out = {};
    Object.keys(LOCI).forEach((locus) => {
      const order = LOCI[locus].alleles;
      const [x, y] = [...genes[locus]].sort((p, q) => (
        (p === null ? 9 : order.indexOf(p)) - (q === null ? 9 : order.indexOf(q))
      ));
      out[locus] = `${x || '?'}/${y || '?'}`;
    });
    return out;
  }

  // --- The player's view ---------------------------------------------------------------

  // Everything the player knows about an animal on a day, at a skill level. A plain
  // object, safe to hand to the screen; null if there is no such animal.
  getPlayerView(alpacaId, skillLevel = 0, day = this.world.day) {
    const alpaca = this.world.pedigree.get(alpacaId);
    if (!alpaca) return null;
    const ask = this.enquiry([alpacaId], day);
    const look = ask.look(alpacaId);
    const recorded = this.recorded.has(alpacaId);
    const [sireId, damId] = ask.parents(alpacaId);

    const words = {};
    TRAIT_NAMES.forEach((trait) => {
      const word = describe(trait, look.traits[trait], look.ageDays);
      if (word) words[trait] = word;
    });

    const view = {
      id: alpaca.id,
      name: alpaca.name,
      sex: alpaca.sex,
      ownerId: alpaca.ownerId,
      recorded,
      alive: alpaca.alive,
      ageDays: look.ageDays,
      death: alpaca.alive ? null : { day: alpaca.deathDay, cause: alpaca.deathCause },
      color: { ...look.coat },
      blueEyed: look.blueEyed,
      fleece: look.fleece,
      defects: [...look.defects],
      deaf: look.deaf,
      predatorRisk: look.deaf,
      parents: { sireId, damId },
      offspring: ask.offspring(alpacaId).map((child) => child.id),
      // A pregnancy is only here once the player has found it out.
      pregnancy: alpaca.pregnancy && alpaca.pregnancy.known
        ? { sireId: alpaca.pregnancy.sireId, sinceDay: alpaca.pregnancy.conceivedDay }
        : null,
      lastMating: recorded && alpaca.lastMating ? { ...alpaca.lastMating } : null,
      lastBirthDay: recorded ? alpaca.lastBirthDay : null,
      traits: words,
    };

    if (skillLevel >= QUIPU_SKILL.traitEstimates) {
      view.estimates = {};
      TRAIT_NAMES.forEach((trait) => {
        const { value, reliability } = this.estimate(ask, alpacaId, trait);
        view.estimates[trait] = {
          value: round(TRAITS[trait].mu + value),
          accuracy: round(Math.sqrt(reliability)),
        };
      });
    }
    if (skillLevel >= QUIPU_SKILL.carrierOdds) {
      view.carrier = {};
      DEFECT_IDS.forEach((defect) => { view.carrier[defect] = this.carrierStatus(ask, alpacaId, defect); });
    }
    if (skillLevel >= QUIPU_SKILL.colorGenes) view.colorGenes = this.colorGenes(ask, alpacaId);
    return view;
  }

  // What the player can expect of mating a sire and a dam.
  //   canBreed    whether they can be mated, as far as the player can tell: a pregnancy
  //               they haven't found out about doesn't show here
  //   traits      (skill 1) the likely range of each trait in a grown cria: { low, high }
  //   defects     (skill 2) the risk of an affected cria for each defect: { risk }, null
  //               where nothing is known of one of the pair
  //   inbreeding  (skill 3) the cria's inbreeding coefficient as far as the records show:
  //               { coefficient, percent, warning: 'none' | 'related' | 'close' }
  getPairingForecast(sireId, damId, skillLevel = 0, day = this.world.day) {
    const { pedigree, breeding } = this.world;
    if (!pedigree.get(sireId) || !pedigree.get(damId)) return null;
    const ask = this.enquiry([sireId, damId], day);

    const forecast = { sireId, damId, canBreed: breeding.canBreed(sireId, damId, day, { asPlayerKnows: true }) };

    if (skillLevel >= QUIPU_SKILL.traitEstimates) {
      forecast.traits = {};
      TRAIT_NAMES.forEach((trait) => {
        const { sigmaA, sigmaE, mu } = TRAITS[trait];
        const s = this.estimate(ask, sireId, trait);
        const d = this.estimate(ask, damId, trait);
        // What is unknown about the parents, the shuffle of inheritance, and everything
        // about how a cria turns out that isn't inherited at all.
        const spread = Math.sqrt(
          (sigmaA ** 2 * (2 - s.reliability - d.reliability)) / 4 + sigmaA ** 2 / 2 + sigmaE ** 2,
        );
        const middle = mu + (s.value + d.value) / 2;
        forecast.traits[trait] = { low: round(middle - spread), high: round(middle + spread) };
      });
    }
    if (skillLevel >= QUIPU_SKILL.carrierOdds) {
      forecast.defects = {};
      DEFECT_IDS.forEach((defect) => {
        const fromSire = this.passesOn(ask, sireId, defect);
        const fromDam = this.passesOn(ask, damId, defect);
        forecast.defects[defect] = {
          risk: fromSire === null || fromDam === null ? null : round(fromSire * fromDam, 3),
          severity: DEFECTS[defect].severity,
        };
      });
    }
    if (skillLevel >= QUIPU_SKILL.kinship) {
      const coefficient = this.kin.between(sireId, damId);
      const { related, close } = QUIPU.kinshipWarning;
      let warning = 'none';
      if (coefficient >= related) warning = 'related';
      if (coefficient >= close) warning = 'close';
      forecast.inbreeding = { coefficient: round(coefficient, 4), percent: round(coefficient * 100, 1), warning };
    }
    return forecast;
  }
}
