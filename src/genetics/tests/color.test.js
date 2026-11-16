import test from 'node:test';
import assert from 'node:assert/strict';

import { getPhenotype, getFleece, ofAlpaca, allColorKeys } from '../color.js';
import { TRAITS } from '../config.js';
import { plainGenome } from './helpers.js';

const genomeOf = (mc1r, asip, grey, spot, shade = 0.5) => {
  const genome = plainGenome({
    MC1R: mc1r.split('/'), ASIP: asip.split('/'), GREY: grey.split('/'), SPOT: spot.split('/'),
  });
  genome.breedingValues.shade = shade - TRAITS.shade.mu;
  return genome;
};

// The whole table at a middling shade: every MC1R/ASIP genotype (rows) against every
// GREY/SPOT genotype (columns), written out by hand.
const COLUMNS = [
  ['g/g', 's/s'], ['g/g', 'S/s'], ['g/g', 'S/S'],
  ['G/g', 's/s'], ['G/G', 's/s'],
  ['G/g', 'S/s'], ['G/g', 'S/S'], ['G/G', 'S/s'], ['G/G', 'S/S'],
];
const brown = ['brown', 'brown_spotted', 'brown_spotted', 'brown_grey', 'brown_grey', 'bew', 'bew', 'bew', 'bew'];
const black = ['black', 'black_spotted', 'black_spotted', 'black_grey', 'black_grey', 'bew', 'bew', 'bew', 'bew'];
// A fawn makes no black pigment, so grey has nothing to dilute and stays hidden.
const fawn = ['fawn', 'fawn_spotted', 'fawn_spotted', 'fawn', 'fawn', 'bew', 'bew', 'bew', 'bew'];
const TABLE = [
  ['E/E', 'A/A', brown], ['E/E', 'A/a', brown], ['E/e', 'A/A', brown], ['E/e', 'A/a', brown],
  ['E/E', 'a/a', black], ['E/e', 'a/a', black],
  ['e/e', 'A/A', fawn], ['e/e', 'A/a', fawn], ['e/e', 'a/a', fawn],
];

test('colour table: every genotype combination gives the expected colorKey', () => {
  let checked = 0;
  TABLE.forEach(([mc1r, asip, expected]) => {
    COLUMNS.forEach(([grey, spot], i) => {
      const { colorKey } = getPhenotype(genomeOf(mc1r, asip, grey, spot));
      assert.equal(colorKey, expected[i], `${mc1r} ${asip} ${grey} ${spot}`);
      checked += 1;
    });
  });
  assert.equal(checked, 81);
});

test('shade picks the tier within each family', () => {
  const key = (mc1r, asip, shade) => getPhenotype(genomeOf(mc1r, asip, 'g/g', 's/s', shade)).colorKey;
  assert.deepEqual([0.1, 0.3, 0.5, 0.9].map((s) => key('e/e', 'A/a', s)), ['white', 'fawn_light', 'fawn', 'fawn_dark']);
  assert.deepEqual([0.1, 0.5, 0.9].map((s) => key('E/e', 'A/a', s)), ['brown_light', 'brown', 'brown_dark']);
  assert.deepEqual([0.1, 0.5, 0.9].map((s) => key('E/e', 'a/a', s)), ['black_charcoal', 'black', 'black_true']);
  // Shade has no limits of its own: far off either end is still the end tier.
  assert.equal(key('e/e', 'a/a', -3), 'white');
  assert.equal(key('E/E', 'a/a', 7), 'black_true');
});

test('the phenotype describes only what can be seen', () => {
  const greyBrown = getPhenotype(genomeOf('E/e', 'A/a', 'G/g', 's/s', 0.9));
  assert.deepEqual(greyBrown, {
    family: 'brown', shadeTier: 'dark', grey: true, spotted: false, bew: false, colorKey: 'brown_dark_grey',
  });
  const spottedGreyless = getPhenotype(genomeOf('E/E', 'a/a', 'g/g', 'S/s', 0.1));
  assert.equal(spottedGreyless.colorKey, 'black_charcoal_spotted');

  // Hidden: grey on a fawn, spots on a white, and everything under a blue-eyed white.
  const hiddenGrey = getPhenotype(genomeOf('e/e', 'A/A', 'G/G', 's/s'));
  assert.equal(hiddenGrey.grey, false);
  const whiteWithSpots = getPhenotype(genomeOf('e/e', 'A/A', 'g/g', 'S/S', 0.1));
  assert.deepEqual([whiteWithSpots.colorKey, whiteWithSpots.spotted], ['white', false]);
  const bew = getPhenotype(genomeOf('E/E', 'a/a', 'G/g', 'S/s', 0.9));
  assert.deepEqual(bew, {
    family: 'bew', shadeTier: 'white', grey: false, spotted: false, bew: true, colorKey: 'bew',
  });
});

test('an animal\'s own shade includes its permanent environmental part', () => {
  const genome = genomeOf('e/e', 'a/a', 'g/g', 's/s', 0.4);
  assert.equal(getPhenotype(genome).colorKey, 'fawn_light');
  assert.equal(ofAlpaca({ genome, permEnv: { shade: 0.2 } }).colorKey, 'fawn');
  assert.equal(ofAlpaca({ genome, permEnv: { shade: -0.3 } }).colorKey, 'white');
});

test('fleece: Suri is dominant over Huacaya', () => {
  assert.equal(getFleece(plainGenome({ FLEECE: ['Su', 'Su'] })), 'suri');
  assert.equal(getFleece(plainGenome({ FLEECE: ['Su', 'hu'] })), 'suri');
  assert.equal(getFleece(plainGenome({ FLEECE: ['hu', 'hu'] })), 'huacaya');
});

test('allColorKeys lists exactly the looks that can come out', () => {
  const seen = new Set();
  TABLE.forEach(([mc1r, asip]) => {
    COLUMNS.forEach(([grey, spot]) => {
      for (let shade = -0.05; shade <= 1.05; shade += 0.05) {
        seen.add(getPhenotype(genomeOf(mc1r, asip, grey, spot, shade)).colorKey);
      }
    });
  });
  assert.deepEqual([...seen].sort(), allColorKeys().sort());
  assert.equal(new Set(allColorKeys()).size, allColorKeys().length);
});
