import { createStore, normalizeSettings } from './store.js';
import { SECTIONS, DEFAULT_IMAGES, SEASON_COLORS, SEASON_PALETTE } from './config-defaults.js';
import * as P from './pricing.js';
import { createCalendar, ICON_FERIEN, ICON_HOLIDAY } from './calendar.js';
import { FERIEN, holidayFor } from './holidays.js';

// Pfade zu Website-Dateien (die Verwaltung liegt im Unterordner /admin/)
const asset = (path) => new URL(`../${path}`, import.meta.url).href;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ADMIN_DOMAIN = 'toms-huette-borkum.firebaseapp.com';
const store = await createStore({ admin: true });
const offline = store.mode === 'offline';

const state = {
  settings: normalizeSettings({}),
  bookings: [],
  notes: {},
  images: [],
  selection: { from: '', to: '' },
  showPast: false,
  dirty: false,
};

/* ---------- Hinweise ---------- */
let toastTimer;
function toast(msg, error = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('is-error', error);
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), error ? 5000 : 2600);
}
const fail = (err) => {
  console.error(err);
  const code = err?.code || '';
  if (code.includes('permission-denied')) toast('Keine Berechtigung. Ist Ihre Admin-UID in den Firestore-Regeln eingetragen?', true);
  else toast(err?.message || 'Das hat leider nicht geklappt.', true);
};

/* ---------- Anmeldung ---------- */
if (offline) {
  $('#demo-banner').hidden = false;
  $('#login-btn').disabled = true;
}

const loginForm = $('#login-form');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = 'Anmeldung läuft …';
  try {
    // Benutzername ohne @ wird intern zu einer Firebase-Adresse ergänzt (z. B. silkeadmin)
    const name = $('#login-email').value.trim().toLowerCase();
    await store.login(name.includes('@') ? name : `${name}@${ADMIN_DOMAIN}`, $('#login-password').value);
  } catch (ex) {
    const code = ex?.code || '';
    err.textContent = code.includes('too-many-requests')
      ? 'Zu viele Versuche. Bitte warten Sie einige Minuten.'
      : code.includes('network')
        ? 'Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.'
        : 'Benutzername oder Passwort ist falsch.';
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Anmelden';
  }
});

$('#logout').addEventListener('click', async () => {
  if (state.dirty && !confirm('Es gibt ungespeicherte Preisänderungen. Trotzdem abmelden?')) return;
  await store.logout();
});

async function loadAll() {
  try {
    const [settings, bookings, notes, images] = await Promise.all([
      store.getSettings(), store.getBookings(), store.getNotes(), store.getImages(),
    ]);
    Object.assign(state, { settings, bookings, notes, images });
    renderBookings();
    renderPriceForm();
    renderImages();
  } catch (err) { fail(err); }
}

/* ---------- Reiter ---------- */
const showTab = (name) => {
  $$('.admin-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  if (name === 'belegung') calendar.render();
  history.replaceState(null, '', `${location.pathname}#${name}`);
};
$('.admin-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) showTab(btn.dataset.tab);
});

/* ---------- Belegung ---------- */
const bFrom = $('#b-from');
const bTo = $('#b-to');
const bInfo = $('#b-info');
const entryType = () => $('[name="b-type"]:checked').value;

$$('[name="b-type"]').forEach((r) => r.addEventListener('change', () => {
  const blocked = entryType() === 'blocked';
  $('#b-from-label').textContent = blocked ? 'Von' : 'Anreise';
  $('#b-to-label').textContent = blocked ? 'Bis einschließlich' : 'Abreise';
  $('#b-note-field').hidden = blocked;
  $('#b-submit').textContent = blocked ? 'Als nicht buchbar eintragen' : 'Als belegt eintragen';
  updateBookingInfo();
}));

const calendar = createCalendar($('#admin-calendar'), {
  admin: true,
  getData: () => state,
  onPick: (iso) => {
    const sel = state.selection;
    if (!sel.from || sel.to || iso <= sel.from) state.selection = { from: iso, to: '' };
    else state.selection = { from: sel.from, to: iso };
    bFrom.value = state.selection.from;
    bTo.value = state.selection.to;
    updateBookingInfo();
    calendar.render();
  },
});

function updateBookingInfo() {
  const from = bFrom.value;
  const to = bTo.value;
  state.selection = { from, to };
  bInfo.classList.remove('is-warning');
  if (!from) { bInfo.textContent = 'Wählen Sie den Zeitraum im Kalender oder über die Datumsfelder.'; return; }
  if (!to) { bInfo.textContent = 'Jetzt den letzten Tag wählen.'; return; }
  if (entryType() === 'blocked') {
    const days = P.nightsBetween(from, to) + 1;
    bInfo.textContent = days >= 1 ? `${days} Tag${days > 1 ? 'e' : ''} werden im Kalender grau und sind nicht buchbar.` : 'Der letzte Tag muss nach dem ersten liegen.';
    bInfo.classList.toggle('is-warning', days < 1);
    return;
  }
  const n = P.nightsBetween(from, to);
  if (n < 1) { bInfo.textContent = 'Die Abreise muss nach der Anreise liegen.'; bInfo.classList.add('is-warning'); return; }
  if (!P.rangeFree(state.bookings, from, to)) {
    bInfo.textContent = `${P.nightsLabel(n)}. Achtung: überschneidet sich mit einer bestehenden Buchung.`;
    bInfo.classList.add('is-warning');
    return;
  }
  const q = P.quote(state.settings, from, to, state.settings.basePersons);
  bInfo.textContent = `${P.nightsLabel(n)}, Richtpreis für ${state.settings.basePersons} Personen: ${P.euro.format(q.total)}`;
}
bFrom.addEventListener('change', () => { if (bTo.value && bTo.value <= bFrom.value) bTo.value = ''; updateBookingInfo(); calendar.render(); });
bTo.addEventListener('change', () => { updateBookingInfo(); calendar.render(); });

$('#booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = bFrom.value;
  const to = bTo.value;
  if (entryType() === 'blocked') {
    if (!from || !to || to < from) { toast('Bitte einen gültigen Zeitraum wählen.', true); return; }
    await saveBlocked([...(state.settings.blocked || []), { from, to }], 'Zeitraum ist jetzt nicht buchbar und im Kalender grau.');
    state.selection = { from: '', to: '' };
    bFrom.value = ''; bTo.value = '';
    renderBookings();
    return;
  }
  if (!from || !to || to <= from) { toast('Bitte einen gültigen Zeitraum wählen.', true); return; }
  if (!P.rangeFree(state.bookings, from, to) && !confirm('Der Zeitraum überschneidet sich mit einer bestehenden Buchung. Trotzdem eintragen?')) return;
  try {
    await store.addBooking({ from, to, note: $('#b-note').value.trim() });
    [state.bookings, state.notes] = await Promise.all([store.getBookings(), store.getNotes()]);
    state.selection = { from: '', to: '' };
    bFrom.value = ''; bTo.value = ''; $('#b-note').value = '';
    renderBookings();
    toast('Buchung eingetragen. Der Zeitraum ist auf der Website jetzt belegt.');
  } catch (err) { fail(err); }
});

$('#show-past').addEventListener('change', (e) => { state.showPast = e.target.checked; renderBookings(); });

async function saveBlocked(blocked, message) {
  try {
    const next = normalizeSettings({ ...state.settings, blocked });
    await store.saveSettings(next);
    state.settings = next;
    renderBookings();
    toast(message);
  } catch (err) { fail(err); }
}

function renderBookings() {
  const today = P.todayISO();
  const entries = [
    ...state.bookings.map((b) => ({ kind: 'booking', id: b.id, from: b.from, to: b.to, end: b.to })),
    ...(state.settings.blocked || []).map((b, i) => ({ kind: 'blocked', id: String(i), from: b.from, to: b.to, end: b.to })),
  ].filter((e) => state.showPast || e.end >= today).sort((a, b) => a.from.localeCompare(b.from));
  $('#booking-list').innerHTML = entries.length
    ? entries.map((e) => `
      <li class="${e.end < today ? 'is-past' : ''} ${e.kind === 'blocked' ? 'is-blocked' : ''}">
        <i class="dot ${e.kind === 'blocked' ? 'dot-blocked' : 'dot-booked'}" aria-hidden="true"></i>
        <div class="b-main">
          <strong>${P.formatDateLong(e.from)} bis ${P.formatDateLong(e.to)}</strong>
          <span>${e.kind === 'blocked'
            ? `Nicht buchbar · ${P.nightsBetween(e.from, e.to) + 1} Tage`
            : `Belegt · ${P.nightsLabel(P.nightsBetween(e.from, e.to))}${state.notes[e.id] ? ` · ${esc(state.notes[e.id])}` : ''}`}</span>
        </div>
        <button class="icon-btn" type="button" data-show-date="${e.from}" title="Im Kalender zeigen" aria-label="Im Kalender zeigen">◎</button>
        <button class="icon-btn danger" type="button" ${e.kind === 'blocked' ? `data-delete-blocked="${e.id}"` : `data-delete-booking="${e.id}"`} title="Eintrag löschen" aria-label="Eintrag löschen">✕</button>
      </li>`).join('')
    : '<li class="empty">Keine anstehenden Einträge.</li>';
  updateBookingInfo();
  calendar.render();
}

$('#booking-list').addEventListener('click', async (e) => {
  const show = e.target.closest('[data-show-date]');
  if (show) { calendar.showMonthOf(show.dataset.showDate); return; }
  const delBlocked = e.target.closest('[data-delete-blocked]');
  if (delBlocked) {
    const idx = Number(delBlocked.dataset.deleteBlocked);
    const b = state.settings.blocked[idx];
    if (!confirm(`Sperre ${P.formatDate(b.from)} bis ${P.formatDate(b.to)} aufheben? Die Tage werden wieder buchbar.`)) return;
    await saveBlocked(state.settings.blocked.filter((_, i) => i !== idx), 'Sperre aufgehoben.');
    return;
  }
  const del = e.target.closest('[data-delete-booking]');
  if (!del) return;
  const b = state.bookings.find((x) => x.id === del.dataset.deleteBooking);
  if (!confirm(`Buchung ${P.formatDate(b.from)} bis ${P.formatDate(b.to)} wirklich löschen? Der Zeitraum wird auf der Website wieder frei.`)) return;
  try {
    await store.deleteBooking(b.id);
    state.bookings = state.bookings.filter((x) => x.id !== b.id);
    renderBookings();
    toast('Buchung gelöscht.');
  } catch (err) { fail(err); }
});

/* ---------- Preise & Saisons ---------- */
const priceForm = $('#price-form');
const BASIC = ['basePersons', 'extraPerson', 'maxPersons', 'minNights', 'maxAdvanceDays', 'fee'];

const setDirty = (dirty) => {
  state.dirty = dirty;
  const el = $('#save-state');
  el.textContent = dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert';
  el.classList.toggle('is-dirty', dirty);
};
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

const updateFeeState = () => {
  const on = $('#p-feeEnabled').checked;
  $('#fee-state').textContent = on ? 'Pauschale an' : 'Pauschale aus';
  $('.fee-amount').classList.toggle('is-off', !on);
};

function extraRow(x = {}) {
  const units = Object.entries(P.EXTRA_UNITS).map(([k, v]) => `<option value="${k}" ${x.unit === k ? 'selected' : ''}>${v}</option>`).join('');
  return `<div class="season-row extra-row">
    <div class="field f-name"><label>Bezeichnung</label><input type="text" class="x-name" value="${esc(x.name || '')}" placeholder="z. B. Endreinigung"></div>
    <div class="field f-from"><label>Preis (€)</label><input type="number" class="x-price" min="0" step="0.5" inputmode="decimal" value="${esc(x.price ?? '')}"></div>
    <div class="field f-to"><label>Abrechnung</label><select class="x-unit">${units}</select></div>
    <div class="field f-price"><label>Aktiv</label><label class="mini-switch"><input type="checkbox" class="x-active" ${x.active !== false ? 'checked' : ''}><span></span></label></div>
    <button class="icon-btn danger f-del" type="button" data-remove-extra title="Posten entfernen" aria-label="Posten entfernen">✕</button>
  </div>`;
}
const renderExtraEmpty = () => {
  const rows = $('#extra-rows');
  if (!$('.extra-row', rows)) rows.innerHTML = '<p class="season-empty">Keine Zusatzkosten eingetragen.</p>';
};

// Nur für den Admin: welche NRW-Ferien und Feiertage fallen in einen Zeitraum?
const shortDate = (iso) => P.formatDate(iso, { day: '2-digit', month: '2-digit' });
function seasonHint(from, to) {
  if (!from || !to || to < from) return '';
  const parts = FERIEN.filter((f) => f.from <= to && from <= f.to)
    .map((f) => `${ICON_FERIEN} ${f.name} (${shortDate(f.from)}${f.to !== f.from ? `–${shortDate(f.to)}` : ''})`);
  for (let d = from, n = 0; d <= to && n < 400; d = P.addDaysISO(d, 1), n++) {
    const h = holidayFor(d);
    if (h) parts.push(`${ICON_HOLIDAY} ${h} (${shortDate(d)})`);
  }
  return parts.length ? parts.join(' · ') : 'Keine NRW-Ferien und keine Feiertage in diesem Zeitraum.';
}
const updateHint = (row) => {
  const hint = $('.s-hint', row);
  if (hint) hint.textContent = seasonHint($('.s-from-in', row).value, $('.s-to-in', row).value);
};

let rowCounter = 0;
function seasonRow(s = {}) {
  const id = `c${rowCounter++}`;
  const current = SEASON_COLORS.includes(s.color) ? s.color : SEASON_COLORS[0];
  const swatches = SEASON_PALETTE.map((p) => `<label class="swatch" title="${p.name}">
      <input type="radio" name="${id}" class="s-color" value="${p.color}" ${p.color === current ? 'checked' : ''}>
      <span style="--c:${p.color}"></span><em>${p.name}</em>
    </label>`).join('');
  return `<div class="season-row">
    <div class="field f-name"><label>Name</label><input type="text" class="s-name" value="${esc(s.name || '')}" placeholder="z. B. Hauptsaison"></div>
    <div class="field f-from"><label>Von</label><input type="date" class="s-from-in" value="${esc(s.from || '')}"></div>
    <div class="field f-to"><label>Bis einschließlich</label><input type="date" class="s-to-in" value="${esc(s.to || '')}"></div>
    <div class="field f-price"><label>Preis / Nacht (€)</label><input type="number" class="s-price-in" min="0" inputmode="decimal" value="${esc(s.price ?? '')}"></div>
    <div class="field f-color"><label>Farbe im Kalender</label><div class="swatches">${swatches}</div></div>
    <p class="s-hint f-hint">${esc(seasonHint(s.from, s.to))}</p>
    <button class="icon-btn danger f-del" type="button" data-remove-season title="Saison entfernen" aria-label="Saison entfernen">✕</button>
  </div>`;
}
const renderSeasonEmpty = () => {
  const rows = $('#season-rows');
  if (!$('.season-row', rows)) rows.innerHTML = '<p class="season-empty">Noch keine Saison eingetragen. Es gelten die Monatspreise.</p>';
};

function renderPriceForm() {
  const s = state.settings;
  BASIC.forEach((k) => { $(`#p-${k}`).value = s[k]; });
  $('#p-feeEnabled').checked = s.feeEnabled;
  updateFeeState();
  $('#month-inputs').innerHTML = s.months.map((p, i) => `
    <div class="field"><label for="m-${i}">${P.MONTHS[i]}</label><input type="number" id="m-${i}" class="m-in" min="0" value="${p}"></div>`).join('');
  $('#season-rows').innerHTML = s.seasons.map(seasonRow).join('');
  renderSeasonEmpty();
  $('#extra-rows').innerHTML = (s.extras || []).map(extraRow).join('');
  renderExtraEmpty();
  setDirty(false);
}

priceForm.addEventListener('change', (e) => {
  if (e.target.matches('.s-from-in, .s-to-in')) updateHint(e.target.closest('.season-row'));
});
priceForm.addEventListener('input', (e) => {
  if (e.target.id === 'all-months') return;
  if (e.target.id === 'p-feeEnabled') updateFeeState();
  e.target.closest('.season-row')?.classList.remove('is-invalid');
  setDirty(true);
});
$('#apply-all').addEventListener('click', () => {
  const v = $('#all-months').value;
  if (v === '') { toast('Bitte zuerst einen Preis eingeben.', true); return; }
  $$('.m-in').forEach((el) => { el.value = v; });
  setDirty(true);
});
$('#add-season').addEventListener('click', () => {
  const rows = $('#season-rows');
  $('.season-empty', rows)?.remove();
  const n = $$('.season-row', rows).length;
  const from = P.todayISO();
  rows.insertAdjacentHTML('beforeend', seasonRow({
    name: '', from, to: P.addDaysISO(from, 30),
    price: (state.settings.months[new Date().getMonth()] || 85) + 15,
    color: SEASON_COLORS[n % SEASON_COLORS.length],
  }));
  $$('.season-row .s-name', rows).at(-1).focus();
  setDirty(true);
});
$('#add-extra').addEventListener('click', () => {
  const rows = $('#extra-rows');
  $('.season-empty', rows)?.remove();
  rows.insertAdjacentHTML('beforeend', extraRow({ name: '', price: '', unit: 'stay', active: true }));
  $$('.x-name', rows).at(-1).focus();
  setDirty(true);
});
$('#extra-rows').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-extra]');
  if (!btn) return;
  btn.closest('.extra-row').remove();
  renderExtraEmpty();
  setDirty(true);
});
// Farbe wählen trägt den passenden Saisonnamen ein (eine Farbe = eine Saison)
$('#season-rows').addEventListener('change', (e) => {
  if (!e.target.classList.contains('s-color')) return;
  const row = e.target.closest('.season-row');
  const name = $('.s-name', row);
  const paletteNames = SEASON_PALETTE.map((p) => p.name);
  if (!name.value.trim() || paletteNames.includes(name.value.trim())) {
    name.value = SEASON_PALETTE.find((p) => p.color === e.target.value)?.name || name.value;
  }
});
$('#season-rows').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-season]');
  if (!btn) return;
  btn.closest('.season-row').remove();
  renderSeasonEmpty();
  setDirty(true);
});

priceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const next = {};
  BASIC.forEach((k) => { next[k] = Number($(`#p-${k}`).value) || 0; });
  next.feeEnabled = $('#p-feeEnabled').checked;
  next.months = $$('.m-in').map((el) => Number(el.value) || 0);
  next.seasons = [];
  let invalid = false;
  $$('#season-rows .season-row').forEach((row) => {
    const season = {
      name: $('.s-name', row).value.trim() || 'Saison',
      from: $('.s-from-in', row).value,
      to: $('.s-to-in', row).value,
      price: Number($('.s-price-in', row).value) || 0,
      color: ($('.s-color:checked', row) || $('.s-color', row)).value,
    };
    const bad = !season.from || !season.to || season.to < season.from || season.price <= 0;
    row.classList.toggle('is-invalid', bad);
    if (bad) invalid = true; else next.seasons.push(season);
  });
  next.extras = [];
  $$('.extra-row').forEach((row) => {
    const extra = {
      name: $('.x-name', row).value.trim(),
      price: Number($('.x-price', row).value) || 0,
      unit: $('.x-unit', row).value,
      active: $('.x-active', row).checked,
    };
    const bad = !extra.name;
    row.classList.toggle('is-invalid', bad);
    if (bad) invalid = true; else next.extras.push(extra);
  });
  next.blocked = state.settings.blocked || [];
  if (invalid) { toast('Bitte prüfen Sie die rot markierten Zeilen (Name, Datum und Preis).', true); return; }
  if (next.months.some((p) => p <= 0)) { toast('Bitte für jeden Monat einen Preis eintragen.', true); return; }
  if (next.basePersons > next.maxPersons) { toast('Die Personen im Grundpreis dürfen nicht über der Höchstzahl liegen.', true); return; }

  try {
    const normalized = normalizeSettings(next);
    await store.saveSettings(normalized);
    state.settings = normalized;
    renderPriceForm();
    calendar.render();
    toast('Preise gespeichert. Die Website zeigt sie ab sofort an.');
  } catch (err) { fail(err); }
});

/* ---------- Bilder ---------- */
const MAX_CHARS = 700_000; // Firestore-Dokumente dürfen höchstens 1 MB groß sein

async function compressImage(blob) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  let longSide = 1800;
  let quality = 0.82;
  let result = null;
  for (let i = 0; i < 8; i++) {
    const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/webp', quality);
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', quality);
    result = { data, w: canvas.width, h: canvas.height };
    if (data.length <= MAX_CHARS) return result;
    longSide = Math.round(longSide * 0.85);
    quality = Math.max(0.55, quality - 0.06);
  }
  return result;
}

const sectionImages = (id) => state.images.filter((i) => i.section === id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

function renderImages() {
  $('#image-sections').innerHTML = SECTIONS.map((sec) => {
    const imgs = sectionImages(sec.id);
    const items = imgs.map((img, idx) => {
      const visible = !sec.max || idx < sec.max;
      return `<div class="img-item ${visible ? '' : 'is-hidden-on-site'}">
        <div class="img-thumb"><img src="${esc(img.data)}" alt="" loading="lazy"></div>
        ${sec.max ? `<span class="img-badge">${visible ? 'wird angezeigt' : 'nicht sichtbar'}</span>` : ''}
        <div class="img-body">
          <input type="text" value="${esc(img.caption)}" placeholder="Bildunterschrift" data-caption="${img.id}" aria-label="Bildunterschrift">
          <div class="img-actions">
            <button class="icon-btn" type="button" data-move="${img.id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} title="Nach vorne" aria-label="Nach vorne">↑</button>
            <button class="icon-btn" type="button" data-move="${img.id}" data-dir="1" ${idx === imgs.length - 1 ? 'disabled' : ''} title="Nach hinten" aria-label="Nach hinten">↓</button>
            <button class="icon-btn danger" type="button" data-delete-image="${img.id}" title="Bild löschen" aria-label="Bild löschen">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
    const defaults = !imgs.length
      ? `<p class="img-defaults-note"><span>Auf der Website werden die Standardfotos gezeigt (${DEFAULT_IMAGES[sec.id].length}). Beim ersten Hochladen werden sie automatisch übernommen und bleiben erhalten.</span>
          <button class="btn btn-outline btn-sm" type="button" data-import="${sec.id}">Standardfotos übernehmen</button></p>
         <div class="img-grid">${DEFAULT_IMAGES[sec.id].map((d) => `<div class="img-item"><div class="img-thumb"><img src="${asset(d.src)}" alt="" loading="lazy"></div><span class="img-badge">Standardfoto</span><div class="img-body"><small class="muted">${esc(d.caption)}</small></div></div>`).join('')}</div>`
      : '';
    return `<div class="admin-card img-section">
      <div class="list-head">
        <div><h2>${esc(sec.label)}</h2><p class="muted small">${esc(sec.hint)}</p></div>
        <label class="btn btn-primary btn-sm upload-btn">+ Bilder hochladen<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload="${sec.id}"></label>
      </div>
      ${imgs.length ? `<div class="img-grid">${items}</div>` : defaults}
    </div>`;
  }).join('');
}

const defaultSources = (section) => Promise.all(DEFAULT_IMAGES[section].map(async (d) => ({ blob: await (await fetch(asset(d.src))).blob(), caption: d.caption })));

async function addImages(section, sources) {
  let order = Math.max(-1, ...sectionImages(section).map((i) => i.order ?? 0)) + 1;
  let done = 0;
  for (const src of sources) {
    toast(`Bild ${done + 1} von ${sources.length} wird verarbeitet …`);
    try {
      const { data, w, h } = await compressImage(src.blob);
      await store.addImage({ section, data, w, h, caption: src.caption || '', order: order++ });
      done++;
    } catch (err) { fail(err); break; }
  }
  state.images = await store.getImages();
  renderImages();
  if (done) toast(`${done} Bild${done > 1 ? 'er' : ''} gespeichert. Die Website zeigt sie ab sofort an.`);
}

$('#image-sections').addEventListener('change', async (e) => {
  const upload = e.target.closest('[data-upload]');
  if (upload) {
    const files = [...upload.files];
    upload.value = '';
    if (!files.length) return;
    const section = upload.dataset.upload;
    let sources = files.map((f) => ({ blob: f, caption: '' }));
    // Erster eigener Upload: bisherige Standardfotos übernehmen, damit sie nicht verschwinden
    if (!sectionImages(section).length) sources = [...await defaultSources(section), ...sources];
    await addImages(section, sources);
    return;
  }
  const caption = e.target.closest('[data-caption]');
  if (caption) {
    try { await store.updateImage(caption.dataset.caption, { caption: caption.value.trim() }); toast('Bildunterschrift gespeichert.'); } catch (err) { fail(err); }
  }
});

$('#image-sections').addEventListener('click', async (e) => {
  const imp = e.target.closest('[data-import]');
  if (imp) {
    imp.disabled = true;
    await addImages(imp.dataset.import, await defaultSources(imp.dataset.import));
    return;
  }
  const move = e.target.closest('[data-move]');
  if (move) {
    const img = state.images.find((i) => i.id === move.dataset.move);
    const list = sectionImages(img.section);
    const idx = list.indexOf(img);
    const other = list[idx + Number(move.dataset.dir)];
    if (!other) return;
    try {
      // Reihenfolge neu durchnummerieren, damit Tauschen immer eindeutig ist
      [list[idx], list[idx + Number(move.dataset.dir)]] = [other, img];
      await Promise.all(list.map((item, i) => (item.order === i ? null : store.updateImage(item.id, { order: i }))));
      list.forEach((item, i) => { item.order = i; });
      renderImages();
    } catch (err) { fail(err); }
    return;
  }
  const del = e.target.closest('[data-delete-image]');
  if (del && confirm('Dieses Bild wirklich löschen? Es verschwindet sofort von der Website.')) {
    try {
      await store.deleteImage(del.dataset.deleteImage);
      state.images = state.images.filter((i) => i.id !== del.dataset.deleteImage);
      renderImages();
      toast('Bild gelöscht.');
    } catch (err) { fail(err); }
  }
});

/* ---------- Start ---------- */
store.onAuth(async (user) => {
  $('#login-view').hidden = Boolean(user);
  $('#app-view').hidden = !user;
  $('#admin-user').hidden = !user;
  if (!user) { $('#login-password').value = ''; return; }
  $('#admin-email').textContent = (user.email || '').replace(`@${ADMIN_DOMAIN}`, '');
  await loadAll();
});

const initial = location.hash.slice(1);
showTab(['belegung', 'preise', 'bilder'].includes(initial) ? initial : 'belegung');
