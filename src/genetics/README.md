# Alpaca genetics

The herd's genetics: inheritance, coat colour, fleece and body traits, recessive defects,
inbreeding, breeding and pregnancy, and what the player is allowed to know about any of
it. Pure logic with no rendering — it runs in the game and, unchanged, in the tests.

```bash
npm test
```

There is no UI yet. In the browser's dev console, `genetics.help()` lists the debug
commands.

## The one rule

**The front end reads animals only through the quipu.**

```js
const { world } = this.registry.get('state').genetics;

world.quipu.getPlayerView(alpacaId, skillLevel);            // one animal
world.quipu.getPairingForecast(sireId, damId, skillLevel);  // a possible mating
```

Everything else in here knows what the player doesn't: genotypes, breeding values,
pregnancies nobody has noticed yet. `skillLevel` is the player's quipu skill, 0–3, set by
the story.

## How it works

| File | What it does |
| --- | --- |
| `config.js` | Every number. Balance the game here and nowhere else. |
| `Genetics.js` | The world: ties the rest together. `world.tick(day)`, `world.phenotype(id)`. |
| `rng.js` | Seeded random numbers, handed to everything; its state is saved. |
| `genome.js` | Loci and alleles, meiosis, inheriting breeding values. |
| `color.js` | Genotype + shade → what the coat looks like (`colorKey`). |
| `traits.js` | Breeding values → actual traits, with age, nutrition, inbreeding, defects. |
| `defects.js` | Recessive defects and their effects. |
| `pedigree.js` | The registry of every animal ever born; kinship and inbreeding. |
| `breeding.js` | Who can breed, conception, the spit-off test, pregnancy, birth. |
| `quipu.js` | What the player knows. The only read path for the screen. |
| `modifiers.js` | Hook for blessings (the chullumpi, later). None registered. |
| `founders.js` | The herds that exist at the start, by bloodline. |
| `serialize.js` | Save and load, with a schema version. |
| `events.js` | The events the system emits instead of calling UI code. |
| `debug.js` | Dev-console commands and the generation simulator. |

**An animal** has a hidden genome: two alleles at each Mendelian locus (four colour loci,
fleece type, and one locus per defect) and a breeding value for each of eight quantitative
traits. A cria takes one allele per locus from each parent, at random, and breeding values
that are the parents' average plus a random Mendelian sampling term — so a pairing is
never fully predictable, and two fine parents can still have a coarse cria.

**Colour** is `MC1R` (e/e: fawn family) and `ASIP` (a/a with E: black; otherwise brown),
with `GREY` and `SPOT` as patterns on top. Grey and spots together make a blue-eyed white,
often deaf. A polygenic *shade* picks the tier within the family. `colorKey` is the name a
sprite will hang on: `fawn_light`, `brown_dark_spotted`, `black_grey`, `bew`
(`allColorKeys()` lists them all).

**Traits** are computed when asked for, never stored:
`P = age(mu + BV + permEnv) + nutrition − F × depression + defects + modifiers`.
Heritabilities are fibre 0.36–0.5, size and docility ~0.35, fertility and hardiness ~0.12.

**Defects** are recessive: carriers look and measure exactly like clear animals; d/d
animals are affected. Choanal atresia kills the cria within days.

**Inbreeding.** Every animal stays in the pedigree for good. A cria's inbreeding
coefficient F is its parents' kinship; it lowers fertility, hardiness and size, and
`INBREEDING_SURVIVAL_PENALTY × F` comes straight off its chance of surviving birth.
`world.pedigree.kinship(a, b)` gives the F a pairing would produce, before it is made.

**Breeding.** Alpacas breed all year. `GESTATION_DAYS` is one season and
`POSTPARTUM_REST_DAYS` the other three, so a female has one cria a year. A pregnancy is
hidden until `spitOffTest` shows it or the cria arrives. Death is permanent.

**Founders.** Each family's herd is bred quietly from unrelated base animals over three
generations, so its animals are related (about like half siblings) and slightly inbred.
What a family is known for is its bloodline in `config.js`.

**Determinism.** A seed fixes everything. A saved game holds the random-number state, so
it rolls on exactly as it would have.

## Using it from the game

```js
import { genetics } from '../state/GeneticsState.js';

// Once, at start-up — these outlive loading a save:
genetics.events.on('cria_born', ({ criaId, damId, day }) => { /* ... */ });
genetics.hooks.getNutritionScore = (alpacaId) => 0;      // -1 starving .. 1 well fed
genetics.hooks.getWeatherStress = (day) => 0;            // 0 fair .. 1 the worst
genetics.hooks.canUseStud = (sireId, ownerId) => true;   // stud lending, by relationship

// During play — always through the state, because loading replaces the world:
const { world } = this.registry.get('state').genetics;

world.breeding.canBreed(sireId, damId);            // { ok } or { ok: false, reason, who }
world.breeding.attemptConception(sireId, damId);   // { ok, conceived }: not for the player's eyes
world.breeding.spitOffTest(damId);                 // { spits }
world.pedigree.herdOf('player');                   // living animals (raw: logic only)
world.phenotype(alpacaId);                         // true trait values, for the economy
world.transfer(alpacaId, 'player');                // a sale: goes on the player's records
world.quipu.recordHerd('family:fine_fleece');      // a family opens its herd book
```

The daily tick is already wired: `GameState.nextDay()` moves the clock and calls
`world.tick(day)`, which advances pregnancies and delivers crias. The herd is the
`genetics` section of the game state, so the save slots carry it.

**Events:** `conceived`, `pregnancy_revealed`, `miscarriage`, `cria_born`, `cria_died`,
`defect_revealed`, `carrier_proven`, `deafness_detected`. Payloads are listed in
`events.js`. `conceived` is for game systems only — the player doesn't know yet.

## What the screen gets

`world.quipu.getPlayerView(id, 3)`:

```js
{
  id: 49, name: null, sex: 'F', ownerId: 'player', recorded: true,
  alive: true, ageDays: 664, death: null,
  color: { family: 'fawn', shadeTier: 'light', grey: false, spotted: false, bew: false,
           colorKey: 'fawn_light' },
  blueEyed: false, fleece: 'huacaya', defects: [], deaf: false, predatorRisk: false,
  parents: { sireId: 42, damId: 46 }, offspring: [282, 284],
  pregnancy: null,                         // { sireId, sinceDay } once it is known
  lastMating: { sireId: 52, day: 124 }, lastBirthDay: 152,
  traits: { fiberDiameter: 'very coarse', density: 'thin', hardiness: 'frail', /* ... */ },

  // skill 1 and up
  estimates: { fiberDiameter: { value: 26.72, accuracy: 0.75 }, /* ... */ },
  // skill 2 and up: 'affected' | 'proven_carrier' | 'possible' | 'likely_clear' | 'unknown'
  carrier: { choanal_atresia: { status: 'possible', chance: 0.5 }, /* ... */ },
  // skill 3: '?' is an allele that can't be told
  colorGenes: { MC1R: 'e/e', ASIP: '?/?', GREY: '?/?', SPOT: 's/s', FLEECE: 'hu/hu' },
}
```

`getPairingForecast(sireId, damId, 3)` gives `canBreed` (as far as the player can tell),
`traits` (a likely `{ low, high }` for a grown cria, skill 1), `defects` (`{ risk }` of an
affected cria, `null` where nothing is known, skill 2) and `inbreeding`
(`{ coefficient, percent, warning: 'none' | 'related' | 'close' }`, skill 3).

Three things to know when building screens on it:

- **Estimates are not measurements.** `value` is what the animal is reckoned to pass on,
  and `accuracy` (0–1) how far to trust it. It starts as the parents' average, firms up
  when the animal is old enough to judge, and keeps improving with every cria on record.
- **Knowledge comes from records.** The player has records of their own herd and its
  ancestors, every animal that becomes theirs, every cria born to them and every stud
  they use. Another family's animals are unknowns until the story opens that herd book —
  so two animals bought from one family can be closer kin than the forecast shows.
- **Nothing is ever certain.** "Likely clear" never reaches zero; a spit-off test can
  miss; a forecast range holds about two times in three.

## Adding things

**A defect:** add an entry to `DEFECTS` in `config.js` with a new `locus` name. That is
all: it is inherited, shown, tracked by the quipu, and saved. Animals born before it
existed count as clear. Give bloodlines a `carrierRate` for it if some should carry it.

**A trait:** add an entry to `TRAITS` (`mu`, `sigmaA`, `sigmaE`, and `words` if it can be
seen by looking). It gets breeding values, inheritance, estimates and saving. Animals from
older saves are average for it. If it changes with age, add a case to `withAge` and
`ageAdjusted` in `traits.js`.

**A colour locus:** add it to `LOCI`, read it in `color.js` (and in `genesFromLooks` in
`quipu.js`), extend the table in `tests/color.test.js`, and raise
`GENETICS_SCHEMA_VERSION` with a migration that gives existing animals a genotype.

**A bloodline:** add a profile to `BLOODLINES`, listing only what differs from
`BLOODLINE_DEFAULTS`. `WORLD_HERDS` says which herds a new game starts with.

**A modifier (the chullumpi):** `genetics.modifiers.register({ id, onConception,
onGenome, onPhenotype, onBirth })`, then pass its id as the last argument of
`attemptConception`. See `modifiers.js`.

## Dev console

```js
genetics.herd()                              // the player's animals, nothing hidden
genetics.spawnFounder('fine_fleece', 'M')
genetics.forceBreed(sireId, damId)
genetics.fastForwardPregnancy(damId)
genetics.showGenome(id)
genetics.showPedigree(id, 3)
genetics.kinship(a, b)
genetics.playerView(id, 2)
genetics.forecast(sireId, damId, 3)
genetics.simulateGenerations(6, 30, 'best-to-best', { seed: 1, bloodline: 'starter' })
```

`simulateGenerations` breeds a herd for n generations in a world of its own and prints,
per generation, the mean traits, mean F, how common each defect allele is, and cria
deaths. Strategies: `'random'`, `'best-to-best'`, `'sibling'`.
