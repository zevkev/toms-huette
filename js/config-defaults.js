// Standardwerte. Sie gelten, solange im Verwaltungsbereich nichts anderes gespeichert ist.
export const DEFAULT_SETTINGS = {
  months: [85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85],
  basePersons: 2,       // im Grundpreis enthaltene Personen
  extraPerson: 10,      // Aufpreis je weitere Person und Nacht
  maxPersons: 4,
  minNights: 7,
  maxAdvanceDays: 365,  // so weit im Voraus kann angefragt werden
  feeEnabled: true,
  fee: 100,
  seasons: [],          // { name, from: 'JJJJ-MM-TT', to: 'JJJJ-MM-TT', price, color }
};

export const SECTIONS = [
  { id: 'hero', label: 'Startbild oben', hint: 'Das erste Bild wird als großes Hintergrundbild verwendet.', max: 1 },
  { id: 'wohnung', label: 'Abschnitt „Die Wohnung“', hint: 'Die ersten zwei Bilder werden als Bildcollage gezeigt.', max: 2 },
  { id: 'galerie', label: 'Galerie', hint: 'Alle Bilder erscheinen in der Galerie, in dieser Reihenfolge.', max: 0 },
  { id: 'lage', label: 'Abschnitt „Lage“', hint: 'Das erste Bild wird neben der Lagebeschreibung gezeigt.', max: 1 },
];

export const DEFAULT_IMAGES = {
  hero: [{ src: 'images/strand.webp', caption: 'Der weite Strand von Borkum' }],
  wohnung: [
    { src: 'images/schlafzimmer.webp', caption: 'Schlafzimmer mit Doppelbett' },
    { src: 'images/wohnzimmer.webp', caption: 'Wohnzimmer mit Eck-Schlafcouch' },
  ],
  galerie: [
    { src: 'images/schlafzimmer.webp', caption: 'Schlafzimmer' },
    { src: 'images/wohnzimmer.webp', caption: 'Wohnzimmer' },
    { src: 'images/kueche.webp', caption: 'Küche' },
    { src: 'images/bad.webp', caption: 'Badezimmer' },
    { src: 'images/balkon.webp', caption: 'Balkon' },
    { src: 'images/strand.webp', caption: 'Strand von Borkum' },
  ],
  lage: [{ src: 'images/balkon.webp', caption: 'Balkon von Toms Hütte' }],
};

export const SEASON_COLORS = ['#f2b544', '#7cc4a8', '#e98a6b', '#9b8be8', '#5fb3e0'];
