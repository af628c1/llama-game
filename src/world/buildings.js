// Turns the art pack's building entries (assets/manifest.json) into what the scene needs
// to place them: size, depth-sort line, and solid rectangles. All rectangles are
// [x1, y1, x2, y2] in image pixels, origin at the PNG's top-left.
//
// The manifest is the source of truth; TUNING holds only in-engine adjustments (the pack
// calls its collision numbers "starting points — tune in-engine"), kept here so a fresh
// art drop can overwrite the manifest without losing them.

const TUNING = {
  run_in_shelter: {
    // Left post, right post, back wall. The posts are the manifest's. In the art the back
    // wall's face and the hay bales run down to y≈41 and the straw floor is the strip
    // below; the manifest's back strip ends at y21, which lets characters walk up the wall
    // and over the bales, so the back is extended down to the wall's base.
    solidsPx: [
      [8, 14, 18, 49],
      [54, 14, 64, 49],
      [8, 14, 64, 42],
    ],
    // The shelter is one PNG, but characters need to stand *inside* it. So it is drawn
    // twice: the whole sprite as a backdrop sorted at `backSortY` (the wall's base, so
    // anyone on the straw floor is in front of it), plus these cut-outs — the roof, then
    // the two front posts — drawn over them at the normal sort line.
    backSortY: 42,
    frontPx: [
      [0, 0, 72, 18],
      [8, 18, 17, 50],
      [56, 18, 64, 50],
    ],
  },
};

export function buildingSpecs(manifest) {
  const specs = {};
  manifest.buildings.list.forEach((b) => {
    const { collision } = b;
    specs[b.id] = {
      id: b.id,
      width: b.size[0],
      height: b.size[1],
      sortY: b.ySortLineY,
      solidsPx: collision.rectsPx || [collision.rectPx],
      ...TUNING[b.id],
    };
  });
  return specs;
}
