// BootScene is the single home for all placeholder art. Instead of loading image files,
// it draws each tile and sprite with a Graphics object and bakes it into a texture via
// generateTexture(). When real pixel-art assets arrive later, this is the one file that
// changes: swap the draw calls for this.load.spritesheet(...) and everything downstream
// keeps working because it references textures by the same keys.

import { TILE, COLORS, TEX } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeGrass(TEX.grass, COLORS.grass, COLORS.grassAlt);
    this.makeGrass(TEX.grassAlt, COLORS.grassAlt, COLORS.grass);
    this.makeDirt(TEX.dirt);
    this.makeWater(TEX.water);
    this.makeFence(TEX.fence);
    this.makeBarn(TEX.barn);
    this.makePlayer(TEX.player);

    this.scene.start('Ranch');
  }

  // Small helper: run draw commands on a throwaway Graphics, bake to a texture, dispose.
  bake(key, width, height, draw) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  makeGrass(key, base, fleck) {
    this.bake(key, TILE, TILE, (g) => {
      g.fillStyle(base, 1);
      g.fillRect(0, 0, TILE, TILE);
      // A few scattered flecks give the ground a bit of texture without a real tileset.
      g.fillStyle(fleck, 1);
      g.fillRect(6, 8, 3, 3);
      g.fillRect(20, 14, 3, 3);
      g.fillRect(12, 24, 2, 2);
      g.fillRect(26, 5, 2, 2);
    });
  }

  makeDirt(key) {
    this.bake(key, TILE, TILE, (g) => {
      g.fillStyle(COLORS.dirt, 1);
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle(COLORS.dirtAlt, 1);
      g.fillRect(4, 6, 5, 4);
      g.fillRect(18, 12, 6, 5);
      g.fillRect(10, 22, 5, 4);
    });
  }

  makeWater(key) {
    this.bake(key, TILE, TILE, (g) => {
      g.fillStyle(COLORS.water, 1);
      g.fillRect(0, 0, TILE, TILE);
      // Lighter ripples.
      g.fillStyle(COLORS.waterAlt, 1);
      g.fillRect(4, 10, 10, 2);
      g.fillRect(18, 20, 9, 2);
    });
  }

  makeFence(key) {
    this.bake(key, TILE, TILE, (g) => {
      // Grass shows through beneath the fence so borders blend with the ground.
      g.fillStyle(COLORS.grass, 1);
      g.fillRect(0, 0, TILE, TILE);
      // Two posts and a rail.
      g.fillStyle(COLORS.fence, 1);
      g.fillRect(5, 6, 5, TILE - 8);
      g.fillRect(TILE - 10, 6, 5, TILE - 8);
      g.fillRect(0, 12, TILE, 5);
      // Light highlight on the tops of the posts.
      g.fillStyle(COLORS.fenceLight, 1);
      g.fillRect(5, 6, 5, 2);
      g.fillRect(TILE - 10, 6, 5, 2);
    });
  }

  makeBarn(key) {
    this.bake(key, TILE, TILE, (g) => {
      // Red barn wall with plank lines and a roof stripe along the top, so a block of
      // these tiles reads as one building.
      g.fillStyle(COLORS.barnWall, 1);
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle(COLORS.barnRoof, 1);
      g.fillRect(0, 0, TILE, 6);
      // Vertical plank seams.
      g.fillStyle(COLORS.barnDoor, 1);
      g.fillRect(10, 6, 2, TILE - 6);
      g.fillRect(21, 6, 2, TILE - 6);
    });
  }

  makePlayer(key) {
    // A small rancher: brimmed hat, face, shirt, legs. Drawn facing the camera; we keep
    // it centered so flipping/tinting for facing direction is easy later.
    const w = 20;
    const h = 28;
    this.bake(key, w, h, (g) => {
      // Legs.
      g.fillStyle(0x3a3f4b, 1);
      g.fillRect(4, 20, 5, 8);
      g.fillRect(11, 20, 5, 8);
      // Shirt / torso.
      g.fillStyle(COLORS.playerShirt, 1);
      g.fillRect(3, 12, 14, 9);
      // Head / face.
      g.fillStyle(COLORS.player, 1);
      g.fillRect(5, 4, 10, 8);
      // Hat brim + crown.
      g.fillStyle(COLORS.playerHat, 1);
      g.fillRect(2, 3, 16, 3);
      g.fillRect(6, 0, 8, 4);
    });
  }
}
