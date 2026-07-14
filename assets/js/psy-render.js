/* Перьевой рендер профиля для страницы результатов: тот же визуальный язык,
   что у «живого психографа» в герое, но статичный — это документ-протокол.
   Плюс надёжный PNG-экспорт через canvas (шрифты страницы доступны, в отличие
   от растеризации SVG). Темизация SVG — через CSS-классы psy-*. */

import { tBand, BAND_LABELS } from './engine.js';

const VB = { w: 640, h: 400 };
const M = { l: 38, r: 16, t: 20, b: 34 };
const T_MIN = 20, T_MAX = 110;

const xAt = (i, n) => M.l + i * (VB.w - M.l - M.r) / (n - 1);
const yAt = t => M.t + (T_MAX - Math.max(T_MIN, Math.min(T_MAX, t))) / (T_MAX - T_MIN) * (VB.h - M.t - M.b);
const easeOut = p => 1 - Math.pow(1 - p, 3);

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** Статичная сцена + перьевая отрисовка + подсказка по наведению/тапу. */
export function mountResultProfile({ svg, stage, tip, scales, t }) {
  const n = scales.length;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  svg.innerHTML = '';

  /* сетка, коридор, оси */
  const gGrid = el('g');
  svg.appendChild(gGrid);
  gGrid.appendChild(el('rect', {
    x: M.l, y: yAt(70), width: VB.w - M.l - M.r, height: yAt(30) - yAt(70), class: 'psy-corridor',
  }));
  for (let v = 30; v <= 100; v += 10) {
    gGrid.appendChild(el('line', {
      x1: M.l, x2: VB.w - M.r, y1: yAt(v), y2: yAt(v),
      class: v === 50 ? 'psy-grid-mid' : 'psy-grid',
    }));
    if (v === 30 || v === 50 || v === 70 || v === 90) {
      const lbl = el('text', { x: M.l - 7, y: yAt(v) + 3, class: 'psy-axis-y', 'text-anchor': 'end' });
      lbl.textContent = v;
      gGrid.appendChild(lbl);
    }
  }
  scales.forEach((s, i) => {
    const lbl = el('text', { x: xAt(i, n), y: VB.h - 12, class: 'psy-axis-x', 'text-anchor': 'middle' });
    lbl.textContent = s.code;
    gGrid.appendChild(lbl);
  });
  const note = el('text', { x: VB.w - M.r - 6, y: yAt(70) + 14, class: 'psy-note', 'text-anchor': 'end' });
  note.textContent = 'коридор нормы 30–70';
  gGrid.appendChild(note);

  const crosshair = el('line', { class: 'psy-crosshair', y1: M.t, y2: VB.h - M.b, x1: -10, x2: -10, opacity: 0 });
  svg.appendChild(crosshair);

  /* линия и точки */
  const d = scales.map((s, i) => `${i ? 'L' : 'M'}${xAt(i, n).toFixed(1)},${yAt(t[s.code]).toFixed(1)}`).join('');
  const path = el('path', { class: 'psy-line', fill: 'none', d });
  svg.appendChild(path);

  const points = scales.map((s, i) => {
    const dot = el('circle', {
      class: 'psy-point', r: 4.4, opacity: reduced ? 1 : 0,
      cx: xAt(i, n), cy: yAt(t[s.code]),
    });
    svg.appendChild(dot);
    return dot;
  });

  /* выборочные подписи значений: только заметные отклонения */
  const valueLabels = el('g', { opacity: reduced ? 1 : 0 });
  scales.forEach((s, i) => {
    if (t[s.code] > 70 || t[s.code] < 30) {
      const lbl = el('text', {
        x: xAt(i, n), y: yAt(t[s.code]) - 11, class: 'psy-axis-y',
        'text-anchor': 'middle', 'font-weight': '500',
      });
      lbl.textContent = t[s.code];
      valueLabels.appendChild(lbl);
    }
  });
  svg.appendChild(valueLabels);

  /* перьевая отрисовка */
  if (!reduced) {
    const pen = el('circle', { class: 'psy-pen', r: 3.4, opacity: 1 });
    svg.appendChild(pen);
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    const t0 = performance.now(), dur = 1300;
    const shown = new Set();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOut(p);
      path.style.strokeDashoffset = String(len * (1 - e));
      const pt = path.getPointAtLength(len * e);
      pen.setAttribute('cx', pt.x);
      pen.setAttribute('cy', pt.y);
      points.forEach((dot, i) => {
        if (!shown.has(i) && pt.x >= xAt(i, n) - 1) {
          shown.add(i);
          dot.setAttribute('opacity', 1);
          dot.animate?.([{ r: 1 }, { r: 6.8 }, { r: 4.4 }], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1.4)' });
        }
      });
      if (p < 1) requestAnimationFrame(step);
      else {
        pen.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' });
        setTimeout(() => pen.remove(), 480);
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        valueLabels.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'forwards' });
        valueLabels.setAttribute('opacity', 1);
      }
    })(t0);
  }

  /* подсказка: наведение (мышь) или тап (тач) */
  function showAt(i) {
    if (i < 0) { hide(); return; }
    crosshair.setAttribute('x1', xAt(i, n));
    crosshair.setAttribute('x2', xAt(i, n));
    crosshair.setAttribute('opacity', 1);
    const s = scales[i];
    tip.innerHTML = `<b>${s.code}</b> · ${s.name} · <span class="mono">T=${t[s.code]}</span> <span style="opacity:.65">· ${BAND_LABELS[tBand(t[s.code])]}</span>`;
    tip.hidden = false;
    const xPct = xAt(i, n) / VB.w * 100;
    tip.style.left = Math.min(76, Math.max(10, xPct)) + '%';
    tip.style.top = (yAt(t[scales[i].code]) / VB.h * 100 - 11) + '%';
  }
  function hide() {
    crosshair.setAttribute('opacity', 0);
    tip.hidden = true;
  }
  function idxFromEvent(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * VB.w;
    if (px < M.l - 10 || px > VB.w - M.r + 10) return -1;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const dd = Math.abs(px - xAt(i, n));
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }
  let lastIdx = -1;
  if (finePointer) {
    stage.addEventListener('mousemove', e => showAt(idxFromEvent(e.clientX)));
    stage.addEventListener('mouseleave', hide);
  } else {
    stage.addEventListener('click', e => {
      const i = idxFromEvent(e.clientX);
      if (i === lastIdx) { hide(); lastIdx = -1; } else { showAt(i); lastIdx = i; }
    });
  }
}

/** PNG-экспорт: рисуем профиль заново на canvas — шрифты страницы доступны. */
export function exportProfilePNG({ scales, t, caption, subcaption }) {
  const css = getComputedStyle(document.documentElement);
  const v = name => css.getPropertyValue(name).trim();
  const colors = {
    paper: v('--paper'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'),
    hairline: v('--hairline-strong'), accent: v('--accent'), corridor: v('--corridor'),
  };
  const n = scales.length;
  const HEAD = 52, FOOT = 30;
  const W = VB.w, H = VB.h + HEAD + FOOT;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  const MONO = '"IBM Plex Mono", Consolas, monospace';
  const SERIF = '"STIX Two Text", Georgia, serif';

  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, W, H);

  /* шапка протокола */
  ctx.fillStyle = colors.ink;
  ctx.font = `700 20px ${SERIF}`;
  ctx.fillText('Психограф · ММИЛ — личностный профиль', 24, 30);
  ctx.fillStyle = colors.ink3;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(caption, 24, 46);
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, HEAD); ctx.lineTo(W - 24, HEAD); ctx.stroke();

  const oy = HEAD; // смещение области графика
  /* коридор и сетка */
  ctx.fillStyle = colors.corridor;
  ctx.fillRect(M.l, oy + yAt(70), W - M.l - M.r, yAt(30) - yAt(70));
  for (let val = 30; val <= 100; val += 10) {
    ctx.strokeStyle = v('--hairline');
    ctx.setLineDash(val === 50 ? [5, 5] : []);
    ctx.beginPath(); ctx.moveTo(M.l, oy + yAt(val)); ctx.lineTo(W - M.r, oy + yAt(val)); ctx.stroke();
    if (val === 30 || val === 50 || val === 70 || val === 90) {
      ctx.fillStyle = colors.ink3;
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(val), M.l - 7, oy + yAt(val) + 3);
    }
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.ink2;
  ctx.font = `11px ${MONO}`;
  scales.forEach((s, i) => ctx.fillText(s.code, xAt(i, n), oy + VB.h - 12));

  /* линия */
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  scales.forEach((s, i) => {
    const px = xAt(i, n), py = oy + yAt(t[s.code]);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();

  /* точки и подписи отклонений */
  scales.forEach((s, i) => {
    const px = xAt(i, n), py = oy + yAt(t[s.code]);
    ctx.fillStyle = colors.paper;
    ctx.beginPath(); ctx.arc(px, py, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.beginPath(); ctx.arc(px, py, 4.4, 0, Math.PI * 2); ctx.fill();
    if (t[s.code] > 70 || t[s.code] < 30) {
      ctx.fillStyle = colors.ink;
      ctx.font = `500 11px ${MONO}`;
      ctx.fillText(String(t[s.code]), px, py - 11);
    }
  });

  /* подвал */
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.ink3;
  ctx.font = `10px ${MONO}`;
  ctx.fillText(subcaption, 24, H - 12);

  return canvas.toDataURL('image/png');
}
