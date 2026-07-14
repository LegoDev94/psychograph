/* Результат (M3): график-профиль, таблица шкал, достоверность, экспорт, бесплатное резюме */
import { initChrome, results, chartColors, fmtDate, toast, esc } from './common.js';
import { TEST } from '../data/mmil.js';
import { tBand, BAND_LABELS } from './engine.js';
import { buildProfileOption, mountProfileChart } from './profile-chart.js';

initChrome('history');

const params = new URLSearchParams(location.search);
const rid = params.get('rid');
const result = rid ? results.get(rid) : results.list()[0];

const $ = id => document.getElementById(id);

if (!result) {
  $('result-root').hidden = true;
  $('no-result').hidden = false;
} else {
  renderResult(result);
}

function renderResult(r) {
  const formLabel = r.form === 'male' ? 'мужская форма' : 'женская форма';
  const protocol = '№ ' + r.id.slice(-6).toUpperCase();
  $('result-meta').textContent = `${fmtDate(r.date)} · ${formLabel} · отвечено ${r.answered} из ${TEST.items.length}, «не знаю» — ${r.unknown}`;
  $('chart-cap-form').textContent = `${formLabel} · T-баллы · коридор нормы 30–70`;
  $('protocol-label').textContent = `протокол ${protocol}`;
  $('print-protocol').textContent = `протокол ${protocol} · ${fmtDate(r.date)}`;

  /* --- стат-плитки --- */
  const clinicalScales = TEST.scales.filter(s => s.group === 'clinical');
  const peak = clinicalScales.reduce((a, s) => r.t[s.code] > r.t[a.code] ? s : a, clinicalScales[0]);
  const inCorridor = clinicalScales.filter(s => r.t[s.code] >= 30 && r.t[s.code] <= 70).length;
  const vTile = {
    ok: '<span class="badge badge-ok">достоверен</span>',
    caution: '<span class="badge badge-warn">с осторожностью</span>',
    invalid: '<span class="badge badge-danger">сомнителен</span>',
  }[r.validity.status];
  $('result-tiles').innerHTML = `
    <div class="stat-tile"><span class="stat-label">Достоверность</span><span class="stat-value">${vTile}</span><span class="stat-sub">по L, F, K и F−K</span></div>
    <div class="stat-tile"><span class="stat-label">Пик профиля</span><span class="stat-value mono">${peak.code} · T ${r.t[peak.code]}</span><span class="stat-sub">${esc(peak.name.toLowerCase())}</span></div>
    <div class="stat-tile"><span class="stat-label">В коридоре 30–70</span><span class="stat-value mono">${inCorridor} / ${clinicalScales.length}</span><span class="stat-sub">базовых шкал</span></div>
    <div class="stat-tile"><span class="stat-label">Ответов «не знаю»</span><span class="stat-value mono">${r.unknown}</span><span class="stat-sub">из ${r.answered}</span></div>`;

  /* --- достоверность --- */
  const badge = { ok: ['badge-ok', 'Профиль достоверен'], caution: ['badge-warn', 'Интерпретировать с осторожностью'], invalid: ['badge-danger', 'Профиль сомнителен'] }[r.validity.status];
  $('validity-badge').innerHTML = `<span class="badge ${badge[0]}">${badge[1]}</span>`;
  $('validity-flags').innerHTML = r.validity.flags.map(f =>
    `<div class="callout ${f.level === 'invalid' ? 'danger' : 'warn'}"><p class="mb-0">${esc(f.text)}</p></div>`).join('');

  /* --- график --- */
  const el = $('profile-chart');
  let getChart = null;
  if (window.echarts) {
    getChart = mountProfileChart(el, () => buildProfileOption({
      scales: TEST.scales, t: r.t, colors: chartColors(),
    }));
  } else {
    el.innerHTML = '<p class="muted" style="padding:40px 20px;text-align:center">Не удалось загрузить библиотеку графика — точные значения по всем шкалам приведены в таблице ниже.</p>';
    $('btn-png').disabled = true;
  }

  /* --- таблица --- */
  const tbody = document.querySelector('#scale-table tbody');
  tbody.innerHTML = TEST.scales.map((s, rowIdx) => {
    const band = tBand(r.t[s.code]);
    const corrected = r.corrected[s.code];
    const correctedCell = TEST.correction[s.code]
      ? (Math.round(corrected * 10) / 10).toFixed(1)
      : '—';
    return `<tr class="row-in" style="--row-d:${rowIdx * 45}ms">
      <td class="num"><b>${s.code}</b>${s.mmpi !== s.code ? ` <span class="muted">${s.mmpi}</span>` : ''}</td>
      <td>${s.name}<br><span class="small muted">${s.desc}</span></td>
      <td class="num">${r.raw[s.code]}</td>
      <td class="num">${correctedCell}</td>
      <td class="num"><b>${r.t[s.code]}</b></td>
      <td><span class="t-band ${band}">${BAND_LABELS[band]}</span></td>
    </tr>`;
  }).join('');

  /* --- бесплатное резюме --- */
  const clinical = TEST.scales.filter(s => s.group === 'clinical');
  const high = clinical.filter(s => r.t[s.code] > 70);
  const mild = clinical.filter(s => r.t[s.code] > 60 && r.t[s.code] <= 70);
  const low = clinical.filter(s => r.t[s.code] < 40);
  let text = '';
  if (!high.length && !mild.length && !low.length) {
    text = '<p>Все базовые шкалы вашего профиля находятся в пределах нормативного коридора. Это ровный, сбалансированный профиль без выраженных акцентов.</p>';
  } else {
    if (high.length) text += `<p>Выраженное повышение (T&nbsp;&gt;&nbsp;70): ${high.map(s => `<strong>${esc(s.name.toLowerCase())}</strong> (шкала ${s.code}, T=${r.t[s.code]})`).join(', ')}.</p>`;
    if (mild.length) text += `<p>Умеренное повышение (60–70): ${mild.map(s => `${esc(s.name.toLowerCase())} (${s.code}, T=${r.t[s.code]})`).join(', ')} — уровень акцентуации, заострения отдельных черт.</p>`;
    if (low.length) text += `<p>Ниже типичного диапазона (T&nbsp;&lt;&nbsp;40): ${low.map(s => `${esc(s.name.toLowerCase())} (${s.code}, T=${r.t[s.code]})`).join(', ')}.</p>`;
    text += '<p class="muted small">Что стоит за этими повышениями, как они сочетаются между собой и с вашим текущим контекстом — предмет расширенной интерпретации.</p>';
  }
  $('summary-text').innerHTML = text;

  /* --- действия --- */
  const analysisHref = 'analysis.html?rid=' + r.id;
  $('btn-analysis').href = analysisHref;
  $('link-analysis').href = analysisHref;
  if (r.paid && r.interpretation) $('btn-analysis').textContent = 'Открыть ИИ-интерпретацию →';

  $('btn-png').addEventListener('click', () => {
    if (!getChart) return;
    const url = getChart().getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: chartColors().paper });
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmil-profile-${r.id}.png`;
    a.click();
    toast('График сохранён в PNG');
  });
  $('btn-pdf').addEventListener('click', () => {
    toast('В диалоге печати выберите «Сохранить как PDF»');
    setTimeout(() => window.print(), 600);
  });
}
