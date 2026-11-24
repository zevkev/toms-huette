// Feiertage (Niedersachsen, dort liegt Borkum) und Schulferien NRW für die Kalender-Hinweise.
import { toISO, addDays } from './pricing.js';

// Schulferien NRW laut Ferienordnung des Schulministeriums NRW
export const FERIEN = [
  { name: 'Herbstferien NRW', from: '2026-10-17', to: '2026-10-31' },
  { name: 'Weihnachtsferien NRW', from: '2026-12-23', to: '2027-01-06' },
  { name: 'Osterferien NRW', from: '2027-03-22', to: '2027-04-03' },
  { name: 'Pfingstferien NRW', from: '2027-05-18', to: '2027-05-18' },
  { name: 'Sommerferien NRW', from: '2027-07-19', to: '2027-08-31' },
  { name: 'Herbstferien NRW', from: '2027-10-23', to: '2027-11-06' },
  { name: 'Weihnachtsferien NRW', from: '2027-12-24', to: '2028-01-08' },
];

// Ostersonntag nach der Gaußschen Osterformel (Anonymer gregorianischer Algorithmus)
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map();
function holidaysOf(year) {
  if (cache.has(year)) return cache.get(year);
  const e = easter(year);
  const list = {
    [`${year}-01-01`]: 'Neujahr',
    [toISO(addDays(e, -2))]: 'Karfreitag',
    [toISO(e)]: 'Ostersonntag',
    [toISO(addDays(e, 1))]: 'Ostermontag',
    [`${year}-05-01`]: 'Tag der Arbeit',
    [toISO(addDays(e, 39))]: 'Christi Himmelfahrt',
    [toISO(addDays(e, 49))]: 'Pfingstsonntag',
    [toISO(addDays(e, 50))]: 'Pfingstmontag',
    [`${year}-10-03`]: 'Tag der Deutschen Einheit',
    [`${year}-10-31`]: 'Reformationstag',
    [`${year}-12-24`]: 'Heiligabend',
    [`${year}-12-25`]: '1. Weihnachtstag',
    [`${year}-12-26`]: '2. Weihnachtstag',
    [`${year}-12-31`]: 'Silvester',
  };
  cache.set(year, list);
  return list;
}

export const holidayFor = (iso) => holidaysOf(Number(iso.slice(0, 4)))[iso] || null;
export const ferienFor = (iso) => FERIEN.find((f) => f.from <= iso && iso <= f.to) || null;
