import test from 'node:test';
import assert from 'node:assert/strict';

import Rng from '../rng.js';
import { TRAITS } from '../config.js';
import {
  ALLELES, LOCUS_NAMES, TRAIT_NAMES, pair, genotype, copies, inheritLoci, inheritBreedingValues,
  randomGenotype,
} from '../genome.js';
import { uniformGenome } from './helpers.js';

const N = 10000;

test('rng: a seed fixes the run, and a saved state continues it', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  const first = Array.from({ length: 50 }, () => a.next());
  assert.deepEqual(first, Array.from({ length: 50 }, () => b.next()));
  assert.notDeepEqual(first, Array.from({ length: 50 }, () => new Rng(43).next()).slice(0, 50));

  const resumed = new Rng(JSON.parse(JSON.stringify(a.save())));
  const draws = (rng) => [rng.next(), rng.normal(), rng.int(10), rng.chance(0.5), rng.pick(['x', 'y', 'z'])];
  assert.deepEqual(draws(resumed), draws(a));
  assert.ok(first.every((x) => x >= 0 && x < 1));
});

test('rng: uniform and normal draws have the right shape', () => {
  const rng = new Rng(7);
  let sum = 0;
  let sumSq = 0;
  let uniformSum = 0;
  for (let i = 0; i < 40000; i++) {
    const x = rng.normal(3, 2);
    sum += x;
    sumSq += x * x;
    uniformSum += rng.next();
  }
  const mean = sum / 40000;
  const sd = Math.sqrt(sumSq / 40000 - mean * mean);
  assert.ok(Math.abs(mean - 3) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(sd - 2) < 0.05, `sd ${sd}`);
  assert.ok(Math.abs(uniformSum / 40000 - 0.5) < 0.01);
});

test('alleles are kept dominant first', () => {
  assert.deepEqual(pair('MC1R', 'e', 'E'), ['E', 'e']);
  assert.deepEqual(pair('FLEECE', 'hu', 'Su'), ['Su', 'hu']);
  assert.deepEqual(pair('CHOANAL', 'd', 'N'), ['N', 'd']);
  assert.equal(copies(uniformGenome('het'), 'ASIP', 'a'), 1);
  assert.equal(copies(uniformGenome('rec'), 'ASIP', 'a'), 2);
});

test('a defect locus the genome lacks reads as normal', () => {
  const genome = uniformGenome('het');
  delete genome.loci.CHOANAL;
  assert.deepEqual(genotype(genome, 'CHOANAL'), ['N', 'N']);
  assert.throws(() => genotype({ loci: {} }, 'MC1R'));
});

test('Mendelian ratios: Aa x Aa gives 1 : 2 : 1 at every locus', () => {
  const rng = new Rng(2024);
  const sire = uniformGenome('het');
  const dam = uniformGenome('het');
  const counts = Object.fromEntries(LOCUS_NAMES.map((l) => [l, [0, 0, 0]]));
  for (let i = 0; i < N; i++) {
    const loci = inheritLoci(rng, sire, dam);
    LOCUS_NAMES.forEach((locus) => {
      counts[locus][copies({ loci }, locus, ALLELES[locus][1])] += 1;
    });
  }
  LOCUS_NAMES.forEach((locus) => {
    const [dom, het, rec] = counts[locus].map((c) => c / N);
    assert.ok(Math.abs(rec - 0.25) < 0.015, `${locus}: ${rec} homozygous recessive`);
    assert.ok(Math.abs(het - 0.5) < 0.017, `${locus}: ${het} heterozygous`);
    assert.ok(Math.abs(dom - 0.25) < 0.015, `${locus}: ${dom} homozygous dominant`);
  });
});

test('Mendelian ratios: test crosses and pure crosses', () => {
  const rng = new Rng(99);
  const het = uniformGenome('het');
  const rec = uniformGenome('rec');
  const dom = uniformGenome('dom');
  const recessive = Object.fromEntries(LOCUS_NAMES.map((l) => [l, 0]));
  for (let i = 0; i < N; i++) {
    const loci = inheritLoci(rng, het, rec);
    LOCUS_NAMES.forEach((locus) => {
      if (copies({ loci }, locus, ALLELES[locus][1]) === 2) recessive[locus] += 1;
    });
    // Each parent gives what it has: dominant x recessive is always heterozygous.
    const cross = inheritLoci(rng, dom, rec);
    LOCUS_NAMES.forEach((locus) => assert.deepEqual(cross[locus], ALLELES[locus]));
  }
  LOCUS_NAMES.forEach((locus) => {
    assert.ok(Math.abs(recessive[locus] / N - 0.5) < 0.017, `${locus}: Aa x aa gave ${recessive[locus] / N} aa`);
  });
});

test('loci assort independently', () => {
  const rng = new Rng(5);
  const het = uniformGenome('het');
  let both = 0;
  for (let i = 0; i < N; i++) {
    const loci = inheritLoci(rng, het, het);
    if (copies({ loci }, 'MC1R', 'e') === 2 && copies({ loci }, 'ASIP', 'a') === 2) both += 1;
  }
  assert.ok(Math.abs(both / N - 1 / 16) < 0.01, `${both / N} double recessive`);
});

test('base genotypes follow the allele frequency', () => {
  const rng = new Rng(11);
  let dominant = 0;
  for (let i = 0; i < N; i++) dominant += copies({ loci: { GREY: randomGenotype(rng, 'GREY', 0.3) } }, 'GREY', 'G');
  assert.ok(Math.abs(dominant / (2 * N) - 0.3) < 0.012);
});

test('breeding values: mid-parent plus Mendelian sampling, narrower for inbred parents', () => {
  const rng = new Rng(31);
  const parent = (bv, F) => ({
    inbreedingF: F,
    genome: { breedingValues: Object.fromEntries(TRAIT_NAMES.map((t) => [t, bv])) },
  });
  const spread = (sire, dam) => {
    const values = [];
    for (let i = 0; i < N; i++) values.push(inheritBreedingValues(rng, sire, dam).fiberDiameter);
    const mean = values.reduce((a, b) => a + b, 0) / N;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
    return { mean, variance };
  };
  const { sigmaA } = TRAITS.fiberDiameter;

  const outbred = spread(parent(2, 0), parent(-1, 0));
  assert.ok(Math.abs(outbred.mean - 0.5) < 0.06, `mean ${outbred.mean}`);
  assert.ok(Math.abs(outbred.variance - sigmaA ** 2 / 2) < 0.12, `variance ${outbred.variance}`);

  const inbred = spread(parent(2, 0.5), parent(-1, 0.25));
  const expected = (sigmaA ** 2 / 2) * (1 - 0.375);
  assert.ok(Math.abs(inbred.variance - expected) < 0.1, `variance ${inbred.variance} vs ${expected}`);
});
