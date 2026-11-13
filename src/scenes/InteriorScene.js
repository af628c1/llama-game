// The inside of a building: one fixed room, centered on screen, built entirely from the
// art pack's interior spec (assets/<name>_interior.json) — which images to draw and in
// what order, what is solid, what can be used, where the rancher arrives and where the
// way out is. The scene is started with { id }, an entry of INTERIORS in config.js, and
// { wake: true } when the rancher is waking up here rather than walking in.
//
// Room pixels are world pixels here: the room's top-left is the world's origin.

import { INTERIOR_CHARACTER, HOME_INTERIOR, PLAYER_SPEED, FADE } from '../config.js';
import { interiorKey, interiorTex, interiorStateTex } from '../world/interiors.js';
import { boxFromRect, bodyOverlaps } from '../world/rects.js';
import Player from '../entities/Player.js';

export default class InteriorScene extends Phaser.Scene {
  constructor() {
    super('Interior');
  }

  create({ id, wake }) {
    const spec = this.cache.json.get(interiorKey(id));
    this.id = id;
    this.spec = spec;
    this.clock = this.registry.get('time');
    [this.roomW, this.roomH] = spec.room.size;

    this.cameras.main.setBackgroundColor(spec.art.sceneClearColor);
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, this.roomW, this.roomH);
    this.solids = this.physics.add.staticGroup();

    this.buildRoom(id, spec);

    // Arrive just inside the way in — or, waking up, beside the bed.
    const { feet: [x, y], facing } = wake ? this.bedside() : spec.spawns.fromFarm;
    this.player = new Player(this, x, y, {
      scale: INTERIOR_CHARACTER.scale,
      speed: PLAYER_SPEED * INTERIOR_CHARACTER.speedScale,
      facing,
    });
    this.physics.add.collider(this.player.feet, this.solids);

    // Ways out: walk down into a trigger to leave through that door.
    this.exits = spec.exits.map((exit) => ({ box: boxFromRect(exit.trigger), to: exit.to }));
    if (this.physics.world.drawDebug) this.exits.forEach(({ box }) => this.outline(box));

    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.fitCamera, this));
  }

  // Draw the room in the spec's layer order. Layers before 'ySorted' sit behind all
  // characters and layers after it (the shed's night tint) in front of them; ySorted
  // furniture is depth-sorted against the rancher's feet, so the rancher can walk behind
  // the table and in front of it.
  buildRoom(id, spec) {
    const { drawOrder } = spec;
    const sortedAt = drawOrder.indexOf('ySorted');
    const layerDepth = (layer) => {
      const i = drawOrder.indexOf(layer);
      return i < sortedAt ? i - sortedAt : 1e5 + i; // ySorted depths are y: 0..room height
    };

    this.add.image(0, 0, interiorTex(id, 'room')).setOrigin(0, 0).setDepth(layerDepth('base'));

    // What using an object does, by the spec's `interact.action`. Actions without an
    // entry here (the calendar's, for now) aren't clickable yet.
    const actions = { sleep: () => this.askToSleep() };
    this.nightOnly = []; // objects that only show after dark (the window's night view)
    this.stateful = {}; // objects that look different by state, by object id

    spec.objects.forEach((o) => {
      const key = interiorTex(id, o.id);
      const [x, y] = o.pos;
      let obj;
      if (o.states) {
        obj = this.add.image(x, y);
        this.stateful[o.id] = { obj, states: o.states };
        this.setObjectState(o.id, o.defaultState);
      } else if (o.frames) {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(key, { start: 0, end: o.frames - 1 }),
            frameRate: 1000 / o.frameMs,
            repeat: o.loop ? -1 : 0,
          });
        }
        obj = this.add.sprite(x, y, key).play(key);
      } else {
        obj = this.add.image(x, y, key);
      }
      obj.setOrigin(0, 0);
      obj.setDepth(o.layer === 'ySorted' ? o.ySortLineY : layerDepth(o.layer));

      if (o.collision) this.addSolid(o.collision);
      if (o.when === 'night') this.nightOnly.push(obj.setVisible(this.clock.isNight));

      // Click the object itself (not the empty corners of its image) to use it.
      const action = o.interact && actions[o.interact.action];
      if (action) {
        obj.setInteractive({ pixelPerfect: true, useHandCursor: true });
        obj.on('pointerdown', action);
      }
    });

    // The spec's collision block: each entry is one rect or a list of them (plus notes).
    Object.values(spec.collision).forEach((entry) => {
      if (!Array.isArray(entry)) return;
      const rects = Array.isArray(entry[0]) ? entry : [entry];
      rects.forEach((rect) => this.addSolid(rect));
    });
  }

  // Show one of an object's states (the trough 'empty' or 'full', the dung pile '0'–'2').
  // A state with no image shows nothing.
  setObjectState(objectId, state) {
    const { obj, states } = this.stateful[objectId];
    const hasImage = Boolean(states[state]);
    if (hasImage) obj.setTexture(interiorStateTex(this.id, objectId, state));
    obj.setVisible(hasImage);
  }

  // An invisible static body covering one of the spec's rectangles.
  addSolid(rect) {
    const { x, y, w, h } = boxFromRect(rect);
    const body = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    body.setVisible(false);
    this.solids.add(body);
  }

  // Where the rancher stands after a night's sleep: alongside the bed, at the outer edge
  // of the first of its "stand here to use it" zones so they are clear of the bedframe.
  bedside() {
    const bed = this.spec.objects.find((o) => o.interact && o.interact.action === 'sleep');
    const [x0, y0, x1, y1] = bed.interact.zones[0];
    const [bedX0, , bedX1] = bed.collision;
    const zoneIsRightOfBed = x0 + x1 > bedX0 + bedX1;
    return { feet: [zoneIsRightOfBed ? x1 : x0, Math.floor((y0 + y1) / 2)], facing: 'down' };
  }

  askToSleep() {
    this.scene.get('Hud').confirm('Do you want to sleep?', () => this.sleepUntilMorning());
  }

  // Fade out, let the night pass (the new day's weather comes in here), and fade back in
  // on the rancher standing by the bed — which, from any other building, means at home.
  sleepUntilMorning() {
    this.scene.get('Hud').fadeThrough(() => {
      this.clock.sleep();
      if (this.id !== HOME_INTERIOR) {
        this.scene.start('Interior', { id: HOME_INTERIOR, wake: true });
        return;
      }
      const { feet: [x, y], facing } = this.bedside();
      this.player.placeAt(x, y);
      this.player.facing = facing;
    }, FADE.sleepHoldMs);
  }

  outline({ x, y, w, h }) {
    this.add.rectangle(x + w / 2, y + h / 2, w, h).setStrokeStyle(1, 0x00ff66).setDepth(1e6);
  }

  // The room never scrolls: show all of it, centered, at the largest whole-number zoom
  // that fits the window.
  fitCamera() {
    const { width, height } = this.scale.gameSize;
    const cam = this.cameras.main;
    cam.setZoom(Math.max(1, Math.floor(Math.min(width / this.roomW, height / this.roomH))));
    cam.centerOn(this.roomW / 2, this.roomH / 2);
  }

  update(time, delta) {
    const hud = this.scene.get('Hud');
    this.player.update(delta, hud.busy);
    this.nightOnly.forEach((obj) => obj.setVisible(this.clock.isNight));
    if (hud.busy) return;

    // 2:00 am: too tired to stay up.
    if (this.clock.mustSleep) {
      this.sleepUntilMorning();
      return;
    }

    const exit = this.player.vy > 0
      && this.exits.find(({ box }) => bodyOverlaps(this.player.feet.body, box));
    if (exit) {
      hud.fadeThrough(() => this.scene.start('Ranch', { fromBuilding: exit.to.building }));
    }
  }
}
