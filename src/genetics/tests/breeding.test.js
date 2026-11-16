import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BREEDING, GESTATION_DAYS, GESTATION_JITTER_DAYS, POSTPARTUM_REST_DAYS, MIN_BREED_AGE_F,
  MIN_BREED_AGE_M, MAX_BREED_AGE, BEW_DEAF_CHANCE, DEAF, BASE_CRIA_SURVIVAL,
  INBREEDING_SURVIVAL_PENALTY, DEFECTS, YEAR_DAYS,
} from '../config.js';
import { copies } from '../genome.js';
import { affectedBy, DEFECT_IDS } from '../defects.js';
import { makeWorld, adult, birth, eventLog } from './helpers.js';

const near = (actual, expected, tolerance, what) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);
};

test('canBreed: every reason a pair can\'t be mated', () => {
  const world = makeWorld(1, { hooks: { canUseStud: (sireId, ownerId) => ownerId !== 'banned' } });
  const { breeding } = world;
  const sire = adult(world, 'M');
  const dam = adult(world, 'F');
  const reason = (s, d, day) => { const r = breeding.canBreed(s.id, d.id, day); return r.ok ? 'ok' : `${r.reason}:${r.who || ''}`; };

  assert.deepEqual(breeding.canBreed(sire.id, dam.id), { ok: true });
  assert.equal(breeding.canBreed(sire.id, 999).reason, 'no_such_animal');
  assert.equal(reason(dam, dam), 'wrong_sex:sire');
  assert.equal(reason(sire, sire), 'wrong_sex:dam');

  assert.equal(reason(adult(world, 'M', { age: MIN_BREED_AGE_M - 1 }), dam), 'too_young:sire');
  assert.equal(reason(adult(world, 'M', { age: MIN_BREED_AGE_M }), dam), 'ok');
  assert.equal(reason(sire, adult(world, 'F', { age: MIN_BREED_AGE_F - 1 })), 'too_young:dam');
  assert.equal(reason(sire, adult(world, 'F', { age: MIN_BREED_AGE_F })), 'ok');
  assert.equal(reason(adult(world, 'M', { age: MAX_BREED_AGE + 1 }), dam), 'too_old:sire');
  assert.equal(reason(sire, adult(world, 'F', { age: MAX_BREED_AGE + 1 })), 'too_old:dam');

  const dead = adult(world, 'M');
  world.die(dead, 0, 'test');
  assert.equal(reason(dead, dam), 'dead:sire');

  // Another herd's stud needs its owner's leave; your own never does.
  const theirs = adult(world, 'M', { ownerId: 'family:x' });
  assert.equal(reason(theirs, dam), 'ok');
  assert.equal(reason(theirs, adult(world, 'F', { ownerId: 'banned' })), 'stud_unavailable:sire');
  assert.equal(reason(adult(world, 'M', { ownerId: 'banned' }), adult(world, 'F', { ownerId: 'banned' })), 'ok');

  birth(world, sire, dam, 10);
  assert.equal(reason(sire, dam, 10 + POSTPARTUM_REST_DAYS - 1), 'resting:dam');
  assert.equal(reason(sire, dam, 10 + POSTPARTUM_REST_DAYS), 'ok');
  dam.pregnancy = { sireId: sire.id, conceivedDay: 200, dueDay: 230, modifiers: [], known: false };
  assert.equal(reason(sire, dam, 205), 'pregnant:dam');
});

test('conception: average animals conceive at the base rate, fertile ones more often', () => {
  const rate = (seed, damBv, sireBv, nutrition = 0) => {
    const world = makeWorld(seed, { hooks: { getNutritionScore: () => nutrition } });
    const sire = adult(world, 'M', { bv: { fertility: sireBv } });
    let conceived = 0;
    for (let i = 0; i < 3000; i++) {
      const dam = adult(world, 'F', { bv: { fertility: damBv } });
      const result = world.breeding.attemptConception(sire.id, dam.id, 0);
      assert.equal(result.ok, true);
      assert.equal(result.conceived, dam.pregnancy !== null);
      if (result.conceived) conceived += 1;
    }
    return conceived / 3000;
  };
  const { base, perDamFertility, perSireFertility, min, max } = BREEDING.conception;
  near(rate(1, 0, 0), base, 0.03, 'average pair');
  near(rate(2, 20, 0), base + 20 * perDamFertility, 0.03, 'fertile dam');
  near(rate(3, 0, -20), base - 20 * perSireFertility, 0.03, 'poor sire');
  // Fertility itself runs from 0 to 100, so a hopeless pair is 50 points down each.
  near(rate(4, -500, -500), base - 50 * (perDamFertility + perSireFertility), 0.02, 'a hopeless pair');
  near(rate(5, -500, -500, -1), min, 0.02, 'never below the floor');
  near(rate(6, 500, 500, 1), max, 0.02, 'never above the ceiling');
});

test('a mating that can\'t happen changes nothing and rolls nothing', () => {
  const world = makeWorld(6);
  const sire = adult(world, 'M');
  const young = adult(world, 'F', { age: 10 });
  const before = world.rng.save();
  assert.deepEqual(world.breeding.attemptConception(sire.id, young.id, 0), { ok: false, reason: 'too_young', who: 'dam' });
  assert.deepEqual(world.rng.save(), before);
  assert.equal(young.lastMating, null);
});

test('pregnancy: hidden until a spit-off test shows it', () => {
  const world = makeWorld(7);
  const log = eventLog(world);
  const sire = adult(world, 'M');
  const { minDays, reliability } = BREEDING.spitOff;
  let shown = 0;
  let tested = 0;
  for (let i = 0; i < 2000; i++) {
    const dam = adult(world, 'F');
    assert.deepEqual(world.breeding.spitOffTest(dam.id, 0), { spits: false }, 'an empty female doesn\'t spit');
    if (!world.breeding.attemptConception(sire.id, dam.id, 0).conceived) {
      assert.deepEqual(world.breeding.spitOffTest(dam.id, minDays + 3), { spits: false });
      continue;
    }
    assert.equal(dam.pregnancy.known, false);
    assert.deepEqual(dam.lastMating, { sireId: sire.id, day: 0 });
    assert.equal(world.breeding.spitOffTest(dam.id, minDays - 1).spits, false, 'too early to tell');
    assert.equal(dam.pregnancy.known, false);

    tested += 1;
    const { spits } = world.breeding.spitOffTest(dam.id, minDays);
    assert.equal(dam.pregnancy.known, spits);
    if (spits) {
      shown += 1;
      // Once known, it stays known, and isn't announced twice.
      assert.equal(world.breeding.spitOffTest(dam.id, minDays + 1).spits, true);
    }
  }
  near(shown / tested, reliability, 0.03, 'spit-off reliability');
  assert.equal(log.filter((e) => e.name === 'pregnancy_revealed').length, shown);
  assert.equal(log.filter((e) => e.name === 'conceived').length, tested);
});

test('the daily tick carries a pregnancy to term', () => {
  const world = makeWorld(8);
  const log = eventLog(world);
  const sire = adult(world, 'M', { ownerId: 'family:x' });
  const dam = adult(world, 'F');
  while (!dam.pregnancy) world.breeding.attemptConception(sire.id, dam.id, 0);
  const { dueDay } = dam.pregnancy;
  assert.ok(Math.abs(dueDay - GESTATION_DAYS) <= GESTATION_JITTER_DAYS);

  world.tick(dueDay - 1);
  assert.ok(dam.pregnancy, 'still pregnant the day before');
  assert.equal(world.pedigree.offspringOf(dam.id).length, 0);

  world.tick(dueDay);
  assert.equal(world.day, dueDay);
  assert.equal(dam.pregnancy, null);
  assert.equal(dam.lastBirthDay, dueDay);
  const [cria] = world.pedigree.offspringOf(dam.id);
  assert.deepEqual(
    [cria.sireId, cria.damId, cria.birthDay, cria.ownerId, cria.inbreedingF],
    [sire.id, dam.id, dueDay, 'player', 0],
  );
  assert.ok(['M', 'F'].includes(cria.sex));
  assert.equal(world.pedigree.get(cria.id), cria);
  assert.deepEqual(log.filter((e) => e.name === 'cria_born'), [
    { name: 'cria_born', criaId: cria.id, damId: dam.id, sireId: sire.id, day: dueDay },
  ]);

  // Ticking the same day again, or an earlier one, does nothing.
  const state = JSON.stringify(world.pedigree.all());
  world.tick(dueDay);
  world.tick(3);
  assert.equal(JSON.stringify(world.pedigree.all()), state);
});

test('a tick that skips days catches up on each of them', () => {
  const run = (days) => {
    const world = makeWorld(9);
    const sire = adult(world, 'M');
    for (let i = 0; i < 30; i++) world.breeding.attemptConception(sire.id, adult(world, 'F').id, 0);
    days.forEach((day) => world.tick(day));
    return JSON.stringify(world.pedigree.all());
  };
  const daily = Array.from({ length: 60 }, (unused, i) => i + 1);
  assert.equal(run([60]), run(daily));
  assert.equal(run([7, 31, 60]), run(daily));
});

test('gestation lengths spread over the jitter, and births are half male', () => {
  const world = makeWorld(10);
  const sire = adult(world, 'M');
  const lengths = new Set();
  for (let i = 0; i < 400; i++) {
    const dam = adult(world, 'F');
    if (world.breeding.attemptConception(sire.id, dam.id, 0).conceived) lengths.add(dam.pregnancy.dueDay);
  }
  const expected = [];
  for (let d = GESTATION_DAYS - GESTATION_JITTER_DAYS; d <= GESTATION_DAYS + GESTATION_JITTER_DAYS; d++) expected.push(d);
  assert.deepEqual([...lengths].sort((a, b) => a - b), expected);

  const dam = adult(world, 'F');
  let males = 0;
  for (let i = 0; i < 4000; i++) if (birth(world, sire, dam).sex === 'M') males += 1;
  near(males / 4000, BREEDING.maleBirthRate, 0.03, 'males');
});

test('miscarriage: rare, and likelier for a frail dam or in hard weather', () => {
  const lossRate = (seed, { hardiness = 0, weather = 0, nutrition = 0 } = {}) => {
    const world = makeWorld(seed, {
      hooks: { getWeatherStress: () => weather, getNutritionScore: () => nutrition },
    });
    const log = eventLog(world);
    const sire = adult(world, 'M');
    for (let i = 0; i < 3000; i++) {
      const dam = adult(world, 'F', { bv: { hardiness } });
      dam.pregnancy = { sireId: sire.id, conceivedDay: 0, dueDay: 30, modifiers: [], known: i % 2 === 0 };
    }
    world.tick(29);
    const lost = log.filter((e) => e.name === 'miscarriage');
    lost.forEach((e) => {
      assert.equal(world.pedigree.get(e.damId).pregnancy, null);
      assert.equal(e.known, (e.damId - 2) % 2 === 0, 'the event says whether the player knew');
    });
    return lost.length / 3000;
  };
  const { dailyBase, perHardiness, weather, maxFactor } = BREEDING.miscarriage;
  const over29Days = (daily) => 1 - (1 - daily) ** 29;
  near(lossRate(11), over29Days(dailyBase), 0.015, 'average dam');
  near(lossRate(12, { hardiness: -20 }), over29Days(dailyBase * (1 + 20 * perHardiness)), 0.02, 'frail dam');
  near(lossRate(13, { weather: 1 }), over29Days(dailyBase * (1 + weather)), 0.02, 'hard weather');
  near(lossRate(14, { hardiness: -500, weather: 1, nutrition: -1 }), over29Days(dailyBase * maxFactor), 0.03, 'the factor is limited');
});

test('defects: carrier x carrier gives about a quarter affected, at every defect locus', () => {
  DEFECT_IDS.forEach((defect, i) => {
    const { locus } = DEFECTS[defect];
    const world = makeWorld(20 + i);
    const log = eventLog(world);
    const sire = adult(world, 'M', { loci: { [locus]: ['N', 'd'] } });
    const dam = adult(world, 'F', { loci: { [locus]: ['N', 'd'] } });
    const counts = [0, 0, 0];
    for (let n = 0; n < 10000; n++) {
      const cria = birth(world, sire, dam);
      const d = copies(cria.genome, locus, 'd');
      counts[d] += 1;
      assert.deepEqual(affectedBy(cria.genome), d === 2 ? [defect] : [], 'only d/d is affected');
    }
    near(counts[2] / 10000, 0.25, 0.015, `${defect} affected`);
    near(counts[1] / 10000, 0.5, 0.017, `${defect} carriers`);

    // Every affected cria is announced; a carrier never is.
    const revealed = log.filter((e) => e.name === 'defect_revealed');
    assert.equal(revealed.length, counts[2]);
    revealed.forEach((e) => {
      assert.equal(e.defect, defect);
      assert.equal(copies(world.pedigree.get(e.alpacaId).genome, locus, 'd'), 2);
    });
    // The first affected cria proves both parents carriers — once each.
    const proven = log.filter((e) => e.name === 'carrier_proven');
    assert.deepEqual(proven.map((e) => e.alpacaId).sort(), [sire.id, dam.id].sort());
    assert.ok(proven.every((e) => e.defect === defect && e.offspringId === revealed[0].alpacaId));
  });
});

test('defects: a carrier bred to a clear animal never has an affected cria', () => {
  const world = makeWorld(30);
  const log = eventLog(world);
  const sire = adult(world, 'M', { loci: { CHOANAL: ['N', 'd'], WRY: ['N', 'd'] } });
  const dam = adult(world, 'F');
  let carriers = 0;
  for (let i = 0; i < 2000; i++) {
    const cria = birth(world, sire, dam);
    assert.deepEqual(affectedBy(cria.genome), []);
    assert.equal(cria.fate, null);
    if (copies(cria.genome, 'CHOANAL', 'd') === 1) carriers += 1;
  }
  near(carriers / 2000, 0.5, 0.035, 'carriers');
  assert.equal(log.filter((e) => e.name === 'defect_revealed' || e.name === 'carrier_proven').length, 0);
});

test('defects: a lethal defect kills, within its days, for good', () => {
  const world = makeWorld(31);
  const log = eventLog(world);
  const sire = adult(world, 'M', { loci: { CHOANAL: ['d', 'd'] } }); // by hand: he couldn't have lived
  const dam = adult(world, 'F', { loci: { CHOANAL: ['d', 'd'] } });
  const { lethalWithinDays } = DEFECTS.choanal_atresia;
  const crias = [];
  for (let i = 0; i < 300; i++) crias.push(birth(world, sire, dam, 0));

  const atBirth = crias.filter((c) => !c.alive);
  atBirth.forEach((c) => assert.ok(['weak_cria', 'inbreeding_weakness'].includes(c.deathCause)));
  const doomed = crias.filter((c) => c.alive);
  assert.ok(doomed.length > 200);
  doomed.forEach((c) => {
    assert.equal(c.fate.cause, 'defect:choanal_atresia');
    assert.ok(c.fate.day >= 1 && c.fate.day <= lethalWithinDays);
  });
  assert.equal(new Set(doomed.map((c) => c.fate.day)).size, lethalWithinDays, 'on any of the days');

  world.tick(lethalWithinDays);
  crias.forEach((c) => {
    assert.equal(c.alive, false);
    assert.equal(world.pedigree.get(c.id), c, 'the dead stay in the pedigree');
  });
  doomed.forEach((c) => {
    assert.equal(c.deathCause, 'defect:choanal_atresia');
    assert.ok(c.deathDay >= 1 && c.deathDay <= lethalWithinDays);
    assert.equal(c.fate, null);
  });
  const deaths = log.filter((e) => e.name === 'cria_died');
  assert.equal(deaths.length, 300, 'one death each, never two');
  assert.equal(deaths.filter((e) => e.cause === 'defect:choanal_atresia').length, doomed.length);

  // Dead is dead: more days change nothing, and the dead can't be bred.
  const dead = doomed[0];
  world.tick(lethalWithinDays + 400);
  assert.equal(dead.alive, false);
  assert.equal(world.breeding.canBreed(dead.id, dam.id).ok, false);
});

test('blue-eyed whites: often deaf, and noticed after a few days', () => {
  const world = makeWorld(32);
  const log = eventLog(world);
  const sire = adult(world, 'M', { loci: { GREY: ['G', 'G'] } });
  const dam = adult(world, 'F', { loci: { SPOT: ['S', 'S'] } });
  const crias = [];
  for (let i = 0; i < 3000; i++) crias.push(birth(world, sire, dam, 0));
  crias.forEach((c) => assert.equal(c.flags.blueEyed, true));
  const deaf = crias.filter((c) => c.flags.deaf);
  near(deaf.length / 3000, BEW_DEAF_CHANCE, 0.03, 'deaf');
  assert.ok(deaf.every((c) => !c.flags.deafKnown));

  world.tick(DEAF.detectAgeDays - 1);
  assert.equal(log.filter((e) => e.name === 'deafness_detected').length, 0);
  world.tick(DEAF.detectAgeDays + 5);
  const living = deaf.filter((c) => c.alive);
  assert.deepEqual(log.filter((e) => e.name === 'deafness_detected').map((e) => e.alpacaId), living.map((c) => c.id));
  assert.ok(living.every((c) => c.flags.deafKnown));
  // Deafness costs docility: the same animal, could it hear, would be easier to handle.
  const hearing = { ...living[0], flags: { blueEyed: true } };
  near(world.phenotype(living[0]).docility - world.phenotype(hearing).docility, DEAF.traitEffects.docility, 1e-9, 'docility');

  // An ordinary cria is neither.
  const plain = birth(world, adult(world, 'M'), adult(world, 'F'));
  assert.deepEqual(plain.flags, {});
});

test('cria survival: inbreeding costs lives', () => {
  const world = makeWorld(33);
  const outSire = adult(world, 'M');
  const outDam = adult(world, 'F');
  const brother = adult(world, 'M', { sireId: outSire.id, damId: outDam.id });
  const sister = adult(world, 'F', { sireId: outSire.id, damId: outDam.id });
  const survival = (sire, dam) => {
    const crias = [];
    for (let i = 0; i < 4000; i++) crias.push(birth(world, sire, dam));
    return { crias, rate: crias.filter((c) => c.alive).length / 4000 };
  };

  const outbred = survival(outSire, outDam);
  near(outbred.rate, BASE_CRIA_SURVIVAL, 0.02, 'outbred survival');
  assert.ok(outbred.crias.every((c) => c.inbreedingF === 0));
  assert.ok(outbred.crias.filter((c) => !c.alive).every((c) => c.deathCause === 'weak_cria' && c.deathDay === c.birthDay));

  const inbred = survival(brother, sister);
  assert.ok(inbred.crias.every((c) => c.inbreedingF === 0.25));
  // The penalty itself, plus a little more through the cria's own depressed hardiness.
  assert.ok(inbred.rate < BASE_CRIA_SURVIVAL - 0.25 * INBREEDING_SURVIVAL_PENALTY + 0.01, `inbred survival ${inbred.rate}`);
  assert.ok(inbred.rate > BASE_CRIA_SURVIVAL - 0.25 * INBREEDING_SURVIVAL_PENALTY - 0.08, `inbred survival ${inbred.rate}`);
  // Most of those deaths are put down to the inbreeding: the share of them that an
  // outbred cria with the same luck would have survived.
  const causes = inbred.crias.filter((c) => !c.alive).map((c) => c.deathCause);
  const share = causes.filter((c) => c === 'inbreeding_weakness').length / causes.length;
  const lost = 0.25 * INBREEDING_SURVIVAL_PENALTY;
  near(share, lost / (1 - inbred.rate), 0.08, 'deaths down to inbreeding');
  assert.ok(share > 0.5);
});

test('modifiers: all four hooks fire, and ride along with the pregnancy and the cria', () => {
  const world = makeWorld(34);
  const calls = [];
  // Test-only: no modifier ships with the game.
  const dummy = world.modifiers.register({
    id: 'dummy',
    onConception: (ctx) => { calls.push('conception'); return { ...ctx, chance: 1 }; },
    onGenome: (genome, ctx) => {
      calls.push(`genome:${ctx.sire.id}x${ctx.dam.id}`);
      return { ...genome, loci: { ...genome.loci, FLEECE: ['Su', 'Su'] } };
    },
    onPhenotype: (alpaca, traits) => ({ ...traits, density: 99 }),
    onBirth: (cria, ctx) => { calls.push(`birth:${cria.id}@${ctx.day}`); },
  });
  const sire = adult(world, 'M', { bv: { fertility: -500 } });
  const dam = adult(world, 'F', { bv: { fertility: -500 } });

  assert.equal(world.modifiers.resolve().length, 0);
  assert.throws(() => world.breeding.attemptConception(sire.id, dam.id, 0, ['unregistered']));
  assert.deepEqual(world.breeding.attemptConception(sire.id, dam.id, 0, [dummy]), { ok: true, conceived: true });
  assert.deepEqual(dam.pregnancy.modifiers, ['dummy']);
  world.tick(dam.pregnancy.dueDay);
  const [cria] = world.pedigree.offspringOf(dam.id);

  assert.deepEqual(calls, ['conception', `genome:${sire.id}x${dam.id}`, `birth:${cria.id}@${world.day}`]);
  assert.deepEqual(cria.genome.loci.FLEECE, ['Su', 'Su'], 'onGenome changed the genome');
  assert.deepEqual(cria.modifiers, ['dummy']);
  assert.equal(world.phenotype(cria).density, 99, 'onPhenotype applies to the cria');
  assert.notEqual(world.phenotype(dam).density, 99, '...and not to animals without the modifier');

  // A modifier that has been taken out of the game is passed over.
  world.modifiers.unregister('dummy');
  assert.notEqual(world.phenotype(cria).density, 99);

  // Without modifiers this hopeless pair hardly ever conceives.
  let conceived = 0;
  for (let i = 0; i < 200; i++) {
    if (world.breeding.attemptConception(sire.id, adult(world, 'F', { bv: { fertility: -500 } }).id, world.day).conceived) conceived += 1;
  }
  assert.ok(conceived < 30);
});

test('determinism: the same seed and the same calls give the same herd', () => {
  const run = (seed) => {
    const world = makeWorld(seed);
    const log = eventLog(world);
    const sires = [adult(world, 'M', { loci: { CHOANAL: ['N', 'd'], GREY: ['G', 'g'] } }), adult(world, 'M')];
    const dams = Array.from({ length: 12 }, (unused, i) => adult(world, 'F', {
      loci: i % 2 ? { CHOANAL: ['N', 'd'], SPOT: ['S', 's'] } : { MC1R: ['E', 'e'] },
    }));
    for (let day = 0; day < 3 * YEAR_DAYS; day++) {
      world.tick(day);
      if (day % 10 === 0) {
        dams.forEach((dam, i) => {
          world.breeding.attemptConception(sires[i % 2].id, dam.id, day);
          world.breeding.spitOffTest(dam.id, day);
        });
      }
    }
    return JSON.stringify({ animals: world.pedigree.all(), log, rng: world.rng.save() });
  };
  const first = run(77);
  assert.equal(run(77), first);
  assert.notEqual(run(78), first);
  assert.ok(JSON.parse(first).animals.length > 30, 'plenty was born');
});

test('a female has about one cria a year', () => {
  const world = makeWorld(35);
  const sire = adult(world, 'M');
  const dams = Array.from({ length: 200 }, () => adult(world, 'F'));
  for (let day = 0; day <= 3 * YEAR_DAYS; day++) {
    world.tick(day);
    dams.forEach((dam) => world.breeding.attemptConception(sire.id, dam.id, day));
  }
  const births = dams.map((dam) => world.pedigree.offspringOf(dam.id).length);
  const mean = births.reduce((a, b) => a + b, 0) / births.length;
  assert.ok(mean > 2.5 && mean <= 3.1, `${mean} crias per female over three years, mated at every chance`);
  assert.ok(Math.max(...births) <= 4);
});
