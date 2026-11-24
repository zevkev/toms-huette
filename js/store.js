// Datenspeicher: Firebase (Firestore + Auth). Fehlt js/firebase-config.js, zeigt die Website nur die Standardwerte.
import { DEFAULT_SETTINGS } from './config-defaults.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let config = null;
try {
  const mod = await import('./firebase-config.js');
  config = mod.firebaseConfig || mod.default || null;
} catch {
  config = null;
}

export const isFirebase = Boolean(config && config.apiKey && config.projectId && !String(config.apiKey).startsWith('DEIN'));

export function normalizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  s.months = Array.from({ length: 12 }, (_, i) => Number(raw.months?.[i] ?? DEFAULT_SETTINGS.months[i]) || 0);
  ['basePersons', 'extraPerson', 'maxPersons', 'minNights', 'maxAdvanceDays', 'fee'].forEach((k) => { s[k] = Number(s[k]) || 0; });
  s.minNights = Math.max(1, s.minNights);
  s.maxPersons = Math.max(1, s.maxPersons);
  s.feeEnabled = Boolean(s.feeEnabled);
  s.seasons = (raw.seasons ?? DEFAULT_SETTINGS.seasons)
    .filter((x) => x && x.from && x.to)
    .map((x) => ({ name: String(x.name || 'Saison'), from: x.from, to: x.to, price: Number(x.price) || 0, color: x.color || '#f2b544' }))
    .sort((a, b) => a.from.localeCompare(b.from));
  s.blocked = (raw.blocked ?? DEFAULT_SETTINGS.blocked ?? [])
    .filter((x) => x && x.from && x.to)
    .map((x) => ({ from: x.from, to: x.to }))
    .sort((a, b) => a.from.localeCompare(b.from));
  s.extras = (raw.extras ?? DEFAULT_SETTINGS.extras ?? [])
    .filter((x) => x && x.name)
    .map((x) => ({ name: String(x.name), price: Number(x.price) || 0, unit: x.unit || 'stay', active: x.active !== false }));
  return s;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created || '').localeCompare(String(b.created || ''));
const byFrom = (a, b) => a.from.localeCompare(b.from);

// Ohne Firebase-Verbindung: nur Standardwerte anzeigen, nichts speichern
function offlineStore() {
  const blocked = async () => { throw new Error('Keine Verbindung zu Firebase. Speichern ist nicht möglich.'); };
  return {
    mode: 'offline',
    async getSettings() { return normalizeSettings({}); },
    async getBookings() { return []; },
    async getNotes() { return {}; },
    async getImages() { return []; },
    saveSettings: blocked, addBooking: blocked, deleteBooking: blocked, addImage: blocked, updateImage: blocked, deleteImage: blocked,
    onAuth(cb) { cb(null); },
    login: blocked,
    async logout() {},
  };
}

async function firebaseStore({ admin }) {
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${SDK}firebase-app.js`),
    import(`${SDK}${admin ? 'firebase-firestore.js' : 'firebase-firestore-lite.js'}`),
  ]);
  const app = initializeApp(config);
  const db = fs.getFirestore(app);
  const { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } = fs;
  const list = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

  let authApi = null;
  let auth = null;
  if (admin) {
    authApi = await import(`${SDK}firebase-auth.js`);
    auth = authApi.getAuth(app);
  }

  return {
    mode: 'firebase',
    async getSettings() {
      const snap = await getDoc(doc(db, 'site', 'settings'));
      return normalizeSettings(snap.exists() ? snap.data() : {});
    },
    async saveSettings(s) { await setDoc(doc(db, 'site', 'settings'), s); },
    async getBookings() { return (await list('bookings')).sort(byFrom); },
    async addBooking({ from, to, note }) {
      const ref = await addDoc(collection(db, 'bookings'), { from, to });
      if (note) await setDoc(doc(db, 'bookingNotes', ref.id), { note });
      return ref.id;
    },
    async deleteBooking(id) {
      await deleteDoc(doc(db, 'bookings', id));
      await deleteDoc(doc(db, 'bookingNotes', id)).catch(() => {});
    },
    async getNotes() { return Object.fromEntries((await list('bookingNotes')).map((n) => [n.id, n.note])); },
    async getImages() { return (await list('images')).sort(byOrder); },
    async addImage(img) { return (await addDoc(collection(db, 'images'), { ...img, created: new Date().toISOString() })).id; },
    async updateImage(id, patch) { await updateDoc(doc(db, 'images', id), patch); },
    async deleteImage(id) { await deleteDoc(doc(db, 'images', id)); },
    onAuth(cb) { authApi.onAuthStateChanged(auth, cb); },
    async login(email, password) { await authApi.signInWithEmailAndPassword(auth, email, password); },
    async logout() { await authApi.signOut(auth); },
  };
}

export function createStore({ admin = false } = {}) {
  return isFirebase ? firebaseStore({ admin }) : Promise.resolve(offlineStore());
}
