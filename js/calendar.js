// Belegungskalender für Website und Verwaltung.
import { toISO, parseISO, todayISO, isNightBooked, blockFor, seasonFor, lastBookableISO, nightPrice, euro } from './pricing.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const monthTitle = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

export function createCalendar(root, { getData, onPick, admin = false }) {
  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);
  const wide = window.matchMedia('(min-width: 860px)');
  const count = () => (wide.matches ? 2 : 1);

  const bounds = (s) => {
    const last = parseISO(lastBookableISO(s));
    return admin
      ? { min: new Date(now.getFullYear(), now.getMonth() - 12, 1), max: new Date(now.getFullYear() + 2, 11, 1) }
      : { min: new Date(now.getFullYear(), now.getMonth(), 1), max: new Date(last.getFullYear(), last.getMonth(), 1) };
  };

  function render() {
    const { settings: s, bookings, selection = {} } = getData();
    const today = todayISO();
    const last = lastBookableISO(s);
    const { min, max } = bounds(s);
    const lastView = new Date(view.getFullYear(), view.getMonth() + count() - 1, 1);

    let html = `<div class="cal-nav">
      <button type="button" class="cal-btn" data-nav="-1" aria-label="Vorheriger Monat" ${view <= min ? 'disabled' : ''}>‹</button>
      <span class="cal-range">${monthTitle.format(view)}${count() > 1 ? ` bis ${monthTitle.format(lastView)}` : ''}</span>
      <button type="button" class="cal-btn" data-nav="1" aria-label="Nächster Monat" ${lastView >= max ? 'disabled' : ''}>›</button>
    </div><div class="cal-months">`;

    for (let m = 0; m < count(); m++) {
      const month = new Date(view.getFullYear(), view.getMonth() + m, 1);
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      html += `<div class="cal-month"><p class="cal-title">${monthTitle.format(month)}</p><div class="cal-grid">`;
      html += WEEKDAYS.map((d) => `<span class="cal-wd">${d}</span>`).join('');
      html += '<span></span>'.repeat((month.getDay() + 6) % 7);
      for (let d = 1; d <= days; d++) {
        const iso = toISO(new Date(month.getFullYear(), month.getMonth(), d));
        const booked = isNightBooked(bookings, iso);
        const blocked = !booked && Boolean(blockFor(s, iso));
        const season = seasonFor(s, iso);
        const off = !admin && (iso < today || iso > last);
        const cls = ['cal-day'];
        if (off) cls.push('is-off');
        if (booked) cls.push('is-booked');
        if (blocked) cls.push('is-blocked');
        if (season) cls.push('is-season');
        if (iso === today) cls.push('is-today');
        if (selection.from === iso) cls.push('is-start');
        if (selection.to === iso) cls.push('is-end');
        if (selection.from && selection.to && selection.from < iso && iso < selection.to) cls.push('is-range');
        const title = booked ? 'Ausgebucht' : blocked ? 'Nicht buchbar' : `${euro.format(nightPrice(s, iso))} pro Nacht${season ? `, ${season.name}` : ''}`;
        html += `<button type="button" class="${cls.join(' ')}" data-date="${iso}" ${off ? 'disabled' : ''} title="${title}"${season ? ` style="--season:${season.color}"` : ''}><span>${d}</span></button>`;
      }
      html += '</div></div>';
    }
    root.innerHTML = `${html}</div>`;
  }

  root.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1);
      render();
      return;
    }
    const day = e.target.closest('[data-date]');
    if (day && !day.disabled) onPick(day.dataset.date);
  });
  wide.addEventListener('change', render);

  return {
    render,
    showMonthOf(iso) { const d = parseISO(iso); view = new Date(d.getFullYear(), d.getMonth(), 1); render(); },
  };
}
