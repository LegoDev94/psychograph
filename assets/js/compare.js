/* Сравнение двух результатов: две линии на одном графике + таблица изменений */
import { initChrome, results, chartColors, fmtDate, toast } from './common.js';
import { TEST as BASE_TEST } from '../data/mmil.js';
import { withOverride } from './test-store.js';
import { buildCompareOption, mountProfileChart } from './profile-chart.js';

const TEST = withOverride(BASE_TEST);

initChrome('history');

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const ra = results.get(params.get('a'));
const rb = results.get(params.get('b'));

if (!ra || !rb) {
  $('compare-root').hidden = true;
  $('no-compare').hidden = false;
} else {
  // А — более ранний замер, Б — более поздний
  const [first, second] = ra.date <= rb.date ? [ra, rb] : [rb, ra];
  render(first, second);
}

function shortDate(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function render(a, b) {
  const labelA = 'А · ' + shortDate(a.date);
  const labelB = 'Б · ' + shortDate(b.date);
  const days = Math.round((b.date - a.date) / 86400000);
  $('compare-meta').textContent = `Замер А: ${fmtDate(a.date)} (${a.form === 'male' ? 'мужская' : 'женская'} форма) · Замер Б: ${fmtDate(b.date)}` +
    (days > 0 ? ` · интервал ${days} дн.` : '') +
    (a.form !== b.form ? ' · внимание: формы различаются, сравнение условно' : '');

  let getChart = null;
  if (window.echarts) {
    getChart = mountProfileChart($('compare-chart'), () => buildCompareOption({
      scales: TEST.scales,
      a: { t: a.t, label: labelA },
      b: { t: b.t, label: labelB },
      colors: chartColors(),
    }));
  } else {
    $('compare-chart').innerHTML = '<p class="muted" style="padding:40px 20px;text-align:center">Не удалось загрузить библиотеку графика — значения приведены в таблице ниже.</p>';
    $('btn-png').disabled = true;
  }

  $('th-a').textContent = labelA;
  $('th-b').textContent = labelB;
  document.querySelector('#compare-table tbody').innerHTML = TEST.scales.map((s, i) => {
    const ta = a.t[s.code], tb = b.t[s.code];
    const d = tb - ta;
    const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '·';
    const strong = Math.abs(d) >= 10;
    return `<tr class="row-in" style="--row-d:${i * 40}ms">
      <td class="num"><b>${s.code}</b></td>
      <td>${s.name}</td>
      <td class="num">${ta}</td>
      <td class="num">${tb}</td>
      <td class="num" ${strong ? 'style="font-weight:600"' : ''}>${d > 0 ? '+' : ''}${d} ${arrow}</td>
    </tr>`;
  }).join('');

  $('btn-png').addEventListener('click', () => {
    if (!getChart) return;
    const url = getChart().getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: chartColors().paper });
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mmil-compare.png';
    link.click();
    toast('График сохранён в PNG');
  });
}
