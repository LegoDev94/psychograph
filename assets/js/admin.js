/* Админ-панель (M8, демо-фронт): дашборд, конструктор теста, заказы, контент, настройки, журнал.
   Всё хранится в localStorage; правки конструктора/настроек реально применяются к сайту. */
import { store, results, toast, esc, fmtDate, chartColors } from './common.js';
import { TEST as BASE_TEST } from '../data/mmil.js';
import { withOverride, getOverride, saveOverride, resetOverride, hasOverride, getSettings, saveSettings, logAction, getLog } from './test-store.js';
import { scoreAttempt } from './engine.js';

const $ = id => document.getElementById(id);
const view = $('admin-view');

/* ---------- сессия ---------- */
const SESSION_KEY = 'pg.admin.session';
const session = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } };

$('login-form').addEventListener('submit', e => {
  e.preventDefault();
  if ($('login-pass').value !== 'demo') { $('login-error').hidden = false; return; }
  const role = document.querySelector('[name="role"]:checked').value;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: $('login-email').value, role, ts: Date.now() }));
  logAction($('login-email').value, 'вход в панель (' + (role === 'admin' ? 'администратор' : 'редактор') + ')');
  boot();
});

$('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  location.hash = '';
  location.reload();
});

function boot() {
  const s = session();
  if (!s) { $('admin-login').hidden = false; $('admin-app').hidden = true; return; }
  $('admin-login').hidden = true;
  $('admin-app').hidden = false;
  $('admin-actor').textContent = `${s.email} · ${s.role === 'admin' ? 'администратор' : 'редактор'}`;
  document.querySelectorAll('[data-role="admin"]').forEach(a => { a.hidden = s.role !== 'admin'; });
  route();
}

/* ---------- роутер ---------- */
const ROUTES = { dashboard, constructor: constructorView, orders, content, users, settings, log: logView };
let dashChart = null;  // единственный ECharts-инстанс дашборда
let dashRender = null; // активная функция рендера дашборда (null вне раздела)

function route() {
  const s = session();
  if (!s) return;
  dashChart?.dispose();
  dashChart = null;
  dashRender = null;
  let name = (location.hash || '#dashboard').slice(1);
  if (!ROUTES[name]) name = 'dashboard';
  const link = document.querySelector(`[data-route="${name}"]`);
  if (link?.hidden) { location.hash = '#dashboard'; return; }
  document.querySelectorAll('.admin-nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === name));
  view.innerHTML = '';
  ROUTES[name](s);
  view.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => dashChart?.resize());

function section(title, num, extra = '') {
  return `<div class="overline"><span class="num">${num}</span> Админ-панель ${extra}</div><h1 class="admin-h1">${title}</h1>`;
}

/* ================= ДАШБОРД ================= */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildSeries(days) {
  const rnd = mulberry32(20260715);
  const out = [];
  let level = 34;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 179; i >= 0; i--) {
    level = Math.max(12, Math.min(70, level + (rnd() - 0.48) * 8));
    const d = new Date(today - i * 86400000);
    d.setHours(0, 0, 0, 0); // защита от сдвига дат при переходе на летнее время
    const weekend = [0, 6].includes(d.getDay()) ? 0.7 : 1;
    const passes = Math.round(level * weekend);
    const orders = Math.round(passes * (0.055 + rnd() * 0.055));
    out.push({ date: d, passes, orders, errors: rnd() < 0.12 ? 1 : 0 });
  }
  /* реальные локальные прохождения этого браузера поверх синтетики */
  for (const r of results.list()) {
    const d = new Date(r.date); d.setHours(0, 0, 0, 0);
    const row = out.find(x => x.date.getTime() === d.getTime());
    if (row) { row.passes += 1; if (r.paid) row.orders += 1; }
  }
  return out.slice(-days);
}

function dashboard(s) {
  const price = getSettings().price;
  const recentOrders = collectOrders().slice(0, 5);
  const recentLog = getLog().slice(0, 6);
  view.innerHTML = `
    ${section('Дашборд', 'А-01')}
    <div class="admin-toolbar">
      <div class="radio-line" role="group" aria-label="Период">
        ${[7, 30, 90].map(d => `<label><input type="radio" name="period" value="${d}" ${d === 30 ? 'checked' : ''}>${d} дней</label>`).join('')}
      </div>
      <span class="small muted">синтетические данные + ваши локальные прохождения</span>
    </div>
    <div class="stat-tiles" id="dash-tiles"></div>
    <figure class="chart-frame" style="margin:22px 0 0">
      <div id="dash-chart" style="width:100%;height:360px" role="img" aria-label="Динамика прохождений и заказов по дням"></div>
      <figcaption class="frame-cap"><span>Прохождения и заказы по дням</span><span id="dash-cap"></span></figcaption>
    </figure>
    <div class="admin-grid-2">
      <div>
        <h2 class="admin-h2">Последние заказы</h2>
        <div class="table-frame"><table class="scale-table"><thead>
          <tr><th scope="col">Заказ</th><th scope="col">Дата</th><th scope="col">Статус</th></tr></thead>
          <tbody>${recentOrders.map(o => `<tr>
            <td class="num">${o.id}</td>
            <td>${fmtDate(o.date)}</td>
            <td><span class="badge ${orderBadge(o.status)}">${o.status}</span></td>
          </tr>`).join('')}</tbody></table></div>
        <a class="admin-more" href="#orders">Все заказы →</a>
      </div>
      <div>
        ${s.role === 'admin' ? `
        <h2 class="admin-h2">Последние действия</h2>
        ${recentLog.length ? `<div class="table-frame"><table class="scale-table"><tbody>
          ${recentLog.map(e => `<tr>
            <td class="num" style="white-space:nowrap">${fmtDate(e.ts)}</td>
            <td>${esc(e.action)}</td>
          </tr>`).join('')}</tbody></table></div>
        <a class="admin-more" href="#log">Весь журнал →</a>` : '<p class="muted small">Журнал пока пуст.</p>'}
        ` : `
        <h2 class="admin-h2">Быстрые действия</h2>
        <div class="card">
          <p class="small muted">Доступно редактору:</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn-soft btn-sm" href="#constructor">Конструктор теста</a>
            <a class="btn btn-soft btn-sm" href="#content">Контент и SEO</a>
          </div>
        </div>`}
      </div>
    </div>`;

  const render = days => {
    if (!$('dash-tiles')) return; // раздел уже закрыт
    const data = buildSeries(days);
    const passes = data.reduce((a, x) => a + x.passes, 0);
    const orders = data.reduce((a, x) => a + x.orders, 0);
    const errors = data.reduce((a, x) => a + x.errors, 0);
    $('dash-tiles').innerHTML = `
      <div class="stat-tile"><span class="stat-label">Прохождений</span><span class="stat-value mono">${passes}</span><span class="stat-sub">за ${days} дн.</span></div>
      <div class="stat-tile"><span class="stat-label">Заказов ИИ-анализа</span><span class="stat-value mono">${orders}</span><span class="stat-sub">конверсия ${(orders / passes * 100).toFixed(1)}%</span></div>
      <div class="stat-tile"><span class="stat-label">Выручка</span><span class="stat-value mono">${(orders * price).toLocaleString('ru-RU')} ₽</span><span class="stat-sub">цена ${price} ₽</span></div>
      <div class="stat-tile"><span class="stat-label">Ошибки ИИ-генераций</span><span class="stat-value mono">${errors}</span><span class="stat-sub">повторы в очереди</span></div>`;
    $('dash-cap').textContent = `последние ${days} дней`;

    if (!window.echarts) return;
    const c = chartColors();
    dashChart?.dispose();
    dashChart = echarts.init($('dash-chart'));
    dashChart.setOption({
      animationDuration: 500,
      grid: { left: 44, right: 20, top: 34, bottom: 30 },
      legend: { top: 0, textStyle: { color: c.ink2, fontFamily: c.fontBody, fontSize: 12 } },
      tooltip: { trigger: 'axis', backgroundColor: c.paper, borderColor: c.hairlineStrong, textStyle: { color: c.ink, fontSize: 12 } },
      xAxis: {
        type: 'category', boundaryGap: false,
        data: data.map(x => x.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
        axisLine: { lineStyle: { color: c.hairlineStrong } }, axisTick: { show: false },
        axisLabel: { color: c.ink3, fontFamily: c.fontMono, fontSize: 10, interval: Math.ceil(days / 9) },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: c.ink3, fontFamily: c.fontMono, fontSize: 10 },
        splitLine: { lineStyle: { color: c.hairline } },
      },
      series: [
        { name: 'Прохождения', type: 'line', data: data.map(x => x.passes), lineStyle: { width: 2, color: c.accent }, itemStyle: { color: c.accent }, symbol: 'none', areaStyle: { color: c.corridor } },
        { name: 'Заказы', type: 'line', data: data.map(x => x.orders), lineStyle: { width: 2, color: c.accent2 }, itemStyle: { color: c.accent2 }, symbol: 'none' },
      ],
    });
  };
  view.querySelectorAll('[name="period"]').forEach(r =>
    r.addEventListener('change', () => render(Number(r.value))));
  dashRender = render;
  render(30);
}

/* пересборка графика при смене темы/печати — только пока дашборд открыт */
document.addEventListener('pg:theme', () => {
  const checked = view.querySelector('[name="period"]:checked');
  if (dashRender && checked) dashRender(Number(checked.value));
});

/* ================= КОНСТРУКТОР ================= */
function constructorView(s) {
  const test = withOverride(BASE_TEST);
  const o = getOverride();
  view.innerHTML = `
    ${section('Конструктор теста', 'А-02', hasOverride() ? '<span class="badge badge-warn">есть правки</span>' : '')}
    <p class="muted" style="max-width:70ch">Пункты, ключи, нормы и правила — редактируются и <strong>реально применяются</strong>
      к тесту на этом устройстве. «Сбросить к заводским» возвращает демо-банк из репозитория.</p>
    <div class="admin-tabs" role="tablist">
      ${['Пункты', 'Шкалы и нормы', 'Правила', 'Тестовый расчёт', 'Импорт / экспорт'].map((t, i) =>
        `<button class="admin-tab ${i === 0 ? 'active' : ''}" data-tab="${i}" role="tab">${t}</button>`).join('')}
    </div>
    <div id="ctab-0"></div>
    <div id="ctab-1" hidden></div>
    <div id="ctab-2" hidden></div>
    <div id="ctab-3" hidden></div>
    <div id="ctab-4" hidden></div>`;

  view.querySelectorAll('.admin-tab').forEach(btn => btn.addEventListener('click', () => {
    view.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
    for (let i = 0; i < 5; i++) $('ctab-' + i).hidden = String(i) !== btn.dataset.tab;
  }));

  /* --- Пункты --- */
  const tab0 = $('ctab-0');
  tab0.innerHTML = `
    <div class="admin-toolbar">
      <input type="search" id="item-search" class="admin-search" placeholder="Поиск по тексту утверждения…" aria-label="Поиск по утверждениям">
      <span class="small muted">${test.items.length} пунктов · клик по ключу меняет направление (Т↔F)</span>
    </div>
    <div class="table-frame"><table class="scale-table admin-items"><thead>
      <tr><th scope="col">№</th><th scope="col">Утверждение</th><th scope="col">Ключи</th></tr>
    </thead><tbody id="items-body"></tbody></table></div>`;

  const renderItems = (q = '') => {
    const needle = q.trim().toLowerCase();
    $('items-body').innerHTML = test.items
      .filter(it => !needle || it.text.toLowerCase().includes(needle))
      .map(it => `<tr>
        <td class="num">${it.id}</td>
        <td><input class="admin-inline-input" data-item="${it.id}" value="${esc(it.text)}" aria-label="Текст утверждения ${it.id}"></td>
        <td>${it.keys.map((k, ki) =>
          `<button class="key-chip" data-key="${it.id}:${ki}" title="Шкала ${esc(k.scale)}: балл за «${k.keyed === 'T' ? 'Верно' : 'Неверно'}»${k.keyedFemale ? `, жен. ключ ${esc(k.keyedFemale)}` : ''}">
            ${esc(k.scale)}·${esc(k.keyed)}${k.keyedFemale ? '/' + esc(k.keyedFemale) : ''}</button>`).join(' ')}</td>
      </tr>`).join('');

    $('items-body').querySelectorAll('.admin-inline-input').forEach(inp =>
      inp.addEventListener('change', () => {
        const text = inp.value.trim();
        if (!text) { toast('Текст пункта не может быть пустым'); return; }
        const ov = getOverride();
        ov.itemTexts = ov.itemTexts || {};
        ov.itemTexts[inp.dataset.item] = text;
        saveOverride(ov);
        // локальный клон тоже обновляем — иначе поиск/перерисовка откатят текст на экране
        const item = test.items.find(x => x.id === Number(inp.dataset.item));
        if (item) item.text = text;
        logAction(s.email, `изменён текст пункта №${inp.dataset.item}`);
        toast(`Пункт №${inp.dataset.item} сохранён`);
      }));
    $('items-body').querySelectorAll('.key-chip').forEach(btn =>
      btn.addEventListener('click', () => {
        const [id, ki] = btn.dataset.key.split(':');
        const item = test.items.find(x => x.id === Number(id));
        const key = item.keys[Number(ki)];
        key.keyed = key.keyed === 'T' ? 'F' : 'T';
        const ov = getOverride();
        ov.itemKeys = ov.itemKeys || {};
        ov.itemKeys[id] = item.keys;
        saveOverride(ov);
        logAction(s.email, `пункт №${id}: ключ шкалы ${key.scale} → ${key.keyed}`);
        btn.textContent = `${key.scale}·${key.keyed}${key.keyedFemale ? '/' + key.keyedFemale : ''}`;
        toast(`Ключ пункта №${id} → ${key.keyed}`);
      }));
  };
  $('item-search').addEventListener('input', e => renderItems(e.target.value));
  renderItems();

  /* --- Шкалы и нормы --- */
  $('ctab-1').innerHTML = `
    <p class="small muted">Нормы: T = 50 + 10·(X − M)/σ. Изменения применяются к новым расчётам.</p>
    <div class="table-frame"><table class="scale-table"><thead>
      <tr><th scope="col">Шкала</th><th scope="col">Группа</th><th scope="col">M муж.</th><th scope="col">σ муж.</th><th scope="col">M жен.</th><th scope="col">σ жен.</th></tr>
    </thead><tbody>
      ${test.scales.map(sc => `<tr>
        <td class="num"><b>${sc.code}</b> ${esc(sc.name)}</td>
        <td><span class="badge">${sc.group === 'validity' ? 'оценочная' : 'базовая'}</span></td>
        ${['male', 'female'].map(form => ['m', 'sd'].map(f =>
          `<td><input class="admin-num" type="number" step="0.1" min="0.1" value="${test.norms[form][sc.code][f]}" data-norm="${form}:${sc.code}:${f}" aria-label="${f === 'm' ? 'Среднее' : 'Сигма'} ${sc.code} ${form === 'male' ? 'муж' : 'жен'}"></td>`).join('')).join('')}
      </tr>`).join('')}
    </tbody></table></div>`;
  $('ctab-1').querySelectorAll('[data-norm]').forEach(inp =>
    inp.addEventListener('change', () => {
      const [form, code, f] = inp.dataset.norm.split(':');
      const val = Number(inp.value);
      if (!inp.value.trim() || !Number.isFinite(val) || (f === 'sd' && val <= 0)) { toast('Некорректное значение'); return; }
      const ov = getOverride();
      ov.norms = ov.norms || {};
      ov.norms[form] = ov.norms[form] || {};
      ov.norms[form][code] = { ...(ov.norms[form][code] || {}), [f]: val };
      saveOverride(ov);
      logAction(s.email, `норма ${code} (${form === 'male' ? 'муж' : 'жен'}): ${f.toUpperCase()} = ${val}`);
      toast(`Норма ${code} сохранена`);
    }));

  /* --- Правила --- */
  const rules = test.validityRules;
  $('ctab-2').innerHTML = `
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <h3>Достоверность</h3>
        ${[['maxUnknownShare', 'Макс. доля пропусков (0–1)'], ['fCautionT', 'F: осторожно при T >'], ['fInvalidT', 'F: недостоверен при T >'], ['lCautionT', 'L: осторожно при T >'], ['kCautionT', 'K: осторожно при T >'], ['fkRawMax', 'Индекс F−K (сырые) >']].map(([k, label]) =>
          `<label class="admin-row"><span>${label}</span><input class="admin-num" type="number" step="${k === 'maxUnknownShare' ? 0.05 : 1}" value="${rules[k]}" data-rule="${k}"></label>`).join('')}
      </div>
      <div class="card">
        <h3>K-коррекция</h3>
        <p class="small muted">Доля сырого балла K, добавляемая к шкале.</p>
        ${Object.entries(test.correction).map(([code, coef]) =>
          `<label class="admin-row"><span>Шкала ${code} (${{ 1: 'Hs', 4: 'Pd', 7: 'Pt', 8: 'Sc', 9: 'Ma' }[code]})</span><input class="admin-num" type="number" step="0.1" min="0" max="1" value="${coef}" data-corr="${code}"></label>`).join('')}
      </div>
    </div>`;
  $('ctab-2').querySelectorAll('[data-rule]').forEach(inp =>
    inp.addEventListener('change', () => {
      const ov = getOverride();
      ov.validityRules = { ...(ov.validityRules || {}), [inp.dataset.rule]: Number(inp.value) };
      saveOverride(ov);
      logAction(s.email, `правило ${inp.dataset.rule} = ${inp.value}`);
      toast('Правило сохранено');
    }));
  $('ctab-2').querySelectorAll('[data-corr]').forEach(inp =>
    inp.addEventListener('change', () => {
      const ov = getOverride();
      ov.correction = { ...(ov.correction || {}), [inp.dataset.corr]: Number(inp.value) };
      saveOverride(ov);
      logAction(s.email, `K-коррекция шкалы ${inp.dataset.corr} = ${inp.value}`);
      toast('Коэффициент сохранён');
    }));

  /* --- Тестовый расчёт --- */
  $('ctab-3').innerHTML = `
    <p class="small muted" style="max-width:64ch">Прогон движка на текущей конфигурации (с вашими правками) — проверка ключей,
      норм и правил без прохождения теста.</p>
    <div class="admin-toolbar">
      <div class="radio-line" role="group" aria-label="Форма">
        <label><input type="radio" name="calc-form" value="male" checked>мужская</label>
        <label><input type="radio" name="calc-form" value="female">женская</label>
      </div>
      <button class="btn btn-soft btn-sm" data-calc="true">Все «Верно»</button>
      <button class="btn btn-soft btn-sm" data-calc="false">Все «Неверно»</button>
      <button class="btn btn-soft btn-sm" data-calc="random">Случайные ответы</button>
    </div>
    <div id="calc-result"></div>`;
  $('ctab-3').querySelectorAll('[data-calc]').forEach(btn =>
    btn.addEventListener('click', () => {
      const current = withOverride(BASE_TEST);
      const form = view.querySelector('[name="calc-form"]:checked').value;
      const rnd = mulberry32(Date.now() % 100000);
      const answers = {};
      for (const it of current.items) {
        answers[it.id] = btn.dataset.calc === 'true' ? 1 : btn.dataset.calc === 'false' ? 0 : (rnd() < 0.5 ? 1 : 0);
      }
      const r = scoreAttempt(current, form, answers);
      const badge = { ok: 'badge-ok">достоверен', caution: 'badge-warn">с осторожностью', invalid: 'badge-danger">сомнителен' }[r.validity.status];
      $('calc-result').innerHTML = `
        <div class="card" style="margin-top:14px">
          <p class="small" style="margin-bottom:10px">Форма: <b>${form === 'male' ? 'мужская' : 'женская'}</b> ·
            достоверность: <span class="badge ${badge}</span> · F−K = ${r.validity.fk}</p>
          <div class="table-frame"><table class="scale-table"><thead>
            <tr><th scope="col">Шкала</th><th scope="col">Сырой</th><th scope="col">С коррекцией</th><th scope="col">T</th></tr></thead>
            <tbody>${current.scales.map(sc => `<tr>
              <td class="num"><b>${sc.code}</b></td>
              <td class="num">${r.raw[sc.code]}</td>
              <td class="num">${(Math.round(r.corrected[sc.code] * 10) / 10).toFixed(1)}</td>
              <td class="num"><b>${r.t[sc.code]}</b></td></tr>`).join('')}
            </tbody></table></div>
        </div>`;
      logAction(s.email, `тестовый расчёт (${btn.textContent.trim().toLowerCase()}, ${form})`);
    }));

  /* --- Импорт / экспорт --- */
  $('ctab-4').innerHTML = `
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <h3>Экспорт</h3>
        <p class="small muted">Текущее определение теста (с правками) — JSON, совместимый с
          <span class="mono">assets/data/mmil.js</span>.</p>
        <button class="btn btn-soft" id="btn-export-test">Скачать JSON</button>
      </div>
      <div class="card">
        <h3>Импорт</h3>
        <p class="small muted">JSON полного определения или CSV пунктов
          (<span class="mono">id;text;scale;keyed;keyedFemale</span>). Проверяется перед применением.</p>
        <input type="file" id="import-file" accept=".json,.csv" class="admin-file">
      </div>
    </div>
    <div class="callout warn" style="margin-top:16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
      <span>${hasOverride() ? 'На этом устройстве есть админ-правки конфигурации.' : 'Правок нет — используется заводская конфигурация.'}</span>
      <button class="btn btn-danger btn-sm" id="btn-reset-test" ${hasOverride() ? '' : 'disabled'}>Сбросить к заводским</button>
    </div>`;
  $('btn-export-test').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(withOverride(BASE_TEST), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mmil-test-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    logAction(s.email, 'экспорт конфигурации теста (JSON)');
  });
  $('btn-reset-test').addEventListener('click', () => {
    resetOverride();
    logAction(s.email, 'сброс конфигурации теста к заводской');
    toast('Конфигурация сброшена');
    route();
  });
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ov = getOverride();
      const SCALE_RE = /^[LFK0-9]$/;
      const validKey = k => k && SCALE_RE.test(k.scale) && ['T', 'F'].includes(k.keyed) &&
        (k.keyedFemale === undefined || ['T', 'F'].includes(k.keyedFemale));

      if (file.name.endsWith('.csv')) {
        const rows = text.replace(/^\\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(l => l.split(';'));
        const head = rows.shift().map(h => h.trim().toLowerCase());
        if (head[0] !== 'id' || head[1] !== 'text') throw new Error('ожидаются колонки id;text;scale;keyed;keyedFemale');
        ov.itemTexts = ov.itemTexts || {}; ov.itemKeys = ov.itemKeys || {};
        const seenIds = new Set();
        let applied = 0;
        for (const row of rows) {
          const id = Number(row[0]);
          if (!BASE_TEST.items.some(it => it.id === id)) continue;
          /* «;» внутри текста: всё между id и тремя последними колонками — это текст */
          let textCol, scale, keyed, keyedF;
          if (row.length > 5) {
            textCol = row.slice(1, row.length - 3).join(';');
            [scale, keyed, keyedF] = row.slice(-3);
          } else {
            [, textCol, scale, keyed, keyedF] = row;
          }
          if (textCol?.trim()) ov.itemTexts[id] = textCol.trim();
          if (scale?.trim() && keyed?.trim()) {
            const key = { scale: scale.trim(), keyed: keyed.trim().toUpperCase() };
            if (keyedF?.trim()) key.keyedFemale = keyedF.trim().toUpperCase();
            if (!validKey(key)) throw new Error(`пункт ${id}: некорректный ключ`);
            if (!seenIds.has(id)) { ov.itemKeys[id] = []; seenIds.add(id); } // ключи одного id накапливаются
            ov.itemKeys[id].push(key);
          }
          applied++;
        }
        saveOverride(ov);
        toast(`CSV: применено строк — ${applied}`);
      } else {
        const data = JSON.parse(text);
        if (!Array.isArray(data.items) || !data.norms?.male) throw new Error('не похоже на определение теста');
        for (const it of data.items) {
          if (typeof it.text !== 'string' || !Array.isArray(it.keys) || !it.keys.every(validKey)) {
            throw new Error(`пункт ${it.id}: некорректная структура или ключи`);
          }
        }
        const numMap = obj => Object.fromEntries(
          Object.entries(obj || {}).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
        ov.itemTexts = Object.fromEntries(data.items.map(it => [it.id, it.text]));
        ov.itemKeys = Object.fromEntries(data.items.map(it => [it.id, it.keys]));
        ov.norms = {};
        for (const form of ['male', 'female']) {
          ov.norms[form] = {};
          for (const [code, n] of Object.entries(data.norms[form] || {})) {
            if (SCALE_RE.test(code)) ov.norms[form][code] = { m: Number(n.m), sd: Number(n.sd) || 1 };
          }
        }
        ov.validityRules = numMap(data.validityRules);
        ov.correction = Object.fromEntries(
          Object.entries(numMap(data.correction)).filter(([code]) => SCALE_RE.test(code)));
        saveOverride(ov);
        toast('JSON-конфигурация проверена и применена');
      }
      logAction(s.email, `импорт конфигурации (${file.name})`);
      route();
    } catch (err) {
      toast('Ошибка импорта: ' + err.message, 5000);
    }
  });
}

/* ================= ЗАКАЗЫ ================= */
const orderBadge = st => ({ 'выполнен': 'badge-ok', 'оплачен': 'badge-accent', 'возврат': 'badge-danger', 'в очереди': 'badge-warn' }[st] || '');

function collectOrders() {
  const statusOv = store.get('admin.orderStatus', {});
  const local = results.list().filter(r => r.paid).map(r => ({
    id: 'ORD-' + r.id.slice(-6).toUpperCase(),
    rid: r.id,
    date: r.date,
    email: 'локальный пользователь',
    status: statusOv['ORD-' + r.id.slice(-6).toUpperCase()] || (r.interpretation ? 'выполнен' : 'оплачен'),
    local: true,
  }));
  const rnd = mulberry32(42);
  const synth = Array.from({ length: 8 }, (_, i) => {
    const daysAgo = Math.floor(rnd() * 28) + 1;
    const time = Date.now() - daysAgo * 86400000 - rnd() * 8.64e7;
    const r1 = rnd(), r2 = rnd(); // всегда вызываем оба — иначе override сдвигает всю PRNG-последовательность
    return {
      id: 'ORD-DEMO' + String(i + 1).padStart(2, '0'),
      date: time,
      email: `user${i + 1}@example.com`,
      status: statusOv['ORD-DEMO' + String(i + 1).padStart(2, '0')] || (r1 < 0.8 ? 'выполнен' : r2 < 0.5 ? 'оплачен' : 'возврат'),
    };
  });
  return [...local, ...synth].sort((a, b) => b.date - a.date);
}

function orders(s) {
  const all = collectOrders();
  const price = getSettings().price;
  const badge = orderBadge;

  view.innerHTML = `
    ${section('Заказы', 'А-03')}
    <p class="muted">Оплаты ИИ-интерпретаций: локальные (из этого браузера) и демонстрационные строки.</p>
    <div class="table-frame"><table class="scale-table"><thead>
      <tr><th scope="col">Заказ</th><th scope="col">Дата</th><th scope="col">Покупатель</th><th scope="col">Сумма</th><th scope="col">Статус</th><th scope="col">Действия</th></tr>
    </thead><tbody>
      ${all.map(o => `<tr>
        <td class="num">${o.id}${o.local ? ' <span class="badge badge-accent">локальный</span>' : ''}</td>
        <td>${fmtDate(o.date)}</td>
        <td>${esc(o.email)}</td>
        <td class="num">${price} ₽</td>
        <td><span class="badge ${badge(o.status)}">${o.status}</span></td>
        <td style="white-space:nowrap">
          ${o.local && o.status === 'выполнен' ? `<button class="btn btn-ghost btn-sm" data-regen="${o.rid}">Повторная генерация</button> ` : ''}
          ${o.status !== 'возврат' ? `<button class="btn btn-danger btn-sm" data-refund="${o.id}">Возврат</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;

  view.querySelectorAll('[data-regen]').forEach(btn => btn.addEventListener('click', () => {
    const r = results.get(btn.dataset.regen);
    if (r) { r.interpretation = null; results.save(r); }
    logAction(s.email, `повторная генерация для заказа результата ${btn.dataset.regen}`);
    toast('Интерпретация сброшена — пользователь сгенерирует заново без оплаты');
    orders(s);
  }));
  view.querySelectorAll('[data-refund]').forEach(btn => btn.addEventListener('click', () => {
    const map = store.get('admin.orderStatus', {});
    map[btn.dataset.refund] = 'возврат';
    store.set('admin.orderStatus', map);
    logAction(s.email, `возврат по заказу ${btn.dataset.refund} (демо)`);
    toast('Возврат оформлен (демо)');
    orders(s);
  }));
}

/* ================= КОНТЕНТ И SEO ================= */
const PAGES = [
  ['index.html', 'Главная'], ['catalog.html', 'Каталог'], ['about.html', 'О методике'],
  ['guide.html', 'Как читать профиль'], ['example.html', 'Пример разбора'], ['test.html', 'Прохождение теста'],
];
function content(s) {
  const seo = store.get('admin.seo', {});
  view.innerHTML = `
    ${section('Контент и SEO', 'А-04')}
    <p class="muted" style="max-width:70ch">SEO-поля применяются к страницам этого устройства при загрузке
      (в боевой версии — рендерятся сервером). Пустое поле — заводское значение.</p>
    <div class="table-frame"><table class="scale-table"><thead>
      <tr><th scope="col">Страница</th><th scope="col">Title</th><th scope="col">Description</th></tr>
    </thead><tbody>
      ${PAGES.map(([file, name]) => `<tr>
        <td><a href="${file}" target="_blank" rel="noopener">${name}</a><br><span class="small muted mono">${file}</span></td>
        <td><input class="admin-inline-input" data-seo="${file}:title" value="${esc(seo[file]?.title || '')}" placeholder="заводской title" aria-label="Title ${name}"></td>
        <td><input class="admin-inline-input" data-seo="${file}:description" value="${esc(seo[file]?.description || '')}" placeholder="заводское description" aria-label="Description ${name}"></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  view.querySelectorAll('[data-seo]').forEach(inp => inp.addEventListener('change', () => {
    const [file, field] = inp.dataset.seo.split(':');
    const map = store.get('admin.seo', {});
    map[file] = map[file] || {};
    if (inp.value.trim()) map[file][field] = inp.value.trim(); else delete map[file][field];
    store.set('admin.seo', map);
    logAction(s.email, `SEO ${file}: ${field}`);
    toast('SEO-поле сохранено');
  }));
}

/* ================= ПОЛЬЗОВАТЕЛИ ================= */
function users(s) {
  const base = [
    { email: 'anna.k@example.com', role: 'user', reg: '2026-06-02', passes: 3, paid: 1 },
    { email: 'dmitry.v@example.com', role: 'user', reg: '2026-06-18', passes: 1, paid: 0 },
    { email: 'editor@psychograph.example', role: 'editor', reg: '2026-05-11', passes: 7, paid: 2 },
    { email: 'maria.s@example.com', role: 'user', reg: '2026-07-09', passes: 2, paid: 1 },
  ];
  const blocked = store.get('admin.blocked', []);
  view.innerHTML = `
    ${section('Пользователи', 'А-05', '<span class="badge">демо-данные</span>')}
    <div class="table-frame"><table class="scale-table"><thead>
      <tr><th scope="col">E-mail</th><th scope="col">Роль</th><th scope="col">Регистрация</th><th scope="col">Прохождений</th><th scope="col">Покупок</th><th scope="col">Статус</th><th scope="col"></th></tr>
    </thead><tbody>
      ${base.map(u => {
        const isBlocked = blocked.includes(u.email);
        return `<tr style="${isBlocked ? 'opacity:.55' : ''}">
          <td>${esc(u.email)}</td>
          <td><span class="badge">${u.role === 'editor' ? 'редактор' : 'пользователь'}</span></td>
          <td class="num">${u.reg}</td>
          <td class="num">${u.passes}</td>
          <td class="num">${u.paid}</td>
          <td><span class="badge ${isBlocked ? 'badge-danger' : 'badge-ok'}">${isBlocked ? 'заблокирован' : 'активен'}</span></td>
          <td><button class="btn ${isBlocked ? 'btn-soft' : 'btn-danger'} btn-sm" data-block="${esc(u.email)}">${isBlocked ? 'Разблокировать' : 'Заблокировать'}</button></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
  view.querySelectorAll('[data-block]').forEach(btn => btn.addEventListener('click', () => {
    let list = store.get('admin.blocked', []);
    const email = btn.dataset.block;
    list = list.includes(email) ? list.filter(x => x !== email) : [...list, email];
    store.set('admin.blocked', list);
    logAction(s.email, `${list.includes(email) ? 'блокировка' : 'разблокировка'}: ${email}`);
    users(s);
  }));
}

/* ================= НАСТРОЙКИ ================= */
function settings(s) {
  const cfg = getSettings();
  view.innerHTML = `
    ${section('Настройки', 'А-06')}
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <h3>ИИ-анализ (DeepSeek)</h3>
        <label class="admin-row"><span>Модель</span><input class="admin-inline-input" id="set-model" value="${esc(cfg.deepseek.model)}"></label>
        <label class="admin-row"><span>Лимит токенов</span><input class="admin-num" type="number" id="set-tokens" value="${cfg.deepseek.maxTokens}" min="500" step="500"></label>
        <label class="field" style="display:block;margin-top:10px"><span class="small muted">Системный промпт (пусто — заводской)</span>
          <textarea id="set-prompt" rows="6" style="width:100%;margin-top:6px" placeholder="Ты — опытный клинический психолог…">${esc(cfg.deepseek.prompt)}</textarea></label>
        <p class="small muted">API-ключ в демо-версии хранится только у пользователя и вводится на странице анализа —
          в боевой версии ключ лежит на сервере.</p>
      </div>
      <div class="card">
        <h3>Платежи</h3>
        <label class="admin-row"><span>Цена интерпретации, ₽</span><input class="admin-num" type="number" id="set-price" value="${cfg.price}" min="0" step="10"></label>
        <p class="small muted">Применяется на странице анализа и в заказах. Эквайринг и чек 54-ФЗ — серверная часть, в демо имитируются.</p>
        <hr class="hr-hair">
        <button class="btn btn-primary" id="btn-save-settings">Сохранить настройки</button>
      </div>
    </div>`;
  $('btn-save-settings').addEventListener('click', () => {
    const next = {
      price: Math.max(0, Number($('set-price').value) || 499),
      deepseek: {
        model: $('set-model').value.trim() || 'deepseek-chat',
        maxTokens: Math.max(500, Number($('set-tokens').value) || 4000),
        prompt: $('set-prompt').value.trim(),
      },
    };
    saveSettings(next);
    logAction(s.email, `настройки: цена ${next.price} ₽, модель ${next.deepseek.model}`);
    toast('Настройки сохранены — применяются на странице анализа');
  });
}

/* ================= ЖУРНАЛ ================= */
function logView() {
  const log = getLog();
  view.innerHTML = `
    ${section('Журнал действий', 'А-07')}
    ${log.length ? `<div class="table-frame"><table class="scale-table"><thead>
      <tr><th scope="col">Когда</th><th scope="col">Кто</th><th scope="col">Действие</th></tr></thead>
      <tbody>${log.map(e => `<tr><td class="num" style="white-space:nowrap">${fmtDate(e.ts)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">Журнал пуст.</p>'}`;
}

boot();
