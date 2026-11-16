// The genetics system's random numbers. Everything random in src/genetics/ draws from an
// Rng that is handed to it — never from Math.random — so that a seed fixes everything that
// follows, and a saved game picks up the very same run of rolls where it left off.
//
// The generator is sfc32: small, fast, and good enough to simulate inheritance over many
// generations. Its whole state is four 32-bit numbers, which is what save() returns.

export default class Rng {
  // `seed` is a whole number, or the state array of an earlier save().
  constructor(seed = 1) {
    if (Array.isArray(seed)) {
      [this.a, this.b, this.c, this.d] = seed;
      return;
    }
    // Spread the seed over the four words (splitmix32), then run the generator in.
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    for (let i = 0; i < 16; i++) this.next();
  }

  save() {
    return [this.a, this.b, this.c, this.d];
  }

  // A number in [0, 1).
  next() {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // A whole number from 0 up to, but not including, n.
  int(n) {
    return Math.floor(this.next() * n);
  }

  // A number in [lo, hi).
  between(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  pick(list) {
    return list[this.int(list.length)];
  }

  // A normally distributed number (Box–Muller). Always uses exactly two draws, so there is
  // no spare value to remember between calls — the four words stay the whole state.
  normal(mean = 0, sd = 1) {
    const u = 1 - this.next(); // (0, 1]: never log(0)
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // The list in a random order (a new list).
  shuffle(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
