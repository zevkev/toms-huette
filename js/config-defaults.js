// Standardwerte. Sie gelten, solange im Verwaltungsbereich nichts anderes gespeichert ist.

const NEBEN = '#5fb3e0';   // 75 €
const MITTEL = '#7cc4a8';  // 85 €
const HAUPT = '#f2b544';   // 95 €

export const DEFAULT_SETTINGS = {
  months: [85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85], // gilt nur, wo keine Saison eingetragen ist
  basePersons: 2,       // im Grundpreis enthaltene Personen
  extraPerson: 10,      // Aufpreis je weitere Person und Nacht
  maxPersons: 4,
  minNights: 7,
  maxAdvanceDays: 365,  // so weit im Voraus kann angefragt werden
  feeEnabled: true,
  fee: 100,
  // Preisliste 2027/2028: { name, from: 'JJJJ-MM-TT', to: 'JJJJ-MM-TT' (einschließlich), price, color }
  seasons: [
    { name: 'Nebensaison', from: '2027-01-07', to: '2027-02-28', price: 75, color: NEBEN },
    { name: 'Zwischensaison', from: '2027-03-01', to: '2027-03-19', price: 85, color: MITTEL },
    { name: 'Hauptsaison', from: '2027-03-20', to: '2027-04-04', price: 95, color: HAUPT },
    { name: 'Zwischensaison', from: '2027-04-05', to: '2027-05-14', price: 85, color: MITTEL },
    { name: 'Hauptsaison', from: '2027-05-15', to: '2027-08-31', price: 95, color: HAUPT },
    { name: 'Zwischensaison', from: '2027-09-01', to: '2027-10-22', price: 85, color: MITTEL },
    { name: 'Hauptsaison', from: '2027-10-23', to: '2027-11-07', price: 95, color: HAUPT },
    { name: 'Nebensaison', from: '2027-11-08', to: '2027-12-23', price: 75, color: NEBEN },
    { name: 'Hauptsaison', from: '2027-12-24', to: '2028-01-02', price: 95, color: HAUPT },
    { name: 'Nebensaison', from: '2028-01-03', to: '2028-02-28', price: 75, color: NEBEN },
  ],
};

export const SECTIONS = [
  { id: 'hero', label: 'Startbild oben', hint: 'Das erste Bild wird als großes Hintergrundbild verwendet.', max: 1 },
  { id: 'wohnung', label: 'Abschnitt „Die Wohnung“', hint: 'Die ersten zwei Bilder werden als Bildcollage gezeigt.', max: 2 },
  { id: 'galerie', label: 'Galerie', hint: 'Alle Bilder erscheinen in der Galerie, in dieser Reihenfolge.', max: 0 },
  { id: 'lage', label: 'Abschnitt „Lage“', hint: 'Das erste Bild wird neben der Lagebeschreibung gezeigt.', max: 1 },
];

export const DEFAULT_IMAGES = {
  hero: [{ src: 'images/duenen.webp', caption: 'Dünen und Strand auf Borkum' }],
  wohnung: [
    { src: 'images/schlafzimmer.webp', caption: 'Schlafzimmer mit Doppelbett' },
    { src: 'images/wohnzimmer-2.webp', caption: 'Wohnzimmer mit Eck-Schlafcouch' },
  ],
  galerie: [
    { src: 'images/schlafzimmer.webp', caption: 'Schlafzimmer' },
    { src: 'images/kleiderschrank.webp', caption: 'Kleiderschrank' },
    { src: 'images/wohnzimmer-2.webp', caption: 'Wohnzimmer' },
    { src: 'images/wohnzimmer-3.webp', caption: 'Eck-Schlafcouch' },
    { src: 'images/wohnzimmer.webp', caption: 'Sitzecke' },
    { src: 'images/kueche.webp', caption: 'Küche' },
    { src: 'images/bad.webp', caption: 'Badezimmer' },
    { src: 'images/balkon.webp', caption: 'Balkon' },
    { src: 'images/duenen.webp', caption: 'Dünen' },
    { src: 'images/sonnenuntergang.webp', caption: 'Sonnenuntergang am Strand' },
    { src: 'images/strand-kites.webp', caption: 'Kitesurfer am Strand' },
    { src: 'images/strand.webp', caption: 'Strand von Borkum' },
  ],
  lage: [{ src: 'images/balkon.webp', caption: 'Balkon von Toms Hütte' }],
};

export const SEASON_COLORS = [HAUPT, MITTEL, NEBEN, '#e98a6b', '#9b8be8'];
