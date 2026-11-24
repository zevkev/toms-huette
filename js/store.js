// Datenspeicher: Firebase (Firestore + Auth) wenn js/firebase-config.js vorhanden ist,
// sonst ein Demo-Modus, der nur im eigenen Browser speichert.
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
  s.seasons = (raw.seasons || [])
    .filter((x) => x && x.from && x.to)
    .map((x) => ({ name: String(x.name || 'Saison'), from: x.from, to: x.to, price: Number(x.price) || 0, color: x.color || '#f2b544' }))
    .sort((a, b) => a.from.localeCompare(b.from));
  return s;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created || '').localeCompare(String(b.created || ''));
const byFrom = (a, b) => a.from.localeCompare(b.from);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function demoStore() {
  const KEY = 'tomshuette-demo';
  const read = () => {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { d = {}; }
    d.bookings ||= []; d.images ||= []; d.notes ||= {};
    return d;
  };
  const write = (d) => {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {
      throw new Error('Der Browserspeicher im Demo-Modus ist voll. Bitte Bilder löschen oder Firebase einrichten.');
    }
  };
  let authCb = null;
  const user = () => (sessionStorage.getItem('tomshuette-demo-login') ? { email: 'Demo-Modus' } : null);

  return {
    mode: 'demo',
    async getSettings() { return normalizeSettings(read().settings); },
    async saveSettings(s) { const d = read(); d.settings = s; write(d); },
    async getBookings() { return read().bookings.slice().sort(byFrom); },
    async addBooking({ from, to, note }) {
      const d = read(); const id = newId();
      d.bookings.push({ id, from, to });
      if (note) d.notes[id] = note;
      write(d); return id;
    },
    async deleteBooking(id) { const d = read(); d.bookings = d.bookings.filter((b) => b.id !== id); delete d.notes[id]; write(d); },
    async getNotes() { return read().notes; },
    async getImages() { return read().images.slice().sort(byOrder); },
    async addImage(img) { const d = read(); const id = newId(); d.images.push({ id, ...img, created: new Date().toISOString() }); write(d); return id; },
    async updateImage(id, patch) { const d = read(); d.images = d.images.map((i) => (i.id === id ? { ...i, ...patch } : i)); write(d); },
    async deleteImage(id) { const d = read(); d.images = d.images.filter((i) => i.id !== id); write(d); },
    onAuth(cb) { authCb = cb; cb(user()); },
    async login() { sessionStorage.setItem('tomshuette-demo-login', '1'); authCb?.(user()); },
    async logout() { sessionStorage.removeItem('tomshuette-demo-login'); authCb?.(null); },
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
  return isFirebase ? firebaseStore({ admin }) : Promise.resolve(demoStore());
}
