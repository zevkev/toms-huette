// Datums- und Preislogik, gemeinsam genutzt von Website und Verwaltung.
// Daten werden als 'JJJJ-MM-TT' behandelt. Eine Buchung { from, to } belegt die Nächte from … to-1.

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addDaysISO = (s, n) => toISO(addDays(parseISO(s), n));
export const todayISO = () => toISO(new Date());
export const nightsBetween = (from, to) => (from && to ? Math.round((parseISO(to) - parseISO(from)) / 864e5) : 0);

export const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const formatDate = (s, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) => parseISO(s).toLocaleDateString('de-DE', opts);
export const formatDateLong = (s) => formatDate(s, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const nightsLabel = (n) => (n === 1 ? '1 Nacht' : `${n} Nächte`);
export const personsLabel = (n) => (n === 1 ? '1 Person' : `${n} Personen`);

export const seasonFor = (s, iso) => s.seasons.find((x) => x.from <= iso && iso <= x.to) || null;
export const nightPrice = (s, iso) => { const season = seasonFor(s, iso); return season ? season.price : s.months[parseISO(iso).getMonth()]; };
export const isNightBooked = (bookings, iso) => bookings.some((b) => b.from <= iso && iso < b.to);
export const rangeFree = (bookings, from, to, ignoreId = null) => !bookings.some((b) => b.id !== ignoreId && b.from < to && from < b.to);
export const lastBookableISO = (s) => addDaysISO(todayISO(), s.maxAdvanceDays);

export function quote(s, from, to, persons) {
  const nights = nightsBetween(from, to);
  if (nights <= 0) return null;
  let lodging = 0;
  for (let i = 0; i < nights; i++) lodging += nightPrice(s, addDaysISO(from, i));
  const extraPersons = Math.max(0, Math.min(persons, s.maxPersons) - s.basePersons);
  const extra = extraPersons * s.extraPerson * nights;
  const fee = s.feeEnabled ? s.fee : 0;
  return { nights, lodging, extraPersons, extra, fee, total: lodging + extra + fee };
}

export function minNightPrice(s) {
  const today = todayISO();
  const prices = [...s.months, ...s.seasons.filter((x) => x.to >= today).map((x) => x.price)].filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

// Liefert einen Fehlertext oder '' wenn der Zeitraum angefragt werden kann.
export function checkRange(s, bookings, from, to) {
  if (!from || !to) return 'Bitte wählen Sie Anreise und Abreise.';
  if (from < todayISO()) return 'Die Anreise liegt in der Vergangenheit.';
  const n = nightsBetween(from, to);
  if (n < 1) return 'Die Abreise muss nach der Anreise liegen.';
  if (n < s.minNights) return `Toms Hütte vermieten wir ab ${s.minNights} Nächten.`;
  if (to > lastBookableISO(s)) return `Anfragen sind bis zum ${formatDate(lastBookableISO(s))} möglich.`;
  if (!rangeFree(bookings, from, to)) return 'In diesem Zeitraum ist die Wohnung leider schon belegt.';
  return '';
}
