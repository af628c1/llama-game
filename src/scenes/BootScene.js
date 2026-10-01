// BootScene is the single home for all hand-drawn art. It draws every tile and sprite with
// a Graphics object and bakes it into a texture via generateTexture(). No image files are
// loaded, so the game stays self-contained — and when real pixel-art assets arrive later,
// this is the one file that changes: swap the draw calls for this.load.image(...) using
// the same TEX keys and everything downstream keeps working.
//
// Shared conventions that make the separate sprites read as one scene:
//   - light comes from the top-left (top/left faces lighter, bottom/right in shadow)
//   - buildings are drawn front-facing with origin at their base, grounded by a shadow

import { TILE, COLORS, TEX } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeGrassTiles();
    this.makeGrassDetails();
    this.makePath();
    this.makeEdges();
    this.makeFarmhouse();
    this.makeBarn();
    this.makeSign();
    this.makePlayer();

    this.scene.start('Ranch');
  }

  // Run draw commands on a throwaway Graphics, bake to a texture, dispose.
  bake(key, width, height, draw) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  // --- Ground ---------------------------------------------------------------

  // Four grass variants: same family of greens with low-contrast speckle noise, so a field
  // of them reads organic and lush instead of a hard checkerboard.
  makeGrassTiles() {
    COLORS.grass.forEach((base, i) => {
      this.bake(TEX.grass[i], TILE, TILE, (g) => {
        g.fillStyle(base, 1);
        g.fillRect(0, 0, TILE, TILE);
        // Darker and lighter flecks scattered subtly across the tile.
        for (let n = 0; n < 24; n++) {
          const dark = Math.random() < 0.5;
          g.fillStyle(dark ? COLORS.grassShadow : COLORS.grassHighlight, dark ? 0.35 : 0.3);
          const x = Math.floor(Math.random() * TILE);
          const y = Math.floor(Math.random() * TILE);
          g.fillRect(x, y, 1, Math.random() < 0.4 ? 2 : 1);
        }
        // A couple of tiny upright blades for texture.
        g.fillStyle(COLORS.grassHighlight, 0.5);
        for (let n = 0; n < 3; n++) {
          const x = 3 + Math.floor(Math.random() * (TILE - 6));
          const y = 4 + Math.floor(Math.random() * (TILE - 8));
          g.fillRect(x, y, 1, 3);
        }
      });
    });
  }

  // Transparent overlays sprinkled sparsely on grass: clover patch, little flowers, pebbles.
  makeGrassDetails() {
    // Clover: a cluster of small dark-green leaves.
    this.bake(TEX.grassDetails[0], TILE, TILE, (g) => {
      g.fillStyle(COLORS.clover, 1);
      [[12, 16], [17, 14], [15, 20], [20, 18], [10, 21]].forEach(([x, y]) => g.fillCircle(x, y, 2));
    });
    // Flowers: a few tiny blossoms with colored petals and a center dot.
    this.bake(TEX.grassDetails[1], TILE, TILE, (g) => {
      const spots = [
        [10, 12, COLORS.flowerWhite],
        [19, 16, COLORS.flowerPink],
        [14, 21, COLORS.flowerYellow],
      ];
      spots.forEach(([x, y, c]) => {
        g.fillStyle(c, 1);
        g.fillCircle(x, y, 2);
        g.fillStyle(COLORS.flowerYellow, 1);
        g.fillRect(x, y, 1, 1);
        g.fillStyle(COLORS.clover, 1);
        g.fillRect(x, y + 2, 1, 2); // stem
      });
    });
    // Pebbles: a couple of gray stones with a top highlight.
    this.bake(TEX.grassDetails[2], TILE, TILE, (g) => {
      [[13, 18, 3], [19, 20, 2]].forEach(([x, y, r]) => {
        g.fillStyle(COLORS.pebble, 1);
        g.fillCircle(x, y, r);
        g.fillStyle(COLORS.grassHighlight, 0.5);
        g.fillCircle(x - 1, y - 1, 1);
      });
    });
  }

  // Warm dirt path: tan base with pebble/speckle detail.
  makePath() {
    this.bake(TEX.path, TILE, TILE, (g) => {
      g.fillStyle(COLORS.path, 1);
      g.fillRect(0, 0, TILE, TILE);
      for (let n = 0; n < 28; n++) {
        const light = Math.random() < 0.5;
        g.fillStyle(light ? COLORS.pathLight : COLORS.pathDark, 0.5);
        g.fillRect(Math.floor(Math.random() * TILE), Math.floor(Math.random() * TILE), 2, 1);
      }
      // A few embedded pebbles.
      g.fillStyle(COLORS.pathPebble, 0.8);
      for (let n = 0; n < 4; n++) {
        g.fillCircle(2 + Math.random() * (TILE - 4), 2 + Math.random() * (TILE - 4), 1.5);
      }
    });
  }

  // Grass fringe that overhangs a path tile on the side bordering grass. Drawn as a band of
  // rounded tufts so the road has soft, organic edges rather than hard squares.
  makeEdges() {
    const sides = ['top', 'bottom', 'left', 'right'];
    sides.forEach((side) => {
      this.bake(TEX.edge[side], TILE, TILE, (g) => this.drawTufts(g, side));
    });
  }

  drawTufts(g, side) {
    const green = COLORS.grass[1];
    const strip = 3; // solid connector along the very edge
    const draw = (cx, cy, r) => {
      g.fillStyle(green, 1);
      g.fillCircle(cx, cy, r);
      // top-left catch-light + a darker underside for a little roundness
      g.fillStyle(COLORS.grassHighlight, 0.5);
      g.fillCircle(cx - r * 0.3, cy - r * 0.3, Math.max(1, r * 0.4));
    };
    if (side === 'top' || side === 'bottom') {
      const edgeY = side === 'top' ? 0 : TILE - strip;
      const humpY = side === 'top' ? strip + 1 : TILE - strip - 1;
      g.fillStyle(green, 1);
      g.fillRect(0, edgeY, TILE, strip);
      for (let x = 1; x <= TILE; x += 4) draw(x, humpY, 3 + Math.random() * 2.5);
    } else {
      const edgeX = side === 'left' ? 0 : TILE - strip;
      const humpX = side === 'left' ? strip + 1 : TILE - strip - 1;
      g.fillStyle(green, 1);
      g.fillRect(edgeX, 0, strip, TILE);
      for (let y = 1; y <= TILE; y += 4) draw(humpX, y, 3 + Math.random() * 2.5);
    }
  }

  // --- Buildings ------------------------------------------------------------

  // Log cabin farmhouse with a green gabled roof, drawn front-facing. Origin will be set to
  // bottom-center when placed, so (w/2, h) is where it meets the ground.
  makeFarmhouse() {
    const W = 128;
    const H = 150;
    this.bake(TEX.farmhouse, W, H, (g) => {
      const wallTop = 82;
      const wallBottom = 146;
      const wallL = 16;
      const wallR = 112;

      // Walls: stacked logs (horizontal bands with a seam + under-highlight for roundness).
      g.fillStyle(COLORS.logMid, 1);
      g.fillRect(wallL, wallTop, wallR - wallL, wallBottom - wallTop);
      for (let y = wallTop + 2; y < wallBottom; y += 10) {
        g.fillStyle(COLORS.logDark, 1);
        g.fillRect(wallL, y, wallR - wallL, 2);
        g.fillStyle(COLORS.logLight, 0.6);
        g.fillRect(wallL, y + 2, wallR - wallL, 2);
      }
      // Corner posts.
      g.fillStyle(COLORS.logLight, 1);
      g.fillRect(wallL, wallTop, 6, wallBottom - wallTop);
      g.fillStyle(COLORS.logDark, 1);
      g.fillRect(wallR - 6, wallTop, 6, wallBottom - wallTop);

      // Chimney (behind/above roof on the right), drawn first so the roof overlaps its base.
      g.fillStyle(COLORS.chimney, 1);
      g.fillRect(90, 24, 14, 40);
      g.fillStyle(COLORS.chimneyDark, 1);
      for (let y = 28; y < 60; y += 8) g.fillRect(90, y, 14, 2);
      g.fillStyle(COLORS.chimney, 1);
      g.fillRect(88, 24, 18, 4); // cap

      // Gabled roof: a big triangle, left slope lit, right slope shadowed, with an eave.
      const apex = { x: 64, y: 14 };
      const left = { x: 2, y: wallTop };
      const right = { x: 126, y: wallTop };
      g.fillStyle(COLORS.roofGreen, 1);
      g.fillTriangle(apex.x, apex.y, left.x, left.y, right.x, right.y);
      g.fillStyle(COLORS.roofGreenHi, 1);
      g.fillTriangle(apex.x, apex.y, left.x, left.y, apex.x, left.y);
      g.fillStyle(COLORS.roofGreenLo, 1);
      g.fillTriangle(apex.x, apex.y, right.x, right.y, apex.x, right.y);
      // Eave shadow line under the roof.
      g.fillStyle(COLORS.roofGreenLo, 1);
      g.fillRect(wallL - 4, wallTop, (wallR - wallL) + 8, 3);

      // Door (to the ground), with frame and knob.
      g.fillStyle(COLORS.woodDark, 1);
      g.fillRect(52, 100, 24, wallBottom - 100);
      g.fillStyle(COLORS.door, 1);
      g.fillRect(54, 102, 20, wallBottom - 102);
      g.fillStyle(COLORS.windowLit, 1);
      g.fillCircle(70, 124, 1.5); // knob

      // Two warm-lit windows flanking the door.
      [[26, 96], [86, 96]].forEach(([wx, wy]) => {
        g.fillStyle(COLORS.windowFrame, 1);
        g.fillRect(wx, wy, 20, 22);
        g.fillStyle(COLORS.windowLit, 1);
        g.fillRect(wx + 2, wy + 2, 16, 18);
        g.fillStyle(COLORS.windowFrame, 1);
        g.fillRect(wx + 9, wy + 2, 2, 18); // mullions
        g.fillRect(wx + 2, wy + 10, 16, 2);
      });
    });
  }

  // Wooden barn with a gambrel roof, plank walls, big cross-braced doors, and a hayloft.
  makeBarn() {
    const W = 160;
    const H = 136;
    this.bake(TEX.barn, W, H, (g) => {
      const wallTop = 60;
      const wallBottom = 130;
      const wallL = 14;
      const wallR = 146;

      // Walls with vertical planks.
      g.fillStyle(COLORS.barnWall, 1);
      g.fillRect(wallL, wallTop, wallR - wallL, wallBottom - wallTop);
      for (let x = wallL + 6; x < wallR; x += 12) {
        g.fillStyle(COLORS.barnPlank, 0.8);
        g.fillRect(x, wallTop, 2, wallBottom - wallTop);
      }
      g.fillStyle(COLORS.barnWallDark, 1);
      g.fillRect(wallL, wallBottom - 4, wallR - wallL, 4); // ground shadow on wall

      // Gambrel roof silhouette (classic barn): two slopes per side.
      const roof = [
        { x: 6, y: wallTop },
        { x: 30, y: 34 },
        { x: 80, y: 12 },
        { x: 130, y: 34 },
        { x: 154, y: wallTop },
      ];
      g.fillStyle(COLORS.barnRoof, 1);
      g.fillPoints(roof, true);
      // Light the left half of the roof.
      g.fillStyle(COLORS.barnRoofHi, 1);
      g.fillPoints([{ x: 6, y: wallTop }, { x: 30, y: 34 }, { x: 80, y: 12 }, { x: 80, y: wallTop }], true);
      // White trim along the eave.
      g.fillStyle(COLORS.barnTrim, 1);
      g.fillRect(wallL - 4, wallTop - 3, (wallR - wallL) + 8, 4);

      // Hayloft door in the gable, with a little pulley beam.
      g.fillStyle(COLORS.barnWallDark, 1);
      g.fillRect(68, 30, 24, 24);
      g.fillStyle(COLORS.barnDoor, 1);
      g.fillRect(70, 32, 20, 20);
      g.fillStyle(COLORS.barnPlank, 1);
      g.fillRect(70, 41, 20, 2);
      g.fillStyle(COLORS.woodDark, 1);
      g.fillRect(78, 20, 4, 12); // beam

      // Big double doors with frame and X cross-braces.
      const dL = 50;
      const dR = 110;
      const dT = 74;
      g.fillStyle(COLORS.barnTrim, 1);
      g.fillRect(dL - 4, dT - 4, dR - dL + 8, wallBottom - dT + 4); // frame
      g.fillStyle(COLORS.barnDoor, 1);
      g.fillRect(dL, dT, dR - dL, wallBottom - dT);
      g.fillStyle(COLORS.barnPlank, 1);
      g.fillRect(dL + (dR - dL) / 2 - 1, dT, 2, wallBottom - dT); // center split
      // Cross-braces (one X per door leaf).
      g.lineStyle(3, COLORS.barnPlank, 1);
      const brace = (x0, x1) => {
        g.beginPath();
        g.moveTo(x0, dT + 2); g.lineTo(x1, wallBottom - 2);
        g.moveTo(x1, dT + 2); g.lineTo(x0, wallBottom - 2);
        g.strokePath();
      };
      brace(dL + 3, dL + (dR - dL) / 2 - 3);
      brace(dL + (dR - dL) / 2 + 3, dR - 3);
    });
  }

  // A small wooden signpost (post + board). The label text is rendered separately in the
  // scene so it stays crisp.
  makeSign() {
    const W = 56;
    const H = 52;
    this.bake(TEX.sign, W, H, (g) => {
      g.fillStyle(COLORS.woodDark, 1);
      g.fillRect(25, 22, 6, 30); // post
      g.fillStyle(COLORS.wood, 1);
      g.fillRect(4, 8, 48, 22); // board
      g.fillStyle(COLORS.woodDark, 1);
      g.fillRect(4, 8, 48, 2);
      g.fillRect(4, 28, 48, 2);
      g.fillStyle(COLORS.logLight, 0.5);
      g.fillRect(6, 11, 44, 3); // top highlight
    });
  }

  // --- Player ---------------------------------------------------------------

  makePlayer() {
    const W = 20;
    const H = 28;
    this.bake(TEX.player, W, H, (g) => {
      // Legs.
      g.fillStyle(COLORS.pants, 1);
      g.fillRect(4, 20, 5, 8);
      g.fillRect(11, 20, 5, 8);
      g.fillStyle(0x2c303a, 1);
      g.fillRect(9, 20, 2, 8); // inseam shadow

      // Shirt (right side shadowed).
      g.fillStyle(COLORS.shirt, 1);
      g.fillRect(3, 12, 14, 9);
      g.fillStyle(COLORS.shirtDark, 1);
      g.fillRect(11, 12, 6, 9);

      // Head.
      g.fillStyle(COLORS.skin, 1);
      g.fillRect(5, 4, 10, 8);
      g.fillStyle(0xd9ad84, 1);
      g.fillRect(12, 4, 3, 8); // cheek shadow
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(7, 8, 1, 1); // eyes
      g.fillRect(11, 8, 1, 1);

      // Hat.
      g.fillStyle(COLORS.hat, 1);
      g.fillRect(2, 3, 16, 3); // brim
      g.fillRect(6, 0, 8, 4); // crown
      g.fillStyle(COLORS.hatDark, 1);
      g.fillRect(2, 5, 16, 1); // brim underside shadow
    });
  }
}
