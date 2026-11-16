// From genotype to coat: what an animal looks like, given its colour loci and its shade.
//
//   MC1R  e/e          can't make black pigment        -> the fawn family (white to dark fawn)
//         E_ with a/a  makes only black pigment        -> the black family
//         E_ with A_                                   -> the brown family
//   GREY  G_           dilutes black pigment to grey, with white "tuxedo" markings; it only
//                      shows on an animal that makes black pigment (E_)
//   SPOT  S_           white markings; they don't show on a white coat
//   G_ and S_ together: a blue-eyed white, whatever else the animal carries
//
// Shade (a quantitative trait, 0 pale to 1 dark) picks the tier within the family; the
// tiers and their keys are COLOR in config.js.
//
// What comes out is only what can be seen. A fawn can carry grey unseen, a white can
// carry spots unseen, and a blue-eyed white hides everything under it.

import { COLOR, TRAITS } from './config.js';
import { hasDominant } from './genome.js';

// The shade an animal's genes alone would give it. An animal's actual shade also has its
// permanent environmental part: see ofAlpaca().
export const geneticShade = (genome) => TRAITS.shade.mu + genome.breedingValues.shade;

// { family, shadeTier, grey, spotted, bew, colorKey } for a genome, at a given shade.
// `colorKey` is the stable name of the look: 'fawn_light', 'brown_dark_spotted',
// 'black_grey', 'bew'...
export function getPhenotype(genome, shade = geneticShade(genome)) {
  const carriesGrey = hasDominant(genome, 'GREY');
  const carriesSpots = hasDominant(genome, 'SPOT');
  if (carriesGrey && carriesSpots) {
    return {
      family: 'bew', shadeTier: 'white', grey: false, spotted: false, bew: true, colorKey: COLOR.bewKey,
    };
  }

  const makesBlack = hasDominant(genome, 'MC1R');
  let family = 'fawn';
  if (makesBlack) family = hasDominant(genome, 'ASIP') ? 'brown' : 'black';
  const { tier, key } = COLOR.families[family].find((t) => t.below === undefined || shade < t.below);

  const grey = carriesGrey && makesBlack;
  const spotted = carriesSpots && !COLOR.hidesSpots.includes(key);
  return {
    family,
    shadeTier: tier,
    grey,
    spotted,
    bew: false,
    colorKey: `${key}${grey ? '_grey' : ''}${spotted ? '_spotted' : ''}`,
  };
}

// The coat of an actual animal: its genes' shade plus its own permanent deviation.
export function ofAlpaca(alpaca) {
  return getPhenotype(alpaca.genome, geneticShade(alpaca.genome) + alpaca.permEnv.shade);
}

// 'suri' or 'huacaya'. Suri is dominant.
export const getFleece = (genome) => (hasDominant(genome, 'FLEECE') ? 'suri' : 'huacaya');

// Every colourKey there is, for whoever makes the sprites.
export function allColorKeys() {
  const keys = [COLOR.bewKey];
  Object.entries(COLOR.families).forEach(([family, tiers]) => {
    tiers.forEach(({ key }) => {
      keys.push(key);
      // Grey and spots are never seen together: both at once is a blue-eyed white.
      if (family !== 'fawn') keys.push(`${key}_grey`);
      if (!COLOR.hidesSpots.includes(key)) keys.push(`${key}_spotted`);
    });
  });
  return keys;
}
