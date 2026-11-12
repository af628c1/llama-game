// The game's clock, calendar and weather, in one object: the HUD only reads it, the world
// scenes ask it questions ("is it night?"), and a save file will be able to store it.
// The rules it follows are CALENDAR, CLOCK and WEATHER in config.js.

import { CALENDAR, CLOCK, WEATHER } from '../config.js';

const DAYS_PER_YEAR = CALENDAR.seasons.length * CALENDAR.daysPerSeason;

// A small seeded random number generator (mulberry32): the same seed always gives the
// same number in [0, 1).
function seededRandom(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A calendar date for a day counted from 0 = Spring 1, Year 1.
export function dateOf(absoluteDay) {
  const dayOfYear = absoluteDay % DAYS_PER_YEAR;
  return {
    year: Math.floor(absoluteDay / DAYS_PER_YEAR) + 1,
    season: CALENDAR.seasons[Math.floor(dayOfYear / CALENDAR.daysPerSeason)],
    day: (dayOfYear % CALENDAR.daysPerSeason) + 1,
    weekday: CALENDAR.weekdays[absoluteDay % CALENDAR.weekdays.length],
  };
}

export function clockText(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hour % 12 || 12}:${mm} ${hour < 12 ? 'am' : 'pm'}`;
}

export default class TimeState {
  // `seed` makes one playthrough's weather its own; `events` is the HUD pack's list of
  // festivals and birthdays ({ type, label, season, day, forceWeather? }).
  constructor({ seed, events = [] }) {
    this.seed = seed;
    this.events = events;

    this.absoluteDay = 0;
    this.minutes = CLOCK.dayStartMinutes;
    this.sinceTickMs = 0;

    this.weather = this.rollWeather(0);
    this.tomorrowWeather = this.rollWeather(1); // rolled a day ahead, for a forecast later
  }

  get date() { return dateOf(this.absoluteDay); }

  get dateText() {
    const { weekday, season, day } = this.date;
    return `${weekday}, ${season} ${day}`;
  }

  get yearText() { return `Year ${this.date.year}`; }
  get clockText() { return clockText(this.minutes); }

  // Dark from the evening until the day starts (the clock runs past midnight to 2:00 am).
  get isNight() {
    const m = this.minutes % (24 * 60);
    return m >= CLOCK.nightStartMinutes || m < CLOCK.dayStartMinutes;
  }

  // It's 2:00 am: the rancher can't stay up any longer.
  get mustSleep() { return this.minutes >= CLOCK.passOutMinutes; }

  // Today's festivals and birthdays, festivals first.
  get eventsToday() { return this.eventsOn(this.absoluteDay); }

  eventsOn(absoluteDay) {
    const { season, day } = dateOf(absoluteDay);
    return this.events
      .filter((e) => e.season === season && e.day === day)
      .sort((a, b) => (a.type === 'festival' ? 0 : 1) - (b.type === 'festival' ? 0 : 1));
  }

  // The weather of a given day: the very first day is fixed, a festival can insist on
  // its weather, and otherwise it is a weighted roll for that day's season. Seeded by the
  // day, so a day's weather never changes once it has been rolled.
  rollWeather(absoluteDay) {
    if (absoluteDay === 0) return WEATHER.firstDay;
    const forced = this.eventsOn(absoluteDay).find((e) => e.forceWeather);
    if (forced) return forced.forceWeather;

    const chances = WEATHER.chances[dateOf(absoluteDay).season];
    const total = WEATHER.types.reduce((sum, type) => sum + (chances[type] || 0), 0);
    let roll = seededRandom(this.seed * 1000 + absoluteDay) * total;
    for (const type of WEATHER.types) {
      roll -= chances[type] || 0;
      if (roll < 0) return type;
    }
    return WEATHER.types[0];
  }

  // Run the clock: called with real milliseconds whenever play isn't paused. It stops at
  // 2:00 am until the rancher sleeps.
  tick(deltaMs) {
    if (this.mustSleep) return;
    this.sinceTickMs += deltaMs;
    while (this.sinceTickMs >= CLOCK.tickRealMs && !this.mustSleep) {
      this.sinceTickMs -= CLOCK.tickRealMs;
      this.minutes += CLOCK.tickGameMinutes;
    }
  }

  // Sleep through to the next morning. This is when the new day's weather comes in.
  sleep() {
    this.absoluteDay += 1;
    this.minutes = CLOCK.dayStartMinutes;
    this.sinceTickMs = 0;
    this.weather = this.tomorrowWeather;
    this.tomorrowWeather = this.rollWeather(this.absoluteDay + 1);
  }
}
