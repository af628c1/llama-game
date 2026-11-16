// Screen-space UI, run in parallel with whichever world scene is showing. Keeping it in
// its own scene (with its own un-zoomed camera) means the world cameras can zoom the
// pixel art without touching it. It shows the time and weather board, the menu button and
// the controls hint, asks questions, and — because it outlives the world scenes and draws
// on top of them — owns the fade used for doors, for sleeping and for loading a game. It
// also runs the clock, which stands still whenever a question or the menu is up or the
// screen is faded out, and it is where a game is saved and loaded.

import { FADE, pickUiScale } from '../config.js';
import SaveStore from '../save/SaveStore.js';
import TimePanel from '../ui/TimePanel.js';
import ChoicePanel from '../ui/ChoicePanel.js';
import MenuButton from '../ui/MenuButton.js';
import SaveMenu from '../ui/SaveMenu.js';
import { onPress } from '../ui/keys.js';

// How long each of today's events is shown when there are several.
const EVENT_SWAP_MS = 4000;

// The world scene a new game starts in, and a loaded one falls back to.
const START_SCENE = 'Ranch';

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
    // True from the moment the screen starts fading out until it starts fading back in.
    this.covered = false;
  }

  // World scenes hold the rancher still, and start nothing new, while this is true.
  get busy() {
    return this.covered || (this.dialog && this.dialog.isOpen);
  }

  // The world scene on screen: the running scene that can say where the rancher is.
  get world() {
    return this.scene.manager.getScenes(true).find((scene) => typeof scene.savePlace === 'function');
  }

  create() {
    this.hint = this.add.text(0, 0, 'Alpaca Ranch — WASD / Arrows to move · Space to jump 🦙', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 5 },
    });

    // The whole game state. Its sections are replaced when a game is loaded, so they are
    // always reached through it (this.state.time), never kept.
    this.state = this.registry.get('state');
    this.store = new SaveStore(this.state);

    this.panel = new TimePanel(this, this.cache.json.get('hud'));
    // One panel asks every question and shows the menu. The menu button is made after
    // it, so that it stays on top and can still be clicked, to close whatever is up.
    this.dialog = new ChoicePanel(this);
    this.menu = new SaveMenu(this.dialog, this.store, {
      save: (slot) => this.saveGame(slot),
      load: (slot) => this.loadGame(slot),
    });
    this.menuButton = new MenuButton(this, () => this.toggleMenu());
    // Esc backs out of whatever is up, or opens the menu.
    onPress(this, ['ESC'], () => {
      if (this.dialog.isOpen) this.dialog.cancel();
      else this.toggleMenu();
    });
    this.shown = '';

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.refreshPanel();
  }

  layout() {
    const { width, height } = this.scale.gameSize;
    const scale = pickUiScale(width, height);
    this.panel.place(width, scale);
    this.dialog.place(width, height, scale);

    // The menu button keeps the board's distance from the corner; the hint sits beside it.
    const button = this.menuButton.place(this.cache.json.get('hud').art.screenMargin, scale);
    this.hint.setPosition(button.right + 8, Math.round(button.centerY - this.hint.height / 2));
  }

  update(time, delta) {
    if (!this.busy) {
      this.state.time.tick(delta);
      this.state.stats.playedMs += delta;
    }
    this.refreshPanel();
  }

  // Redraw the board only when something on it has changed.
  refreshPanel() {
    const { time, stats } = this.state;
    const events = time.eventsToday;
    const event = events.length
      ? events[Math.floor(stats.playedMs / EVENT_SWAP_MS) % events.length]
      : null;
    const view = {
      weather: time.weather,
      date: time.dateText,
      year: time.yearText,
      clock: time.clockText,
      event,
    };
    const signature = JSON.stringify(view);
    if (signature === this.shown) return;
    this.shown = signature;
    this.panel.render(view);
  }

  // Ask a yes/no question in the middle of the screen. `onYes` runs on Yes; Esc is No.
  confirm(question, onYes) {
    if (this.busy) return;
    this.dialog.show({ title: question, buttons: [{ label: 'Yes', onPick: onYes }, { label: 'No' }] });
  }

  // The menu button: close whatever is up, or open the menu.
  toggleMenu() {
    if (this.dialog.isOpen) this.dialog.close();
    else if (!this.covered) this.menu.open();
  }

  // Write the game into a save slot, exactly as it is at this moment. Throws a SaveError
  // if it can't be done.
  saveGame(slot) {
    this.state.player.place = this.world.savePlace();
    this.store.save(slot);
  }

  // Switch over to the game in a save slot, behind a fade. Throws a SaveError — before
  // anything has changed — if the slot can't be loaded.
  loadGame(slot) {
    const { sections } = this.store.load(slot);
    const { world } = this;
    this.fadeThrough(() => {
      this.state.adopt(sections);
      const { scene, data, rancher } = this.placeToStart();
      world.scene.start(scene, { ...data, rancher });
    });
  }

  // Where the game just loaded puts the rancher. If its scene or room is one this version
  // of the game doesn't have, they start where a new game does.
  placeToStart() {
    const { place } = this.state.player;
    const scene = place && this.scene.get(place.scene);
    const known = scene && typeof scene.savePlace === 'function'
      && (!scene.canStart || scene.canStart(place.data));
    return known ? place : { scene: START_SCENE, data: {} };
  }

  // Fade the whole screen to black, run `swap` (which changes what is behind it) while
  // nothing can be seen, stay black for a beat, then fade back in.
  fadeThrough(swap, holdMs = FADE.holdMs) {
    if (this.covered) return;
    this.covered = true;

    const cam = this.cameras.main;
    cam.once('camerafadeoutcomplete', () => {
      swap();
      this.time.delayedCall(holdMs, () => {
        this.covered = false;
        cam.fadeIn(FADE.inMs, 0, 0, 0);
      });
    });
    cam.fadeOut(FADE.outMs, 0, 0, 0);
  }
}
