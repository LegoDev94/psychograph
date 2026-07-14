/* Страница-пример: условный профиль + полный отчёт демо-движка */
import { initChrome } from './common.js';
import { TEST } from '../data/mmil.js';
import { buildDemoReportHtml } from './report.js';

initChrome('');

/* условный результат: женская форма, умеренные повышения 2 и 7 (паттерн 2+7) */
const EXAMPLE = {
  id: 'example',
  date: Date.UTC(2026, 5, 12, 9, 30),
  form: 'female',
  t: { L: 50, F: 55, K: 52, 1: 58, 2: 67, 3: 60, 4: 46, 5: 52, 6: 55, 7: 69, 8: 61, 9: 44, 0: 63 },
  validity: { status: 'ok', flags: [] },
  unknown: 2,
  answered: 102,
  questionnaire: {
    goal: 'Понять эмоциональное состояние',
    stress: '4',
    sleep: 'Неровный',
    support: 'Скорее да',
    changes: 'смена работы три месяца назад',
    strengths: 'внимательность к людям, надёжность, умение доводить дело до конца',
  },
};

/* статичный SVG-профиль примера (те же классы, что у «психографа» — темизация из CSS) */
const CODES = TEST.scales.map(s => s.code);
const VB = { w: 640, h: 300 };
const M = { l: 36, r: 14, t: 16, b: 30 };
const xAt = i => M.l + i * (VB.w - M.l - M.r) / (CODES.length - 1);
const yAt = t => M.t + (110 - t) / 90 * (VB.h - M.t - M.b);

const svg = document.getElementById('example-profile');
if (svg) {
  const vals = CODES.map(c => EXAMPLE.t[c]);
  const pts = vals.map((t, i) => `${xAt(i).toFixed(1)},${yAt(t).toFixed(1)}`).join(' ');
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  svg.innerHTML = `
    <rect class="psy-corridor" x="${M.l}" y="${yAt(70)}" width="${VB.w - M.l - M.r}" height="${yAt(30) - yAt(70)}"/>
    ${[30, 50, 70, 90].map(t => `<line class="${t === 50 ? 'psy-grid-mid' : 'psy-grid'}" x1="${M.l}" x2="${VB.w - M.r}" y1="${yAt(t)}" y2="${yAt(t)}"/>
      <text class="psy-axis-y" x="${M.l - 7}" y="${yAt(t) + 3}" text-anchor="end">${t}</text>`).join('')}
    <polyline class="psy-line" fill="none" points="${pts}"/>
    ${vals.map((t, i) => `<circle class="psy-point" cx="${xAt(i)}" cy="${yAt(t)}" r="4.2"/>
      ${t > 65 ? `<text class="psy-axis-y" x="${xAt(i)}" y="${yAt(t) - 10}" text-anchor="middle">${t}</text>` : ''}`).join('')}
    ${CODES.map((c, i) => `<text class="psy-axis-x" x="${xAt(i)}" y="${VB.h - 8}" text-anchor="middle">${c}</text>`).join('')}`;
}

document.getElementById('example-report').innerHTML = buildDemoReportHtml(EXAMPLE, { example: true });
