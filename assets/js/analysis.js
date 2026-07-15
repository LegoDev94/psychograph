/* ИИ-анализ (M4) + демо-оплата (M5): опросник 15 вопросов → оплата → генерация → отчёт */
import { initChrome, results, fmtDate, toast, esc, openModal } from './common.js';
import { TEST as BASE_TEST } from '../data/mmil.js';
import { INTERP } from '../data/interp.js';
import { withOverride, getSettings } from './test-store.js';
import { buildDemoReportHtml } from './report.js';

const TEST = withOverride(BASE_TEST);
const SETTINGS = getSettings();

initChrome('history');

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const rid = params.get('rid');
const result = rid ? results.get(rid) : results.list()[0];

if (!result) {
  $('analysis-root').hidden = true;
  $('no-result').hidden = false;
} else {
  init(result);
}

/* ---------- опросник: 15 вопросов (в боевой версии редактируется в админке) ---------- */
const Q15 = [
  { id: 'goal', type: 'select', label: 'С какой целью вы проходите тест?', options: ['Самопознание', 'Понять эмоциональное состояние', 'Вопросы отношений', 'Работа и карьера', 'Рекомендация специалиста', 'Любопытство'] },
  { id: 'concern', type: 'text', label: 'Что сейчас беспокоит больше всего? (свободный ответ)' },
  { id: 'stress', type: 'scale', label: 'Уровень стресса за последний месяц', low: 'минимальный', high: 'очень высокий' },
  { id: 'sleep', type: 'radio', label: 'Как вы оцениваете свой сон?', options: ['Хороший', 'Неровный', 'Плохой'] },
  { id: 'energy', type: 'scale', label: 'Уровень энергии в последние недели', low: 'совсем нет сил', high: 'энергии много' },
  { id: 'changes', type: 'text', label: 'Были ли значимые перемены за последние полгода? Какие?' },
  { id: 'occupation', type: 'select', label: 'Чем вы заняты?', options: ['Работаю', 'Учусь', 'Работаю и учусь', 'Сейчас не работаю', 'В отпуске / декрете'] },
  { id: 'satisfaction', type: 'scale', label: 'Удовлетворённость работой / учёбой', low: 'совсем нет', high: 'полностью' },
  { id: 'relations', type: 'select', label: 'Близкие отношения', options: ['В браке / постоянных отношениях', 'Не в отношениях', 'Всё сложно', 'Предпочту не отвечать'] },
  { id: 'support', type: 'radio', label: 'Есть ли рядом люди, которые поддержат?', options: ['Да', 'Скорее да', 'Скорее нет', 'Нет'] },
  { id: 'activity', type: 'radio', label: 'Физическая активность', options: ['Регулярная', 'Время от времени', 'Почти нет'] },
  { id: 'therapy', type: 'radio', label: 'Обращались ли раньше к психологу?', options: ['Да', 'Нет'] },
  { id: 'change', type: 'text', label: 'Что вам хотелось бы изменить в себе или своей жизни?' },
  { id: 'strengths', type: 'text', label: 'Какие сильные стороны в вас отмечают окружающие?' },
  { id: 'expect', type: 'select', label: 'Чего вы ждёте от разбора?', options: ['Лучше понять себя', 'Конкретные шаги', 'Подтвердить или развеять догадки', 'Взгляд со стороны'] },
];

function renderQ15(saved = {}) {
  $('q15-form').innerHTML = Q15.map((q, i) => {
    const idx = `<span class="idx">${String(i + 1).padStart(2, '0')}</span>`;
    if (q.type === 'text') {
      return `<div class="q15-item"><label class="q-label" for="q-${q.id}">${idx}${q.label}</label>
        <textarea id="q-${q.id}" name="${q.id}" maxlength="600">${esc(saved[q.id] || '')}</textarea></div>`;
    }
    if (q.type === 'select') {
      return `<div class="q15-item"><label class="q-label" for="q-${q.id}">${idx}${q.label}</label>
        <select id="q-${q.id}" name="${q.id}"><option value="">— не отвечать —</option>
        ${q.options.map(o => `<option ${saved[q.id] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    }
    if (q.type === 'scale') {
      return `<fieldset class="q15-item" style="border:none;margin:0;padding:0"><legend class="q-label" style="padding:0">${idx}${q.label}
        <span class="small muted">(1 — ${q.low}, 5 — ${q.high})</span></legend>
        <div class="radio-line">${[1, 2, 3, 4, 5].map(v =>
          `<label><input type="radio" name="${q.id}" value="${v}" ${String(saved[q.id]) === String(v) ? 'checked' : ''}>${v}</label>`).join('')}</div></fieldset>`;
    }
    return `<fieldset class="q15-item" style="border:none;margin:0;padding:0"><legend class="q-label" style="padding:0">${idx}${q.label}</legend>
      <div class="radio-line">${q.options.map(o =>
        `<label><input type="radio" name="${q.id}" value="${esc(o)}" ${saved[q.id] === o ? 'checked' : ''}>${o}</label>`).join('')}</div></fieldset>`;
  }).join('');
}

function collectQ15() {
  const data = {};
  const form = $('q15-form');
  for (const q of Q15) {
    if (q.type === 'text' || q.type === 'select') {
      const v = form.querySelector(`[name="${q.id}"]`)?.value?.trim();
      if (v) data[q.id] = v;
    } else {
      const v = form.querySelector(`[name="${q.id}"]:checked`)?.value;
      if (v) data[q.id] = v;
    }
  }
  return data;
}

/* ---------- визард ---------- */
const steps = ['step-q15', 'step-pay', 'step-generate', 'step-report'];
function showStep(name) {
  for (const s of steps) $(s).hidden = s !== name;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = $(name).querySelector('h3, h2, .ai-report');
  if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
}

function init(r) {
  /* цена управляется в админ-панели (демо M8) */
  $('pay-price').textContent = `${SETTINGS.price} ₽`;
  $('modal-price').textContent = `${SETTINGS.price} ₽`;

  const formLabel = r.form === 'male' ? 'мужская форма' : 'женская форма';
  $('analysis-meta').textContent = `Профиль от ${fmtDate(r.date)} (${formLabel}). Разбор строится на T-баллах, флагах достоверности и ответах опросника — данные передаются без имени и контактов.`;

  if (r.interpretation) { renderReport(r); showStep('step-report'); return; }

  renderQ15(r.questionnaire || {});
  showStep(r.paid ? 'step-generate' : 'step-q15');

  $('btn-to-pay').addEventListener('click', () => {
    r.questionnaire = collectQ15();
    results.save(r);
    showStep(r.paid ? 'step-generate' : 'step-pay'); // идемпотентность: одна оплата — одна генерация
    toast('Ответы опросника сохранены');
  });
  $('btn-back-q15').addEventListener('click', () => showStep('step-q15'));

  /* предупреждение о достоверности до оплаты (обещано офертой) */
  if (r.validity.status !== 'ok') {
    const note = document.createElement('div');
    note.className = 'callout ' + (r.validity.status === 'invalid' ? 'danger' : 'warn');
    note.style.marginBottom = '18px';
    note.innerHTML = r.validity.status === 'invalid'
      ? '<p class="mb-0"><strong>Обратите внимание до оплаты:</strong> профиль отмечен как сомнительный по оценочным шкалам — развёрнутая интерпретация по шкалам будет ограничена. Рекомендуем сначала пройти тест повторно.</p>'
      : '<p class="mb-0"><strong>Обратите внимание до оплаты:</strong> по оценочным шкалам профиль следует интерпретировать с осторожностью — это будет учтено в разборе.</p>';
    $('step-pay').querySelector('.card').prepend(note);
  }

  const modal = $('pay-modal');
  const confirmPay = () => {
    r.paid = true;
    r.paidAt = Date.now();
    results.save(r);
    toast('Оплата подтверждена (демо) — доступ к генерации открыт');
    showStep('step-generate');
  };
  $('btn-pay').addEventListener('click', () => {
    if (!openModal(modal)) {
      if (window.confirm(`Демо-режим: имитировать успешную оплату ${SETTINGS.price} ₽?`)) confirmPay();
    }
  });
  $('pay-cancel').addEventListener('click', () => modal.close());
  $('pay-confirm').addEventListener('click', () => { modal.close(); confirmPay(); });

  /* режим генерации */
  let mode = 'demo';
  const pick = (m) => {
    mode = m;
    $('mode-demo').classList.toggle('selected', m === 'demo');
    $('mode-demo').setAttribute('aria-pressed', String(m === 'demo'));
    $('mode-deepseek').classList.toggle('selected', m === 'deepseek');
    $('mode-deepseek').setAttribute('aria-pressed', String(m === 'deepseek'));
    $('deepseek-key-row').hidden = m !== 'deepseek';
  };
  $('mode-demo').addEventListener('click', () => pick('demo'));
  $('mode-deepseek').addEventListener('click', () => pick('deepseek'));

  $('btn-generate').addEventListener('click', async () => {
    if (!r.paid) { toast('Сначала подтвердите оплату'); return; }
    $('btn-generate').disabled = true;
    $('gen-status').hidden = false;

    const status = txt => { $('gen-status-text').textContent = txt; };
    const wait = ms => new Promise(res => setTimeout(res, ms));

    try {
      status('Заказ подтверждён — задача поставлена в очередь…');
      await wait(900);
      status('Профиль обезличен: T-баллы, флаги достоверности, ответы опросника…');
      await wait(900);

      let html;
      if (mode === 'deepseek') {
        status('Запрос к DeepSeek (deepseek-chat)… это может занять до минуты');
        html = await generateDeepSeek(r);
      } else {
        status('Демо-движок формирует разбор по интерпретационной библиотеке…');
        await wait(1100);
        html = buildDemoReportHtml(r);
      }

      r.interpretation = { html, mode, createdAt: Date.now() };
      results.save(r);
      renderReport(r, true); // свежесгенерированный отчёт «печатается» блок за блоком
      showStep('step-report');
      toast('Интерпретация готова и сохранена в истории');
    } catch (err) {
      $('gen-status').hidden = true;
      $('btn-generate').disabled = false;
      toast('Ошибка генерации: ' + err.message + ' — попробуйте ещё раз или демо-режим', 6000);
    }
  });
}

/* ---------- живой вызов DeepSeek (BYO-ключ; в боевой версии — сервер + очередь) ---------- */
async function generateDeepSeek(r) {
  const key = $('deepseek-key').value.trim();
  if (!key) throw new Error('введите API-ключ DeepSeek');

  const anonymized = {
    methodology: 'MMIL (russian MMPI adaptation), demo item bank',
    form: r.form,
    t_scores: r.t,
    validity: { status: r.validity.status, flags: r.validity.flags.map(f => f.code), unknown_answers: r.unknown },
    questionnaire: r.questionnaire || {},
  };

  /* промпт, модель и лимиты настраиваются в админ-панели (M4/M8) */
  const system = SETTINGS.deepseek.prompt || `Ты — опытный клинический психолог. Составь развёрнутую, бережную интерпретацию личностного профиля по методике ММИЛ (адаптация MMPI) на русском языке.
Правила: не ставь диагнозов и не используй ярлыки; формулировки «может указывать», «часто отражает»; T-баллы 30–70 — коридор нормы, 60–70 — акцентуация, >70 — выраженное повышение; учитывай флаги достоверности и контекст опросника; структура: краткое вступление, разбор значимых шкал, сочетания шкал, ресурсы и бережные рекомендации, завершение; в конце обязательно укажи, что результат не является медицинским диагнозом. Форматируй markdown с заголовками ##.`;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: SETTINGS.deepseek.model || 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Обезличенные данные тестирования:\n' + JSON.stringify(anonymized, null, 2) },
      ],
      temperature: 0.7,
      max_tokens: SETTINGS.deepseek.maxTokens || 4000,
    }),
  }).catch(() => { throw new Error('сеть/CORS недоступны — в боевой версии вызов выполняет сервер'); });

  if (!res.ok) {
    const t = res.status === 401 ? 'неверный API-ключ' : res.status === 402 ? 'недостаточно средств на балансе DeepSeek' : 'HTTP ' + res.status;
    throw new Error(t);
  }
  const data = await res.json();
  const md = data.choices?.[0]?.message?.content;
  if (!md) throw new Error('пустой ответ модели');

  let html = `<div class="overline"><span class="num">ИИ</span> Расширенная интерпретация <span class="badge badge-accent">deepseek-chat</span></div>`;
  html += `<h2 style="margin-bottom:4px">Разбор личностного профиля</h2>`;
  html += `<p class="muted small">${fmtDate(r.date)} · ${r.form === 'male' ? 'мужская' : 'женская'} форма · сгенерировано DeepSeek API</p><hr class="report-rule">`;
  html += mdToHtml(md);
  html += `<p class="small muted">${esc(INTERP.disclaimer)}</p>`;
  return html;
}

/* минимальный markdown → HTML (заголовки, жирный, курсив, списки, абзацы) */
function mdToHtml(md) {
  const blocks = esc(md).replace(/\r/g, '').split(/\n{2,}/);
  return blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^#{2,4}\s/.test(b)) return '<h3>' + inline(b.replace(/^#{2,4}\s*/, '')) + '</h3>';
    if (/^[-*]\s/m.test(b)) {
      const items = b.split('\n').filter(l => /^[-*]\s/.test(l)).map(l => '<li>' + inline(l.replace(/^[-*]\s*/, '')) + '</li>').join('');
      return '<ul>' + items + '</ul>';
    }
    return '<p>' + inline(b.replace(/\n/g, '<br>')) + '</p>';
  }).join('\n');
  function inline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  }
}

/* ---------- отчёт ---------- */
function renderReport(r, animate = false) {
  const body = $('report-body');
  body.innerHTML = r.interpretation.html;
  $('btn-report-back').href = 'results.html?rid=' + r.id;
  $('btn-report-pdf').addEventListener('click', () => {
    toast('В диалоге печати выберите «Сохранить как PDF»');
    setTimeout(() => window.print(), 600);
  });

  /* эффект «печати»: блоки отчёта проявляются друг за другом */
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches && body.animate) {
    Array.from(body.children).forEach((block, i) => {
      const delay = Math.min(i * 110, 1900);
      block.style.opacity = '0';
      const anim = block.animate(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, delay, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' }
      );
      anim.onfinish = () => { block.style.opacity = ''; };
    });
  }
}
