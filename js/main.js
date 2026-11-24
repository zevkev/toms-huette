import { createStore, normalizeSettings } from './store.js';
import * as P from './pricing.js';
import { createCalendar } from './calendar.js';

const EMAIL = 'tomshuette.borkum@gmx.de';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  settings: normalizeSettings({}),
  bookings: [],
  selection: { from: '', to: '' },
};

/* ---------- Header & Navigation ---------- */
const header = $('#site-header');
const nav = $('#main-nav');
const toggle = $('.nav-toggle');

const updateHeader = () => header.classList.toggle('is-solid', window.scrollY > 40 || nav.classList.contains('is-open'));
const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  updateHeader();
};
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
});
window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

const navLinks = $$('ul a', nav);
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach((s) => sectionObserver.observe(s));

/* ---------- Einblend-Animationen ---------- */
const revealObserver = reduceMotion ? null : new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
const observeReveal = (els) => els.forEach((el) => {
  const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  if (siblings.length > 2) el.style.transitionDelay = `${(siblings.indexOf(el) % 4) * 80}ms`;
  if (revealObserver) revealObserver.observe(el); else el.classList.add('is-visible');
});
observeReveal($$('.reveal'));

/* ---------- Mobile Anfrage-Leiste ---------- */
const sticky = $('#sticky-cta');
const blockers = new Set();
const stickyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) blockers.add(entry.target); else blockers.delete(entry.target); });
  const show = blockers.size === 0;
  sticky.classList.toggle('is-visible', show);
  sticky.inert = !show;
});
['.hero', '#belegung', '#anfrage', '.site-footer'].forEach((sel) => stickyObserver.observe($(sel)));

/* ---------- Lightbox ---------- */
const lb = $('#lightbox');
const lbImg = $('#lb-img');
let slides = [];
let current = 0;
let lastFocus = null;

const markLoaded = () => lbImg.classList.add('is-loaded');
lbImg.addEventListener('load', markLoaded);

const showSlide = (index) => {
  current = (index + slides.length) % slides.length;
  const slide = slides[current];
  lbImg.classList.remove('is-loaded');
  lbImg.src = slide.src;
  lbImg.alt = slide.alt || slide.caption || '';
  $('#lb-caption').textContent = slide.caption || '';
  $('#lb-counter').textContent = `${current + 1} / ${slides.length}`;
  if (lbImg.complete && lbImg.naturalWidth) requestAnimationFrame(markLoaded);
  if (slides.length > 1) new Image().src = slides[(current + 1) % slides.length].src;
};
const openLightbox = (list, index) => {
  slides = list;
  lastFocus = document.activeElement;
  showSlide(index);
  lb.hidden = false;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => lb.classList.add('is-open'));
  $('.lb-close', lb).focus();
};
const closeLightbox = () => {
  lb.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  window.setTimeout(() => { lb.hidden = true; }, reduceMotion ? 0 : 250);
  lastFocus?.focus();
};
const slidesFrom = (buttons) => buttons.map((btn) => {
  const img = $('img', btn);
  return { src: img.currentSrc || img.src, alt: img.alt, caption: btn.dataset.caption || img.dataset.caption || '' };
});

$('#gallery-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.g-item');
  if (!btn) return;
  const all = $$('.g-item');
  openLightbox(slidesFrom(all), all.indexOf(btn));
});
$$('[data-collage]').forEach((btn) => btn.addEventListener('click', () => {
  openLightbox(slidesFrom($$('[data-collage]')), Number(btn.dataset.collage));
}));
$('.lb-close', lb).addEventListener('click', closeLightbox);
$('.lb-prev', lb).addEventListener('click', () => showSlide(current - 1));
$('.lb-next', lb).addEventListener('click', () => showSlide(current + 1));
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-stage')) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') showSlide(current - 1);
  else if (e.key === 'ArrowRight') showSlide(current + 1);
  else if (e.key === 'Tab') {
    const f = $$('button', lb);
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
let touchX = 0;
let touchY = 0;
lb.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; touchY = e.changedTouches[0].clientY; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showSlide(current + (dx < 0 ? 1 : -1));
  else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLightbox();
}, { passive: true });

/* ---------- Plus/Minus-Regler ---------- */
const steppers = $$('.stepper').map((el) => {
  const input = $('input', el);
  const [minus, plus] = $$('[data-step]', el);
  const clamp = () => {
    const min = Number(input.min);
    const max = Number(input.max);
    const v = Math.min(max, Math.max(min, Math.round(Number(input.value)) || min));
    input.value = v;
    minus.disabled = v <= min;
    plus.disabled = v >= max;
  };
  [minus, plus].forEach((btn) => btn.addEventListener('click', () => {
    input.value = Number(input.value) + Number(btn.dataset.step);
    clamp();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  input.addEventListener('change', clamp);
  clamp();
  return clamp;
});
const syncSteppers = () => steppers.forEach((clamp) => clamp());

/* ---------- Anfrageformular ---------- */
const form = $('#inquiry-form');
const success = $('#form-success');
const formError = $('#form-error');
const estimate = $('#estimate');
const estimateText = $('#estimate-text');
const { arrival, departure, adults, children } = form.elements;
let lastInquiry = '';

const formPersons = () => Number(adults.value) + Number(children.value || 0);

// Erwachsene + Kinder dürfen zusammen die Höchstzahl nicht überschreiten
const limitPersons = () => {
  const max = state.settings.maxPersons;
  adults.max = Math.max(1, max - Number(children.value || 0));
  children.max = Math.max(0, max - Number(adults.value));
  syncSteppers();
};

const setDateLimits = (a, d) => {
  const s = state.settings;
  const last = P.lastBookableISO(s);
  a.min = P.todayISO();
  a.max = P.addDaysISO(last, -s.minNights);
  d.min = a.value ? P.addDaysISO(a.value, s.minNights) : P.addDaysISO(P.todayISO(), s.minNights);
  d.max = last;
};

const quoteText = (q, persons) => {
  const parts = [`${P.nightsLabel(q.nights)} × Übernachtung ${P.euro.format(q.lodging)}`];
  if (q.extra) parts.push(`${q.extraPersons} weitere Person${q.extraPersons > 1 ? 'en' : ''} ${P.euro.format(q.extra)}`);
  if (q.fee) parts.push(`Pauschale ${P.euro.format(q.fee)}`);
  q.extras.forEach((x) => parts.push(`${esc(x.name)} ${P.euro.format(x.amount)}`));
  return `${parts.join(' + ')} = <strong>ca. ${P.euro.format(q.total)}</strong> für ${P.personsLabel(persons)}`;
};

const updateEstimate = () => {
  const err = arrival.value && departure.value ? P.checkRange(state.settings, state.bookings, arrival.value, departure.value) : '';
  const q = !err && P.quote(state.settings, arrival.value, departure.value, formPersons());
  estimate.classList.toggle('is-active', Boolean(q));
  estimate.classList.toggle('is-warning', Boolean(err));
  if (err) estimateText.textContent = err;
  else if (q) estimateText.innerHTML = quoteText(q, formPersons());
  else estimateText.textContent = `Wählen Sie Ihren Reisezeitraum (ab ${state.settings.minNights} Nächten). Wir zeigen Ihnen direkt einen Richtpreis.`;
};

arrival.addEventListener('change', () => {
  if (arrival.value) {
    const minDep = P.addDaysISO(arrival.value, state.settings.minNights);
    if (!departure.value || departure.value < minDep) departure.value = minDep;
  }
  setDateLimits(arrival, departure);
  updateEstimate();
});
// Abreise nie kürzer als der Mindestaufenthalt
const enforceMinStay = (a, d) => {
  if (!a.value || !d.value) return false;
  const minDep = P.addDaysISO(a.value, state.settings.minNights);
  if (d.value < minDep) { d.value = minDep; return true; }
  return false;
};
departure.addEventListener('change', () => {
  const fixed = enforceMinStay(arrival, departure);
  updateEstimate();
  if (fixed) estimateText.insertAdjacentHTML('afterbegin', `<b>Mindestaufenthalt ${state.settings.minNights} Nächte, Abreise angepasst.</b><br>`);
});
form.addEventListener('input', (e) => {
  e.target.closest('.field, .bf-field')?.classList.remove('has-error');
  formError.hidden = true;
  if (e.target === adults || e.target === children) { limitPersons(); updateEstimate(); }
});

const validate = () => {
  const errors = [];
  $$('.field, .bf-field', form).forEach((f) => f.classList.remove('has-error'));
  const flag = (el, msg) => { el.closest('.field, .bf-field').classList.add('has-error'); errors.push({ el, msg }); };

  if (!arrival.value) flag(arrival, 'Bitte wählen Sie Ihr Anreisedatum.');
  if (!departure.value) flag(departure, 'Bitte wählen Sie Ihr Abreisedatum.');
  if (arrival.value && departure.value) {
    const err = P.checkRange(state.settings, state.bookings, arrival.value, departure.value);
    if (err) flag(departure, err);
  }
  if (formPersons() > state.settings.maxPersons) flag(adults, `Die Wohnung ist für maximal ${state.settings.maxPersons} Personen.`);
  if (!form.elements.name.value.trim()) flag(form.elements.name, 'Bitte geben Sie Ihren Namen an.');
  if (!form.elements.email.value.trim() || !form.elements.email.checkValidity()) flag(form.elements.email, 'Bitte geben Sie eine gültige E-Mail-Adresse an.');

  if (errors.length) {
    formError.textContent = errors.length === 1 ? errors[0].msg : 'Bitte prüfen Sie die markierten Felder.';
    formError.hidden = false;
    errors[0].el.focus();
    return false;
  }
  return true;
};

const buildInquiry = () => {
  const f = form.elements;
  const q = P.quote(state.settings, arrival.value, departure.value, formPersons());
  const subject = `Anfrage Toms Hütte: ${P.formatDate(arrival.value)} bis ${P.formatDate(departure.value)} (${P.nightsLabel(q.nights)})`;
  const lines = [
    'Hallo,',
    '',
    'ich interessiere mich für die Ferienwohnung „Toms Hütte“ auf Borkum und frage unverbindlich Preis und Verfügbarkeit an:',
    '',
    `Anreise: ${P.formatDateLong(arrival.value)}`,
    `Abreise: ${P.formatDateLong(departure.value)}`,
    `Nächte: ${q.nights}`,
    `Erwachsene: ${f.adults.value}`,
    `Kinder: ${f.children.value || 0}`,
    '',
    'Richtpreis laut Website:',
    `Übernachtungen: ${P.euro.format(q.lodging)}`,
  ];
  if (q.extra) lines.push(`Weitere Personen: ${P.euro.format(q.extra)}`);
  if (q.fee) lines.push(`Pauschale: ${P.euro.format(q.fee)}`);
  q.extras.forEach((x) => lines.push(`${x.name}: ${P.euro.format(x.amount)}`));
  lines.push(`Gesamt: ${P.euro.format(q.total)}`, '', `Name: ${f.name.value.trim()}`, `E-Mail: ${f.email.value.trim()}`);
  if (f.phone.value.trim()) lines.push(`Telefon: ${f.phone.value.trim()}`);
  if (f.message.value.trim()) lines.push('', 'Nachricht:', f.message.value.trim());
  lines.push('', 'Viele Grüße', f.name.value.trim());
  return { subject, body: lines.join('\r\n') };
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate()) return;
  const { subject, body } = buildInquiry();
  lastInquiry = `An: ${EMAIL}\r\nBetreff: ${subject}\r\n\r\n${body}`;
  window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  form.hidden = true;
  success.hidden = false;
  success.focus();
});
$('#edit-inquiry').addEventListener('click', () => { success.hidden = true; form.hidden = false; arrival.focus(); });

const fillForm = ({ from, to, persons }) => {
  success.hidden = true;
  form.hidden = false;
  if (from) arrival.value = from;
  if (to) departure.value = to;
  if (persons) { children.value = 0; adults.value = Math.min(persons, state.settings.maxPersons); }
  limitPersons();
  setDateLimits(arrival, departure);
  $$('.field, .bf-field', form).forEach((f) => f.classList.remove('has-error'));
  formError.hidden = true;
  updateEstimate();
  const target = from && to ? form.elements.name : arrival;
  $('#anfrage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  window.setTimeout(() => target.focus({ preventScroll: true }), reduceMotion ? 0 : 700);
};

/* ---------- Buchungs-Widget im Hero ---------- */
const quick = $('#quick-form');
const qArrival = quick.elements.arrival;
const qDeparture = quick.elements.departure;
const qPersons = quick.elements.persons;

const updateQuick = () => {
  const s = state.settings;
  const persons = Number(qPersons.value);
  const label = $('#q-total-label');
  const value = $('#q-total-value');
  const box = label.parentElement;
  const err = qArrival.value && qDeparture.value ? P.checkRange(s, state.bookings, qArrival.value, qDeparture.value) : '';
  box.classList.toggle('is-warning', Boolean(err));
  if (err) {
    label.textContent = err;
    value.textContent = '';
    return;
  }
  const q = P.quote(s, qArrival.value, qDeparture.value, persons);
  if (q) {
    label.textContent = `${P.nightsLabel(q.nights)}, ${P.personsLabel(persons)}${q.fee || q.extras.length ? ', inkl. Nebenkosten' : ''}`;
    value.textContent = P.euro.format(q.total);
  } else {
    const n = s.minNights;
    const extrasSum = (s.extras || []).filter((x) => x.active).reduce((sum, x) => sum + P.extraAmount(x, n, persons), 0);
    const example = P.minNightPrice(s) * n + Math.max(0, persons - s.basePersons) * s.extraPerson * n + (s.feeEnabled ? s.fee : 0) + extrasSum;
    label.textContent = `${P.nightsLabel(n)}, ${P.personsLabel(persons)}, ab`;
    value.textContent = P.euro.format(example);
  }
};

qArrival.addEventListener('change', () => {
  if (qArrival.value) {
    const minDep = P.addDaysISO(qArrival.value, state.settings.minNights);
    if (!qDeparture.value || qDeparture.value < minDep) qDeparture.value = minDep;
  }
  setDateLimits(qArrival, qDeparture);
  updateQuick();
});
qDeparture.addEventListener('change', () => {
  const fixed = enforceMinStay(qArrival, qDeparture);
  updateQuick();
  if (fixed) $('#q-total-label').textContent = `Ab ${state.settings.minNights} Nächten, Abreise angepasst`;
});
qPersons.addEventListener('input', () => { updateQuick(); renderSelection(); });

quick.addEventListener('submit', (e) => {
  e.preventDefault();
  fillForm({ from: qArrival.value, to: qDeparture.value, persons: Number(qPersons.value) });
});

/* ---------- Belegungskalender ---------- */
const calendar = createCalendar($('#calendar'), {
  getData: () => state,
  onPick: (iso) => pickDate(iso),
});
const selHint = $('#sel-hint');

const setHint = (text, warn = false) => {
  selHint.textContent = text;
  selHint.classList.toggle('is-warning', warn);
};

function pickDate(iso) {
  const s = state.settings;
  const sel = state.selection;
  if (!sel.from || sel.to || iso <= sel.from) {
    if (P.isNightBooked(state.bookings, iso) || P.blockFor(s, iso)) {
      setHint('An diesem Tag ist die Wohnung nicht frei. Bitte wählen Sie einen grünen Tag als Anreise.', true);
      return;
    }
    state.selection = { from: iso, to: '' };
    setHint(`Anreise am ${P.formatDateLong(iso)}. Wählen Sie jetzt Ihren Abreisetag (mindestens ${s.minNights} Nächte).`);
  } else {
    const err = P.checkRange(s, state.bookings, sel.from, iso);
    if (err) { setHint(err, true); return; }
    state.selection = { from: sel.from, to: iso };
    setHint('Ihr Zeitraum ist frei. Jetzt unverbindlich anfragen!');
  }
  calendar.render();
  renderSelection();
}

function renderSelection() {
  const { from, to } = state.selection;
  const persons = Number(qPersons.value);
  const details = $('#sel-details');
  const q = from && to ? P.quote(state.settings, from, to, persons) : null;
  details.hidden = !from;
  $('#sel-from').textContent = from ? P.formatDateLong(from) : '';
  $('#sel-to').textContent = to ? P.formatDateLong(to) : 'bitte wählen';
  $('#sel-nights').textContent = q ? P.nightsLabel(q.nights) : '';
  $('#sel-persons').textContent = P.personsLabel(persons);
  $('#sel-price').textContent = q ? P.euro.format(q.total) : '';
  $('.sel-total', details).hidden = !q;
  $('#sel-apply').disabled = !q;
  $('#sel-reset').hidden = !from;
}

$('#sel-apply').addEventListener('click', () => {
  const { from, to } = state.selection;
  qArrival.value = from;
  qDeparture.value = to;
  updateQuick();
  fillForm({ from, to, persons: Number(qPersons.value) });
});
$('#sel-reset').addEventListener('click', () => {
  state.selection = { from: '', to: '' };
  setHint('Wählen Sie Ihren Anreisetag im Kalender.');
  calendar.render();
  renderSelection();
});

/* ---------- Preise anzeigen ---------- */
function renderPrices() {
  const s = state.settings;
  const setAll = (sel, text) => $$(sel).forEach((el) => { el.textContent = text; });
  setAll('[data-price-min]', P.euro.format(P.minNightPrice(s)));
  setAll('[data-min-nights]', s.minNights);
  setAll('[data-max-persons]', s.maxPersons);
  setAll('[data-base-persons]', s.basePersons);
  setAll('[data-extra-person]', P.euro.format(s.extraPerson));
  setAll('[data-fee]', P.euro.format(s.fee));
  setAll('[data-price-note]', `für ${s.basePersons} Personen${s.feeEnabled ? ` · zzgl. einmalig ${P.euro.format(s.fee)} Pauschale` : ''}`);
  $$('[data-fee-row]').forEach((el) => { el.hidden = !s.feeEnabled; });
  // Zusatzkosten kompakt: eine Zeile, Details zum Aufklappen
  const activeExtras = (s.extras || []).filter((x) => x.active);
  $('#extras-rows').innerHTML = activeExtras.length ? `
    <details class="extras-info">
      <summary>
        <span><span class="price-label">Zusatzkosten</span><span class="price-hint">${activeExtras.length} Posten, im Richtpreis enthalten</span></span>
        <span class="info-btn" aria-hidden="true">i</span>
      </summary>
      <ul>${activeExtras.map((x) => `<li><span>${esc(x.name)} <small>${P.EXTRA_UNITS[x.unit] || ''}</small></span><b>${P.euro.format(x.price)}</b></li>`).join('')}</ul>
    </details>` : '';
  $$('[data-max-persons-input]').forEach((el) => { el.max = s.maxPersons; });

  const today = P.todayISO();
  const seasons = s.seasons.filter((x) => x.to >= today);
  $('#season-wrap').hidden = !seasons.length;

  // Monatspreise nur für Monate zeigen, in denen buchbare Tage ohne Saisonpreis liegen
  const openMonths = new Set();
  for (let d = today, last = P.lastBookableISO(s); d <= last; d = P.addDaysISO(d, 1)) {
    if (!P.seasonFor(s, d)) openMonths.add(P.parseISO(d).getMonth());
  }
  const monthList = seasons.length ? [...openMonths].sort((a, b) => a - b) : s.months.map((_, i) => i);
  // Saisons zu Preisstufen zusammenfassen (gleicher Name, Preis und Farbe), günstigste zuerst
  const tiers = [];
  seasons.forEach((x) => {
    if (!tiers.some((t) => t.color === x.color)) tiers.push(x);
  });
  tiers.sort((a, b) => a.price - b.price);
  $('#season-list').innerHTML = tiers.map((x) => `<li><i style="--season:${esc(x.color)}"></i><span><strong>${esc(x.name)}</strong></span><b>${P.euro.format(x.price)}</b></li>`).join('');

  // Übrige Zeiten ohne Saison: bei einheitlichem Preis nur eine Zeile
  const openPrices = [...new Set(monthList.map((i) => s.months[i]))];
  $('#month-wrap').hidden = !monthList.length;
  if (seasons.length && openPrices.length === 1) {
    $('#month-title').textContent = '';
    $('#month-grid').innerHTML = `<p class="rest-price">Übrige Zeiten: <b>${P.euro.format(openPrices[0])}</b> pro Nacht</p>`;
  } else {
    $('#month-title').textContent = seasons.length ? 'Übrige Zeiten, Preis pro Nacht' : 'Preise pro Nacht nach Monat';
    $('#month-grid').innerHTML = monthList.map((i) => `<div class="month-cell"><span>${P.MONTHS[i].slice(0, 3)}</span><strong>${P.euro.format(s.months[i])}</strong></div>`).join('');
  }

  const legend = $('#cal-legend');
  $$('.lg-season', legend).forEach((el) => el.remove());
  legend.insertAdjacentHTML('beforeend', tiers.map((x) => `<span class="lg lg-season"><i style="--season:${esc(x.color)}"></i>${esc(x.name)} ${P.euro.format(x.price)}</span>`).join(''));

  limitPersons();
  setDateLimits(arrival, departure);
  setDateLimits(qArrival, qDeparture);
  syncSteppers();
  updateQuick();
  updateEstimate();
  calendar.render();
  renderSelection();
}

/* ---------- Bilder aus der Verwaltung ---------- */
function renderImages(images) {
  const bySection = (id) => images.filter((i) => i.section === id);
  const pick = (id) => (bySection(id).length ? bySection(id).map((i) => ({ src: i.data, caption: i.caption || '' })) : null);

  const hero = pick('hero');
  if (hero) $('#hero-img').src = hero[0].src;

  const wohnung = pick('wohnung');
  if (wohnung) {
    $$('[data-collage]').forEach((btn, i) => {
      const img = wohnung[i] || wohnung[0];
      $('img', btn).src = img.src;
      $('img', btn).dataset.caption = img.caption;
      $('img', btn).alt = img.caption || 'Foto von Toms Hütte';
    });
  }

  const lage = pick('lage');
  if (lage) $('#lage-img').src = lage[0].src;

  const galerie = pick('galerie');
  if (galerie) {
    const grid = $('#gallery-grid');
    grid.innerHTML = galerie.map((img) => `
      <li class="reveal"><button class="g-item" type="button" data-caption="${esc(img.caption)}" aria-label="Bild vergrößern${img.caption ? `: ${esc(img.caption)}` : ''}">
        <img src="${esc(img.src)}" alt="${esc(img.caption || 'Foto von Toms Hütte')}" loading="lazy">
        <span class="g-overlay"><span class="g-caption">${esc(img.caption)}</span><svg class="icon" aria-hidden="true"><use href="#i-zoom"/></svg></span>
      </button></li>`).join('');
    observeReveal($$('.reveal', grid));
  }
}

/* ---------- Kopieren ---------- */
const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
};
$$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
  if (await copyText(btn.dataset.copy)) {
    btn.classList.add('is-done');
    window.setTimeout(() => btn.classList.remove('is-done'), 1800);
  }
}));
$('#copy-inquiry').addEventListener('click', async (e) => {
  const label = $('span', e.currentTarget);
  if (await copyText(lastInquiry)) {
    label.textContent = 'Kopiert!';
    window.setTimeout(() => { label.textContent = 'Anfrage kopieren'; }, 2000);
  }
});

$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Start ---------- */
renderPrices();
renderSelection();

try {
  const store = await createStore();
  const [settings, bookings, images] = await Promise.all([store.getSettings(), store.getBookings(), store.getImages()]);
  state.settings = settings;
  state.bookings = bookings;
  renderPrices();
  renderImages(images);
} catch (err) {
  console.warn('Daten konnten nicht geladen werden, es gelten die Standardwerte.', err);
}
