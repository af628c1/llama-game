// A minimal event emitter. The genetics system says what happened by emitting events —
// it never calls UI code — and the game listens for the ones it cares about.
//
// The events, and what comes with each (`day` is the absolute game day):
//   conceived           { damId, sireId, day, dueDay }   hidden from the player: see below
//   pregnancy_revealed  { damId, sireId, day }
//   miscarriage         { damId, sireId, day, known }    `known`: had the player found out?
//   cria_born           { criaId, damId, sireId, day }
//   cria_died           { alpacaId, day, cause }         'defect:<id>', 'inbreeding_weakness', 'weak_cria'
//   defect_revealed     { alpacaId, defect, day }
//   carrier_proven      { alpacaId, defect, day, offspringId }
//   deafness_detected   { alpacaId, day }
//
// `conceived` is for game systems, not for the screen: the player doesn't know a female is
// pregnant until a spit-off test (or the birth) shows it.

export const EVENTS = [
  'conceived', 'pregnancy_revealed', 'miscarriage', 'cria_born', 'cria_died',
  'defect_revealed', 'carrier_proven', 'deafness_detected',
];

export default class Emitter {
  constructor() {
    this.listeners = new Map(); // event name -> Set of functions
  }

  // Listen for an event; '*' listens for all of them. Returns a function that stops it.
  on(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
    return () => this.off(name, listener);
  }

  off(name, listener) {
    const set = this.listeners.get(name);
    if (set) set.delete(listener);
  }

  emit(name, payload) {
    [name, '*'].forEach((key) => {
      const set = this.listeners.get(key);
      if (set) [...set].forEach((listener) => listener(payload, name));
    });
  }
}
