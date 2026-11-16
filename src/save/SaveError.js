// Something went wrong saving or loading. `kind` says what, so the menu can explain it in
// the player's words:
//   'blocked'  the browser won't let the game use its storage
//   'full'     the browser's storage has no room left
//   'failed'   what was written is not what the game can read back
//   'empty'    there is nothing in the slot
//   'damaged'  the slot holds something this game can't make sense of
//   'newer'    the slot was saved by a newer version of the game
// `cause` is the underlying error, if there was one, for the console.

export default class SaveError extends Error {
  constructor(kind, cause) {
    super(`save: ${kind}`);
    this.name = 'SaveError';
    this.kind = kind;
    this.cause = cause;
  }
}
