// BootScene gets every texture ready before the ranch starts.
//
// Terrain, buildings and interiors are real pixel art, loaded from the art pack. Its JSON
// files are fetched first, then every image they list is queued — terrain and buildings
// under their manifest ids, interior rooms and furniture under their interior's id — so
// new art in the pack needs no code change here.
//
// The rancher and the signposts aren't in the pack yet, so they are still drawn in code
// (Graphics -> generateTexture) at a size that matches the pack's scale. When real
// sprites arrive, swap a bake for this.load.image(<same TEX key>, ...).

import { ASSET_MANIFEST, INTERIORS, COLORS, TEX } from '../config.js';
import { interiorKey, interiorTex } from '../world/interiors.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('manifest', ASSET_MANIFEST);
    // Files added while the loader is running join the same load, so the scene only
    // moves on to create() once the art is in.
    this.load.once('filecomplete-json-manifest', (key, type, manifest) => {
      [...manifest.terrain.tiles, ...manifest.buildings.list].forEach(({ id, file }) => {
        this.load.image(id, file);
      });
    });
    Object.entries(INTERIORS).forEach(([id, url]) => {
      const key = interiorKey(id);
      this.load.json(key, url);
      this.load.once(`filecomplete-json-${key}`, (k, type, spec) => {
        this.load.image(interiorTex(id, 'room'), spec.room.file);
        spec.objects.forEach((o) => {
          if (o.frameSize) {
            // An animation strip (the fire): equal frames side by side.
            const [frameWidth, frameHeight] = o.frameSize;
            this.load.spritesheet(interiorTex(id, o.id), o.file, { frameWidth, frameHeight });
          } else {
            this.load.image(interiorTex(id, o.id), o.file);
          }
        });
      });
    });

    this.load.on('loaderror', (file) => {
      console.error(`Could not load ${file.url} — is the game being served over HTTP?`);
    });
  }

  create() {
    this.makeSign();
    this.makePlayer();
    this.makeShadow();

    // The HUD runs for the whole game, on top of whichever world scene is showing.
    this.scene.launch('Hud');
    this.scene.start('Ranch');
  }

  // Run draw commands on a throwaway Graphics, bake to a texture, dispose.
  bake(key, width, height, draw) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  // A small wooden signpost (post + board). The label text is rendered separately in the
  // scene so it stays crisp.
  makeSign() {
    this.bake(TEX.sign, 20, 22, (g) => {
      g.fillStyle(COLORS.woodDark, 1);
      g.fillRect(9, 11, 3, 11); // post
      g.fillStyle(COLORS.woodSeam, 1);
      g.fillRect(1, 2, 18, 10); // board outline
      g.fillStyle(COLORS.wood, 1);
      g.fillRect(2, 3, 16, 8); // board
      g.fillStyle(COLORS.woodLight, 1);
      g.fillRect(2, 3, 16, 2); // top highlight
      g.fillStyle(COLORS.woodSeam, 1);
      g.fillRect(5, 6, 10, 1); // "writing"
      g.fillRect(5, 8, 7, 1);
    });
  }

  // A soft oval under the rancher's feet. It stays on the ground during a hop, which is
  // what makes the hop read as height.
  makeShadow() {
    this.bake(TEX.shadow, 10, 4, (g) => {
      g.fillStyle(0x000000, 1);
      g.fillRect(2, 0, 6, 1);
      g.fillRect(0, 1, 10, 2);
      g.fillRect(2, 3, 6, 1);
    });
  }

  // The rancher (14x22). Origin is set to the feet when placed.
  makePlayer() {
    this.bake(TEX.player, 14, 22, (g) => {
      // Legs.
      g.fillStyle(COLORS.pants, 1);
      g.fillRect(3, 17, 8, 5);
      g.fillStyle(COLORS.pantsDark, 1);
      g.fillRect(6, 17, 2, 5); // inseam shadow

      // Shirt (right side shadowed).
      g.fillStyle(COLORS.shirt, 1);
      g.fillRect(2, 11, 10, 6);
      g.fillStyle(COLORS.shirtDark, 1);
      g.fillRect(8, 11, 4, 6);

      // Head.
      g.fillStyle(COLORS.skin, 1);
      g.fillRect(3, 5, 8, 6);
      g.fillStyle(COLORS.skinShade, 1);
      g.fillRect(9, 5, 2, 6); // cheek shadow
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(5, 7, 1, 2); // eyes
      g.fillRect(8, 7, 1, 2);

      // Hat.
      g.fillStyle(COLORS.hat, 1);
      g.fillRect(3, 0, 8, 3); // crown
      g.fillRect(1, 3, 12, 2); // brim
      g.fillStyle(COLORS.hatDark, 1);
      g.fillRect(1, 4, 12, 1); // brim underside shadow
    });
  }
}
