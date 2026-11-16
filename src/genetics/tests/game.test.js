// The genetics inside the game: as a section of the game state, saved in the save slots,
// ticked when the game's day changes, and driven from the dev console.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SAVE } from '../../config.js';
import GameState from '../../state/GameState.js';
import { genetics } from '../../state/GeneticsState.js';
import SaveStore from '../../save/SaveStore.js';
import { PLAYER_ID, WORLD_HERDS, GESTATION_DAYS, YEAR_DAYS } from '../config.js';
import { serialize } from '../serialize.js';
import { createDebug, simulateGenerations } from '../debug.js';

const content = { events: [] };
const place = { scene: 'Ranch', data: {}, name: 'Ranch', rancher: { x: 1, y: 2 } };
function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); } };
}
globalThis.window = { localStorage: fakeStorage() };
const newGame = () => {
  window.localStorage = fakeStorage();
  const state = new GameState(content);
  state.player.place = place;
  return { state, store: new SaveStore(state) };
};

test('a new game has its herds, bred only when first asked for', () => {
  const { state } = newGame();
  assert.equal(state.genetics.made, null, 'making a state costs nothing');
  const { world } = state.genetics;
  WORLD_HERDS.forEach(({ ownerId, count }) => assert.equal(world.pedigree.herdOf(ownerId).length, count));
  assert.equal(state.genetics.world, world, 'and only once');
  // Two new games are two different herds.
  assert.notDeepEqual(serialize(newGame().state.genetics.world).animals, serialize(world).animals);
});

test('the game\'s day drives the daily tick', () => {
  const { state } = newGame();
  const { world } = state.genetics;
  const mine = world.pedigree.herdOf(PLAYER_ID);
  const sire = mine.find((a) => a.sex === 'M');
  const dam = mine.find((a) => a.sex === 'F');
  while (!dam.pregnancy) world.breeding.attemptConception(sire.id, dam.id);
  const born = [];
  const stop = genetics.events.on('cria_born', (e) => born.push(e));

  let nights = 0;
  while (dam.pregnancy && nights < GESTATION_DAYS + 5) {
    state.nextDay();
    nights += 1;
    assert.equal(world.day, state.time.absoluteDay);
  }
  stop();
  // Either the cria came, or (rarely) the pregnancy was lost on the way.
  assert.equal(dam.pregnancy, null);
  if (born.length) assert.deepEqual(born.map((e) => [e.damId, e.day]), [[dam.id, state.time.absoluteDay]]);
  assert.ok(nights >= 1 && nights <= GESTATION_DAYS + 2);
});

test('the herd is saved in the slots and loaded back, with its future', () => {
  const { state, store } = newGame();
  const { world } = state.genetics;
  const mine = world.pedigree.herdOf(PLAYER_ID);
  const sire = mine.find((a) => a.sex === 'M');
  mine.filter((a) => a.sex === 'F').forEach((dam) => world.breeding.attemptConception(sire.id, dam.id));
  for (let i = 0; i < 12; i++) state.nextDay();
  store.save(1);
  const saved = JSON.stringify(serialize(state.genetics.world));

  // Play on, then go back to the save.
  const playOn = (s) => { for (let i = 0; i < 2 * YEAR_DAYS; i++) s.nextDay(); return JSON.stringify(serialize(s.genetics.world)); };
  const future = playOn(state);
  assert.notEqual(future, saved);

  state.adopt(store.load(1).sections);
  assert.notEqual(state.genetics.world, world, 'a loaded game is a new world');
  assert.equal(JSON.stringify(serialize(state.genetics.world)), saved);
  assert.equal(state.genetics.world.day, state.time.absoluteDay);
  assert.equal(playOn(state), future, 'the same days, lived again, go the same way');

  // The loaded world is on the game's wiring.
  assert.equal(state.genetics.world.events, genetics.events);
  assert.equal(state.genetics.world.modifiers, genetics.modifiers);
  assert.deepEqual(store.list().map((s) => s.status), ['ok', 'empty']);
});

test('a save from before there were alpacas loads with new herds', () => {
  const { state, store } = newGame();
  for (let i = 0; i < 44; i++) state.time.sleep();
  store.save(1);
  const key = `${SAVE.storageKey}1`;
  const file = JSON.parse(window.localStorage.getItem(key));
  delete file.sections.genetics;
  window.localStorage.setItem(key, JSON.stringify(file));

  // Another session, the same browser storage.
  const later = new GameState(content);
  later.adopt(new SaveStore(later).load(1).sections);
  assert.equal(later.time.absoluteDay, 44);
  const { world } = later.genetics;
  assert.equal(world.pedigree.herdOf(PLAYER_ID).length, WORLD_HERDS[0].count);
  // The herds start from day 0; the first night catches them up to the game's day.
  later.nextDay();
  assert.equal(world.day, 45);
});

test('a damaged or newer herd makes the whole save unloadable', () => {
  const { state, store } = newGame();
  state.genetics.world.tick(3);
  store.save(1);
  const key = `${SAVE.storageKey}1`;
  const good = window.localStorage.getItem(key);
  const put = (edit) => { const f = JSON.parse(good); edit(f.sections.genetics.data); window.localStorage.setItem(key, JSON.stringify(f)); };
  const kind = () => { try { store.load(1); return 'loaded'; } catch (e) { return e.kind; } };

  put((d) => { d.animals[10].genes = 'zz'; });
  assert.equal(kind(), 'damaged');
  put((d) => { d.geneticsSchemaVersion = 99; });
  assert.equal(kind(), 'newer');
  window.localStorage.setItem(key, good);
  assert.equal(kind(), 'loaded');
});

test('dev console: every command runs, and tells the truth', () => {
  const { state } = newGame();
  const printed = [];
  const out = { log: (...args) => printed.push(args), table: (rows) => printed.push(rows) };
  const dev = createDebug(() => state.genetics.world, out);
  const { world } = state.genetics;

  dev.help();
  const herd = dev.herd();
  assert.equal(herd.length, world.pedigree.herdOf(PLAYER_ID).length);
  assert.ok('carries' in herd[0] && 'F' in herd[0]);

  const stud = dev.spawnFounder('fine_fleece', 'M');
  const ewe = dev.spawnFounder('hardy_highland', 'F');
  assert.deepEqual([stud.sex, ewe.sex, stud.ownerId, stud.sireId], ['M', 'F', PLAYER_ID, null]);
  assert.ok(world.quipu.isRecorded(stud.id));
  assert.equal(dev.kinship(stud.id, ewe.id), 0);
  assert.equal(dev.kinship(stud.id, stud.id), 0.5);

  const pregnancy = dev.forceBreed(stud.id, ewe.id);
  assert.equal(pregnancy.dueDay, world.day + GESTATION_DAYS);
  assert.throws(() => dev.forceBreed(ewe.id, stud.id));
  const cria = dev.fastForwardPregnancy(ewe.id);
  assert.deepEqual([cria.sireId, cria.damId, cria.birthDay], [stud.id, ewe.id, world.day]);
  assert.equal(dev.fastForwardPregnancy(ewe.id), null);
  assert.equal(dev.kinship(cria.id, stud.id), 0.25);

  assert.equal(dev.showGenome(cria.id), cria);
  assert.deepEqual(dev.showPedigree(cria.id, 1), { id: cria.id, sire: { id: stud.id }, dam: { id: ewe.id } });
  assert.deepEqual(dev.playerView(cria.id, 0), world.quipu.getPlayerView(cria.id, 0));
  assert.deepEqual(dev.forecast(stud.id, ewe.id, 3), world.quipu.getPairingForecast(stud.id, ewe.id, 3));
  assert.throws(() => dev.showGenome(99999));
  assert.ok(printed.length > 8);

  // It follows the game to a loaded world.
  const other = new GameState(content);
  state.adopt({ genetics: other.genetics });
  assert.equal(dev.herd().length, other.genetics.world.pedigree.herdOf(PLAYER_ID).length);
});

test('simulateGenerations: selection works, inbreeding costs, and it is repeatable', () => {
  const run = (strategy, seed = 3) => simulateGenerations(6, 30, strategy, { seed, bloodline: 'hardy_highland' });
  const random = run('random');
  const best = run('best-to-best');
  const sibling = run('sibling');
  const last = (rows) => rows.at(-1);

  assert.deepEqual(run('random'), random, 'the same seed, the same story');
  assert.notDeepEqual(run('random', 4), random);
  assert.equal(random.length, 7);
  assert.equal(random[0].generation, 0);
  assert.ok(random.every((row) => row.herd > 0 && row.herd <= 30));

  // Breeding the finest to the finest makes finer fleece.
  assert.ok(last(best).microns < best[0].microns - 2, `${best[0].microns} -> ${last(best).microns}`);
  assert.ok(last(best).microns < last(random).microns - 1);
  // Breeding brother to sister piles up inbreeding, and crias die of it.
  assert.ok(last(sibling).meanF > 0.4 && last(sibling).meanF > last(random).meanF + 0.15, `F ${last(sibling).meanF} vs ${last(random).meanF}`);
  const deaths = (rows) => rows.reduce((sum, row) => sum + row.criaDeaths, 0) / rows.reduce((sum, row) => sum + row.births, 0);
  assert.ok(deaths(sibling) > deaths(random) + 0.15, `${deaths(sibling)} vs ${deaths(random)}`);
  assert.ok(last(sibling).fertility < last(random).fertility - 4);
  assert.throws(() => simulateGenerations(1, 10, 'no-such-strategy'));
});
