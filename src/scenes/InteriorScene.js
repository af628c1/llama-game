// The inside of a building: one fixed room, centered on screen, built entirely from the
// art pack's interior spec (assets/<name>_interior.json) — which images to draw and in
// what order, what is solid, where the rancher arrives and where the way out is. The
// scene is started with { id }, an entry of INTERIORS in config.js.
//
// Room pixels are world pixels here: the room's top-left is the world's origin.

import { INTERIOR_CHARACTER, PLAYER_SPEED } from '../config.js';
import { interiorKey, interiorTex } from '../world/interiors.js';
import { boxFromRect, bodyOverlaps } from '../world/rects.js';
import Player from '../entities/Player.js';

// There is no day/night cycle yet. Objects marked `when: 'night'` (the window's night
// view) wait for one.
const TIME_OF_DAY = 'day';

export default class InteriorScene extends Phaser.Scene {
  constructor() {
    super('Interior');
  }

  create({ id }) {
    const spec = this.cache.json.get(interiorKey(id));
    [this.roomW, this.roomH] = spec.room.size;

    this.cameras.main.setBackgroundColor(spec.art.sceneClearColor);
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, this.roomW, this.roomH);
    this.solids = this.physics.add.staticGroup();

    this.buildRoom(id, spec);

    // Arrive just inside the door.
    const { feet: [x, y], facing } = spec.spawns.fromFarm;
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

  // Draw the room in the spec's layer order. Every layer before 'ySorted' sits behind all
  // characters; ySorted furniture is depth-sorted against the rancher's feet, so the
  // rancher can walk behind the table and in front of it.
  buildRoom(id, spec) {
    const { drawOrder } = spec;
    const layerDepth = (layer) => drawOrder.indexOf(layer) - drawOrder.length; // all < 0

    this.add.image(0, 0, interiorTex(id, 'room')).setOrigin(0, 0).setDepth(layerDepth('base'));

    spec.objects.forEach((o) => {
      if (o.when && o.when !== TIME_OF_DAY) return;

      const key = interiorTex(id, o.id);
      const [x, y] = o.pos;
      let obj;
      if (o.frames) {
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
    });

    // The spec's collision block: each entry is one rect or a list of them (plus notes).
    Object.values(spec.collision).forEach((entry) => {
      if (!Array.isArray(entry)) return;
      const rects = Array.isArray(entry[0]) ? entry : [entry];
      rects.forEach((rect) => this.addSolid(rect));
    });
  }

  // An invisible static body covering one of the spec's rectangles.
  addSolid(rect) {
    const { x, y, w, h } = boxFromRect(rect);
    const body = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    body.setVisible(false);
    this.solids.add(body);
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
    this.player.update(delta, hud.covered);
    if (hud.covered) return;

    const exit = this.player.vy > 0
      && this.exits.find(({ box }) => bodyOverlaps(this.player.feet.body, box));
    if (exit) {
      hud.fadeThrough(() => this.scene.start('Ranch', { fromBuilding: exit.to.building }));
    }
  }
}
