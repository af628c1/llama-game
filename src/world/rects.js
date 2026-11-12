// The art pack writes rectangles as [x0, y0, x1, y1] in image pixels with both corners
// inclusive. boxFromRect turns one into a {x, y, w, h} box in world pixels, given the
// scale the image is drawn at and where its top-left sits. Edges snap to whole pixels.

export function boxFromRect([x0, y0, x1, y1], scale = 1, originX = 0, originY = 0) {
  const left = Math.round(originX + x0 * scale);
  const top = Math.round(originY + y0 * scale);
  const right = Math.round(originX + (x1 + 1) * scale);
  const bottom = Math.round(originY + (y1 + 1) * scale);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// Does an Arcade Physics body overlap a box? Merely touching edges doesn't count.
export function bodyOverlaps(body, box) {
  return body.right > box.x && body.left < box.x + box.w
    && body.bottom > box.y && body.top < box.y + box.h;
}
