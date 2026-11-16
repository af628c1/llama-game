// Key presses for the UI. `onPress` runs `act` once for each real press of any of the
// named keys (Phaser's names: 'ENTER', 'ESC', 'UP', 'W'...).
//
// Two things are filtered out. One is the stream of repeats a held key sends: an Enter
// held a moment too long must not answer the next question as well. The other is a press
// Phaser has already reported: each time a key event arrives it goes through the frame's
// whole list of them again, so with three in one frame a press can be reported twice —
// which would say Yes to a question the player never got to see.

export function onPress(scene, names, act) {
  const handled = new WeakSet();
  names.forEach((name) => {
    scene.input.keyboard.on(`keydown-${name}`, (event) => {
      if (event.repeat || handled.has(event)) return;
      handled.add(event);
      act();
    });
  });
}
