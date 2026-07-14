/* История результатов: список, мини-профили SVG, удаление, экспорт */
import { initChrome, results, fmtDate, toast } from './common.js';
import { TEST } from '../data/mmil.js';

initChrome('history');

const $ = id => document.getElementById(id);

function miniProfileSVG(t) {
  const codes = TEST.scales.map(s => s.code);
  const w = 150, h = 44, pad = 4;
  const x = i => pad + i * (w - 2 * pad) / (codes.length - 1);
  const y = v => h - pad - (Math.max(20, Math.min(110, v)) - 20) / 90 * (h - 2 * pad);
  const pts = codes.map((c, i) => `${x(i).toFixed(1)},${y(t[c]).toFixed(1)}`).join(' ');
  const yTop = y(70), yBottom = y(30);
  return `<svg class="mini-profile" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <rect x="${pad}" y="${yTop.toFixed(1)}" width="${w - 2 * pad}" height="${(yBottom - yTop).toFixed(1)}" fill="var(--corridor)"/>
    <line x1="${pad}" x2="${w - pad}" y1="${y(50).toFixed(1)}" y2="${y(50).toFixed(1)}" stroke="var(--corridor-line)" stroke-dasharray="3 3" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function render() {
  const list = results.list();
  $('history-empty').hidden = list.length > 0;
  $('history-actions').hidden = list.length === 0;
  $('history-list').innerHTML = list.map(r => {
    const clinical = TEST.scales.filter(s => s.group === 'clinical');
    const peaks = clinical.filter(s => r.t[s.code] > 65).map(s => s.code);
    const vBadge = { ok: '<span class="badge badge-ok">достоверен</span>', caution: '<span class="badge badge-warn">с осторожностью</span>', invalid: '<span class="badge badge-danger">сомнителен</span>' }[r.validity.status] || '';
    return `<div class="card history-item">
      ${miniProfileSVG(r.t)}
      <div class="info">
        <b>${fmtDate(r.date)}</b> · <span class="muted">${r.form === 'male' ? 'мужская' : 'женская'} форма</span><br>
        <span class="small muted">${peaks.length ? 'пики: ' + peaks.map(p => `<b class="mono">${p}</b>`).join(', ') : 'профиль в коридоре нормы'}</span>
        <span style="margin-left:8px">${vBadge}</span>
        ${r.interpretation ? '<span class="badge badge-accent" style="margin-left:6px">ИИ-разбор готов</span>' : ''}
      </div>
      <div class="actions">
        <a class="btn btn-soft btn-sm" href="results.html?rid=${r.id}">Профиль</a>
        <a class="btn btn-ghost btn-sm" href="analysis.html?rid=${r.id}">${r.interpretation ? 'ИИ-разбор' : 'ИИ-анализ'}</a>
        <button class="btn btn-danger btn-sm" data-del="${r.id}">Удалить</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => confirmDialog(
      'Удалить результат?',
      'Профиль, ответы и интерпретация этой попытки будут удалены безвозвратно.',
      () => { results.remove(btn.dataset.del); render(); toast('Результат удалён'); }
    ));
  });
}

function confirmDialog(title, text, onOk) {
  const modal = $('confirm-modal');
  if (typeof modal.showModal !== 'function') {
    if (window.confirm(title + '\n' + text)) onOk();
    return;
  }
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  const okBtn = $('confirm-ok');
  const fresh = okBtn.cloneNode(true);
  okBtn.replaceWith(fresh);
  fresh.addEventListener('click', () => { modal.close(); onOk(); });
  $('confirm-cancel').onclick = () => modal.close();
  modal.showModal();
}

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(results.list(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'psychograph-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Данные выгружены в JSON');
});

$('btn-clear').addEventListener('click', () => confirmDialog(
  'Удалить все данные?',
  'Все результаты, ответы и интерпретации будут стёрты с этого устройства. Действие необратимо.',
  () => { for (const r of results.list()) results.remove(r.id); render(); toast('Все данные удалены'); }
));

render();
