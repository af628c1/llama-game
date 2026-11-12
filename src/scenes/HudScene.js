// Screen-space UI, run in parallel with whichever world scene is showing. Keeping it in
// its own scene (with its own un-zoomed camera) means the world cameras can zoom the
// pixel art without touching it. It shows the time and weather board and the controls
// hint, asks yes/no questions, and — because it outlives the world scenes and draws on
// top of them — owns the fade used for doors and for sleeping. It also runs the clock,
// which stands still whenever a question is up or the screen is faded out.

import { FADE, pickUiScale } from '../config.js';
import TimePanel from '../ui/TimePanel.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';

// How long each of today's events is shown when there are several.
const EVENT_SWAP_MS = 4000;

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

  create() {
    this.add.text(12, 10, 'Alpaca Ranch — WASD / Arrows to move · Space to jump 🦙', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: { x: 8, y: 5 },
    });

    this.state = this.registry.get('time');
    this.panel = new TimePanel(this, this.cache.json.get('hud'));
    this.dialog = new ConfirmDialog(this);
    this.shown = '';
    this.playedMs = 0;

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.refreshPanel();
  }

  layout() {
    const { width, height } = this.scale.gameSize;
    const scale = pickUiScale(width, height);
    this.panel.place(width, scale);
    this.dialog.place(width, height, scale);
  }

  update(time, delta) {
    if (!this.busy) {
      this.state.tick(delta);
      this.playedMs += delta;
    }
    this.refreshPanel();
  }

  // Redraw the board only when something on it has changed.
  refreshPanel() {
    const { state } = this;
    const events = state.eventsToday;
    const event = events.length
      ? events[Math.floor(this.playedMs / EVENT_SWAP_MS) % events.length]
      : null;
    const view = {
      weather: state.weather,
      date: state.dateText,
      year: state.yearText,
      clock: state.clockText,
      event,
    };
    const signature = JSON.stringify(view);
    if (signature === this.shown) return;
    this.shown = signature;
    this.panel.render(view);
  }

  // Ask a yes/no question in the middle of the screen. `onYes` runs on Yes.
  confirm(question, onYes) {
    if (this.busy) return;
    this.dialog.open(question, onYes);
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
