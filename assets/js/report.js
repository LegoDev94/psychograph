/* Сборка HTML расширенного разбора по интерпретационной библиотеке.
   Используется демо-режимом генерации (analysis.js) и страницей-примером (example.js). */
import { esc, fmtDate } from './common.js';
import { TEST as BASE_TEST } from '../data/mmil.js';
import { INTERP } from '../data/interp.js';
import { withOverride } from './test-store.js';
import { buildInterpretation } from './engine.js';

const TEST = withOverride(BASE_TEST);

export function buildDemoReportHtml(r, { example = false } = {}) {
  const { parts, combos } = buildInterpretation(INTERP, r, TEST.scales);
  const v = INTERP.validityNotes[r.validity.status] || '';
  const q = r.questionnaire || {};

  const ctx = [];
  if (q.goal) ctx.push(`цель обращения — ${q.goal.toLowerCase()}`);
  if (q.stress >= 4) ctx.push('высокий уровень стресса в последний месяц');
  if (q.sleep === 'Плохой' || q.sleep === 'Неровный') ctx.push(`${q.sleep.toLowerCase()} сон`);
  if (q.energy && q.energy <= 2) ctx.push('сниженный уровень энергии');
  if (q.support === 'Скорее нет' || q.support === 'Нет') ctx.push('дефицит ощущаемой поддержки');
  if (q.changes) ctx.push('значимые перемены последнего полугодия');

  const badge = example
    ? '<span class="badge badge-accent">пример отчёта</span>'
    : '<span class="stamp tag-demo">демо-движок</span>';
  let html = `<div class="overline"><span class="num">ИИ</span> Расширенная интерпретация ${badge}</div>`;
  html += `<h2 style="margin-bottom:4px">Разбор личностного профиля</h2>`;
  html += `<p class="muted small">${fmtDate(r.date)} · ${r.form === 'male' ? 'мужская' : 'женская'} форма · сгенерировано локальной интерпретационной библиотекой</p>`;
  if (example) {
    html += `<div class="callout"><p class="mb-0"><strong>Это обезличенный пример</strong> на условных демо-данных — так выглядит структура платного разбора. Ваш отчёт будет построен по вашему профилю и ответам уточняющего опросника.</p></div>`;
  }
  html += `<hr class="report-rule">`;
  html += `<p>${esc(INTERP.intro)}</p>`;
  if (v) html += `<div class="callout ${r.validity.status === 'ok' ? 'ok' : r.validity.status === 'caution' ? 'warn' : 'danger'}"><p class="mb-0">${esc(v)}</p></div>`;

  if (ctx.length) {
    html += `<h3>Ваш контекст</h3><p>Из уточняющего опросника: ${esc(ctx.join('; '))}. Этот фон стоит держать в уме — профиль отражает не только устойчивые черты, но и текущее состояние.</p>`;
  }

  if (r.validity.status === 'invalid') {
    // при недостоверном профиле пошкальный разбор некорректен — не выводим его
    html += `<h3>Почему разбор по шкалам не приводится</h3>
      <p>Оценочные показатели говорят о том, что профиль в этот раз получился недостоверным — например, из-за большого числа пропущенных утверждений, усталости или отвлечения. Интерпретировать значения шкал в такой ситуации было бы некорректно и нечестно по отношению к вам.</p>
      <p>Рекомендуем пройти тест повторно в спокойной обстановке, отвечая по первому впечатлению. Повторная генерация разбора для нового результата в демо-версии бесплатна.</p>`;
  } else {
    html += `<h3>Шкалы профиля</h3>`;
    for (const p of parts) {
      html += `<p><strong class="mono">${p.code} · T=${p.t}</strong> — <strong>${esc(p.name)}.</strong> ${esc(p.text)}</p>`;
    }

    if (combos.length) {
      html += `<h3>Сочетания шкал</h3>`;
      for (const c of combos) {
        html += `<p><strong class="mono">${c.scales.map(s => s.replace('-low', '↓')).join(' + ')}</strong> — ${esc(c.text)}</p>`;
      }
    }
  }

  if (q.strengths) html += `<h3>Опора</h3><p>Окружающие видят в вас: «${esc(q.strengths)}». Сильные стороны — рабочий материал самоисследования не меньше, чем зоны роста.</p>`;

  html += `<hr class="report-rule"><p>${esc(INTERP.outro)}</p>`;
  html += `<p class="small muted">${esc(INTERP.disclaimer)}</p>`;
  return html;
}
