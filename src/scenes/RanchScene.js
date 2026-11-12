// The playable world. It lays the ground out from the tile grid, places the buildings as
// depth-sorted sprites with the collision the art pack describes, wires up the doors that
// lead indoors, adds signposts, and follows the rancher with an integer-zoomed camera.
// This is where future systems (alpacas, chores, day/night) will plug in.

import { TILE, TEX, INTERIORS, HOME_INTERIOR, FADE, pickZoom } from '../config.js';
import {
  GRID, LEGEND, ROWS, COLS, WORLD_WIDTH, WORLD_HEIGHT, BUILDINGS, SIGNS, SPAWN,
} from '../world/ranchMap.js';
import { buildingSpecs } from '../world/buildings.js';
import { interiorKey } from '../world/interiors.js';
import { boxFromRect, bodyOverlaps } from '../world/rects.js';
import Player from '../entities/Player.js';

// Sign label size in world pixels (it is rendered at screen resolution — see applyZoom).
const LABEL_FONT_PX = 6;

export default class RanchScene extends Phaser.Scene {
  constructor() {
    super('Ranch');
  }

  // `fromBuilding` is set when the rancher has just walked out of that building's door.
  create({ fromBuilding } = {}) {
    const manifest = this.cache.json.get('manifest');

    // Everything the rancher bumps into: water tiles and building walls.
    this.solids = this.physics.add.staticGroup();

    this.buildGround(manifest);
    this.buildBuildings(manifest);
    this.buildDoors();
    this.buildSigns();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Step out of the door just left, or start at the ranch's spawn tile.
    const door = this.doors.find((d) => d.building === fromBuilding);
    if (door) {
      this.player = new Player(this, door.exit.x, door.exit.y, { facing: door.exitFacing });
    } else {
      const [col, row] = SPAWN.tile;
      this.player = new Player(this, (col + 0.5) * TILE, (row + 0.5) * TILE);
    }
    this.physics.add.collider(this.player.feet, this.solids);

    // The camera follows the feet, so it doesn't bob when the rancher hops.
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player.feet, true, 0.1, 0.1);
    this.cameras.main.roundPixels = true;

    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom, this));
  }

  // An invisible static body, given by its top-left corner and size in world pixels.
  addSolid(left, top, width, height) {
    const body = this.add.rectangle(left + width / 2, top + height / 2, width, height);
    body.setVisible(false);
    this.solids.add(body);
  }

  // Stamp the whole ground into one texture (the tiles are seamless, so they simply
  // butt together), and block every non-walkable tile.
  buildGround(manifest) {
    const walkable = {};
    manifest.terrain.tiles.forEach((t) => { walkable[t.id] = t.walkable; });

    const rt = this.add.renderTexture(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setOrigin(0, 0);
    rt.setDepth(-1); // below everything that is y-sorted

    rt.beginDraw();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        rt.batchDrawFrame(LEGEND[GRID[r][c]], undefined, c * TILE, r * TILE);
      }
    }
    rt.endDraw();

    // One body per horizontal run of blocked tiles rather than one per tile.
    for (let r = 0; r < ROWS; r++) {
      let runStart = -1;
      for (let c = 0; c <= COLS; c++) {
        const blocked = c < COLS && !walkable[LEGEND[GRID[r][c]]];
        if (blocked && runStart < 0) runStart = c;
        if (!blocked && runStart >= 0) {
          this.addSolid(runStart * TILE, r * TILE, (c - runStart) * TILE, TILE);
          runStart = -1;
        }
      }
    }
  }

  // Place each building with its bottom-center on the bottom-center of its anchor tile.
  // Depth is the building's y-sort line in world space, so the rancher (whose depth is
  // their feet) passes behind it when standing above that line and in front when below.
  buildBuildings(manifest) {
    const specs = buildingSpecs(manifest);
    this.placed = {}; // building id -> where its sprite's top-left ended up, and its scale

    BUILDINGS.forEach(({ id, anchorTile: [col, row] }) => {
      const spec = specs[id];
      const left = Math.round((col + 0.5) * TILE - spec.width / 2);
      const top = (row + 1) * TILE - spec.height;
      this.placed[id] = { left, top, scale: spec.scale };

      const draw = (sortY) => this.add.image(left, top, id)
        .setOrigin(0, 0)
        .setScale(spec.scale)
        .setDepth(top + sortY);

      if (spec.frontPx) {
        // Walk-in building: a backdrop that characters inside stand in front of, with
        // the roof and posts drawn again on top of them.
        draw(spec.backSortY);
        spec.frontPx.forEach(([x0, y0, x1, y1]) => {
          draw(spec.sortY).setCrop(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        });
      } else {
        draw(spec.sortY);
      }

      spec.solids.forEach(({ x, y, w, h }) => this.addSolid(left + x, top + y, w, h));
    });
  }

  // Doors into interiors. Each interior's spec says which building it belongs to, where
  // on that building's PNG the doorway trigger is, and where the rancher reappears on the
  // way back out — all in the PNG's pixels, converted here to the placed building.
  buildDoors() {
    this.doors = [];
    Object.keys(INTERIORS).forEach((interior) => {
      const link = this.cache.json.get(interiorKey(interior)).exteriorLink;
      const at = this.placed[link.building];
      if (!at) return; // that building isn't on this map

      const [exitX, exitY] = link.exitSpawnFeet;
      const door = {
        interior,
        building: link.building,
        trigger: boxFromRect(link.entryTrigger, at.scale, at.left, at.top),
        exit: { x: at.left + exitX * at.scale, y: at.top + exitY * at.scale },
        exitFacing: link.exitFacing,
      };
      this.doors.push(door);

      if (this.physics.world.drawDebug) {
        const { x, y, w, h } = door.trigger;
        this.add.rectangle(x + w / 2, y + h / 2, w, h).setStrokeStyle(1, 0x00ff66).setDepth(1e6);
      }
    });
  }

  // Wooden signposts at the road exits, each with a floating label.
  buildSigns() {
    this.labels = SIGNS.map(({ tile: [col, row], label }) => {
      const x = (col + 0.5) * TILE;
      const y = (row + 1) * TILE - 4;
      this.add.image(x, y, TEX.sign).setOrigin(0.5, 1).setDepth(y);

      const text = this.add.text(x, y - 25, label, {
        fontFamily: 'monospace',
        color: '#3b2a17',
        backgroundColor: '#f3ead6',
      });
      text.setOrigin(0.5, 1);
      text.setDepth(y + 1);
      return text;
    });
  }

  // Keep the camera on a whole-number zoom so the pixel art stays crisp. Text is the one
  // thing that shouldn't be blown up as chunky pixels, so labels are typeset at screen
  // resolution and scaled back down by the zoom.
  applyZoom() {
    const { width, height } = this.scale.gameSize;
    const zoom = pickZoom(width, height, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(zoom);

    this.labels.forEach((text) => {
      text.setFontSize(LABEL_FONT_PX * zoom);
      text.setPadding(3 * zoom, 2 * zoom);
      text.setScale(1 / zoom);
    });
  }

  update(time, delta) {
    const hud = this.scene.get('Hud');
    this.player.update(delta, hud.busy);
    if (hud.busy) return;

    // 2:00 am: the rancher passes out, and wakes up at home the next morning.
    const clock = this.registry.get('time');
    if (clock.mustSleep) {
      hud.fadeThrough(() => {
        clock.sleep();
        this.scene.start('Interior', { id: HOME_INTERIOR, wake: true });
      }, FADE.sleepHoldMs);
      return;
    }

    // Walking up into a doorway goes inside.
    const door = this.player.vy < 0
      && this.doors.find((d) => bodyOverlaps(this.player.feet.body, d.trigger));
    if (door) {
      hud.fadeThrough(() => this.scene.start('Interior', { id: door.interior }));
    }
  }
}
