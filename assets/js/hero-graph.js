/* «Живой психограф» — интерактивный герой-график.
   Самописец: перьевая отрисовка при загрузке, дыхание линии, циклическая смена
   образцов профилей, реакция на курсор и мини-демо из 3 утверждений с морфингом.
   Без зависимостей; темизация через CSS-переменные (SVG-классы). */

const CODES = ['L', 'F', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NAMES = {
  L: 'шкала лжи', F: 'достоверность', K: 'коррекция',
  1: 'соматизация тревоги', 2: 'тревога, сниженный фон', 3: 'вытеснение',
  4: 'импульсивность', 5: 'муж./жен. черты', 6: 'ригидность',
  7: 'фиксация тревоги', 8: 'аутизация', 9: 'активность', 0: 'интроверсия',
};

/* образцы профилей для холостого цикла */
const ARCHETYPES = [
  { label: 'обр. № 01 · «уравновешенный»', t: [48, 50, 54, 49, 51, 52, 50, 53, 49, 52, 50, 55, 48] },
  { label: 'обр. № 02 · «тревожно-мнительный»', t: [50, 56, 46, 58, 68, 55, 45, 52, 57, 72, 60, 42, 62] },
  { label: 'обр. № 03 · «энергичный»', t: [46, 49, 52, 44, 40, 50, 66, 55, 52, 45, 50, 70, 38] },
  { label: 'обр. № 04 · «сдержанный интроверт»', t: [54, 46, 61, 52, 56, 42, 44, 50, 55, 54, 58, 41, 68] },
];

/* мини-демо: 3 утверждения и их «игрушечные» сдвиги профиля */
const QUIZ = [
  {
    text: 'Перед важным делом я перепроверяю всё по несколько раз.',
    v: { 7: 9, 2: 3, K: -2 }, f: { 7: -6, 9: 3 }, u: { 7: 2 },
  },
  {
    text: 'Мне легко начать разговор с незнакомым человеком.',
    v: { 0: -8, 9: 5, 3: 2 }, f: { 0: 8, 2: 3 }, u: { 0: 2 },
  },
  {
    text: 'Обычно я просыпаюсь полным сил и планов.',
    v: { 9: 7, 2: -5 }, f: { 2: 7, 1: 3, 9: -4 }, u: { 2: 2 },
  },
];

/* геометрия */
const VB = { w: 640, h: 380 };
const M = { l: 36, r: 14, t: 20, b: 32 };
const T_MIN = 20, T_MAX = 110;

const xAt = i => M.l + i * (VB.w - M.l - M.r) / (CODES.length - 1);
const yAt = t => M.t + (T_MAX - t) / (T_MAX - T_MIN) * (VB.h - M.t - M.b);
const clampT = t => Math.max(32, Math.min(84, t));
const easeInOut = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = p => 1 - Math.pow(1 - p, 3);

const SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function initHeroGraph(ids = {}) {
  const svg = document.getElementById(ids.svg || 'psy-svg');
  if (!svg) return;
  const stage = document.getElementById(ids.stage || 'psy-stage');
  const tipEl = document.getElementById(ids.tip || 'psy-tip');
  const archetypeEl = document.getElementById(ids.archetype || 'psy-archetype');
  const frame = document.getElementById(ids.frame || 'psy-frame');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* ---------- статичная сцена ---------- */
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  const gGrid = el('g');
  svg.appendChild(gGrid);

  gGrid.appendChild(el('rect', {
    x: M.l, y: yAt(70), width: VB.w - M.l - M.r, height: yAt(30) - yAt(70),
    class: 'psy-corridor',
  }));
  for (let t = 30; t <= 100; t += 10) {
    gGrid.appendChild(el('line', {
      x1: M.l, x2: VB.w - M.r, y1: yAt(t), y2: yAt(t),
      class: t === 50 ? 'psy-grid-mid' : 'psy-grid',
    }));
    if (t <= 90 && t % 20 === 10 || t === 30) {
      const lbl = el('text', { x: M.l - 7, y: yAt(t) + 3, class: 'psy-axis-y', 'text-anchor': 'end' });
      lbl.textContent = t;
      gGrid.appendChild(lbl);
    }
  }
  CODES.forEach((c, i) => {
    const lbl = el('text', { x: xAt(i), y: VB.h - 10, class: 'psy-axis-x', 'text-anchor': 'middle' });
    lbl.textContent = c;
    gGrid.appendChild(lbl);
  });
  const corridorNote = el('text', { x: VB.w - M.r - 6, y: yAt(70) + 14, class: 'psy-note', 'text-anchor': 'end' });
  corridorNote.textContent = 'коридор нормы 30–70';
  gGrid.appendChild(corridorNote);

  const crosshair = el('line', { class: 'psy-crosshair', y1: M.t, y2: VB.h - M.b, x1: -10, x2: -10, opacity: 0 });
  svg.appendChild(crosshair);

  const path = el('path', { class: 'psy-line', fill: 'none' });
  svg.appendChild(path);

  const gPoints = el('g');
  svg.appendChild(gPoints);
  const points = CODES.map((c, i) => {
    const halo = el('circle', { class: 'psy-point-halo', r: 11, opacity: 0 });
    const dot = el('circle', { class: 'psy-point', r: 4.2, opacity: 0 });
    gPoints.appendChild(halo);
    gPoints.appendChild(dot);
    return { dot, halo };
  });

  const pen = el('circle', { class: 'psy-pen', r: 3.4, opacity: 0 });
  svg.appendChild(pen);

  /* ---------- состояние ---------- */
  let current = ARCHETYPES[0].t.slice();  // текущие значения (без дыхания)
  let from = current.slice();
  let target = current.slice();
  let morphStart = -1;
  let morphDur = 950;
  let breatheAmp = reduced ? 0 : 1;
  let hoverIdx = -1;
  let quizStarted = false;
  let running = true;
  let drawing = false;   // на время перьевой отрисовки основной цикл не трогает путь
  let pausedAt = 0;      // для корректного продолжения морфа после паузы вне вьюпорта
  const phases = CODES.map((_, i) => i * 1.7 + Math.random() * 2);

  function displayed(i, now) {
    const b = breatheAmp * Math.sin(now / 1400 + phases[i]) * 1.15;
    return current[i] + b;
  }

  function pathD(vals) {
    return vals.map((t, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(t).toFixed(1)}`).join('');
  }

  function renderFrame(now) {
    if (drawing) return;
    if (morphStart >= 0) {
      const p = Math.min(1, (now - morphStart) / morphDur);
      const e = easeInOut(p);
      current = from.map((f, i) => f + (target[i] - f) * e);
      if (p >= 1) morphStart = -1;
    }
    const vals = CODES.map((_, i) => displayed(i, now));
    path.setAttribute('d', pathD(vals));
    vals.forEach((t, i) => {
      const x = xAt(i), y = yAt(t);
      points[i].dot.setAttribute('cx', x);
      points[i].dot.setAttribute('cy', y);
      points[i].dot.setAttribute('r', i === hoverIdx ? 6 : 4.2);
      points[i].halo.setAttribute('cx', x);
      points[i].halo.setAttribute('cy', y);
      points[i].halo.setAttribute('opacity', i === hoverIdx ? 0.35 : 0);
    });
    if (hoverIdx >= 0) updateTip(hoverIdx); // подсказка следует за морфом/дыханием
  }

  function loop(now) {
    if (running) renderFrame(now);
    requestAnimationFrame(loop);
  }

  function morphTo(vals, dur = 950) {
    from = current.slice();
    target = vals.map(clampT);
    morphDur = reduced ? 1 : dur;
    morphStart = performance.now();
  }

  /* ---------- перьевая отрисовка при появлении ---------- */
  function drawOn(done) {
    path.setAttribute('d', pathD(current));
    const len = path.getTotalLength();
    if (reduced) {
      points.forEach(p => p.dot.setAttribute('opacity', 1));
      done();
      return;
    }
    drawing = true; // замораживаем основной цикл: len должен оставаться валидным
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    pen.setAttribute('opacity', 1);
    const t0 = performance.now(), dur = 1500;
    const shown = new Set();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOut(p);
      path.style.strokeDashoffset = String(len * (1 - e));
      const pt = path.getPointAtLength(len * e);
      pen.setAttribute('cx', pt.x);
      pen.setAttribute('cy', pt.y);
      CODES.forEach((_, i) => {
        if (!shown.has(i) && pt.x >= xAt(i) - 1) {
          shown.add(i);
          points[i].dot.setAttribute('opacity', 1);
          points[i].dot.animate?.(
            [{ r: 1 }, { r: 6.5 }, { r: 4.2 }],
            { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1.4)' }
          );
        }
      });
      if (p < 1) requestAnimationFrame(step);
      else {
        pen.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
        setTimeout(() => pen.setAttribute('opacity', 0), 520);
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        drawing = false;
        done();
      }
    })(t0);
  }

  /* ---------- холостой цикл образцов ---------- */
  let archIdx = 0;
  let cycleTimer = null;
  function setArchetypeLabel(text) {
    if (!archetypeEl) return;
    archetypeEl.classList.remove('swap');
    void archetypeEl.offsetWidth; // перезапуск CSS-анимации
    archetypeEl.textContent = text;
    archetypeEl.classList.add('swap');
  }
  function startCycle() {
    stopCycle();
    cycleTimer = setInterval(() => {
      if (document.hidden || quizStarted || !running) return;
      archIdx = (archIdx + 1) % ARCHETYPES.length;
      setArchetypeLabel(ARCHETYPES[archIdx].label);
      morphTo(ARCHETYPES[archIdx].t, 1300);
    }, 5200);
  }
  function stopCycle() { if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; } }

  /* пауза вне вьюпорта; морф продолжается с места остановки, а не прыгает */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;
      if (!visible && running) pausedAt = performance.now();
      if (visible && !running && morphStart >= 0) morphStart += performance.now() - pausedAt;
      running = visible;
    }, { threshold: 0.05 }).observe(svg);
  }

  /* ---------- курсор/тач: перекрестие и подсказка ---------- */
  function updateTip(i) {
    if (!tipEl) return;
    const code = CODES[i];
    tipEl.innerHTML = `<b>${code}</b> · ${NAMES[code]} · <span class="mono">T=${Math.round(current[i])}</span>`;
    tipEl.hidden = false;
    const xPct = xAt(i) / VB.w * 100;
    tipEl.style.left = Math.min(78, Math.max(8, xPct)) + '%';
    tipEl.style.top = (yAt(current[i]) / VB.h * 100 - 13) + '%';
  }
  function pointFromEvent(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width * VB.w;
    if (px < M.l - 10 || px > VB.w - M.r + 10) return -1;
    let best = 0, bestD = Infinity;
    CODES.forEach((_, i) => {
      const d = Math.abs(px - xAt(i));
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  function showAt(i) {
    if (i < 0) { hideTip(); return; }
    hoverIdx = i;
    crosshair.setAttribute('x1', xAt(i));
    crosshair.setAttribute('x2', xAt(i));
    crosshair.setAttribute('opacity', 1);
    updateTip(i);
  }
  if (stage && tipEl) {
    if (finePointer) {
      stage.addEventListener('mousemove', e => showAt(pointFromEvent(e.clientX)));
      stage.addEventListener('mouseleave', hideTip);
    } else {
      /* тач: тап по графику показывает значение, повторный тап рядом — скрывает */
      stage.addEventListener('click', e => {
        const i = pointFromEvent(e.clientX);
        if (i === hoverIdx) hideTip(); else showAt(i);
      });
    }
  }
  function hideTip() {
    hoverIdx = -1;
    crosshair.setAttribute('opacity', 0);
    if (tipEl) tipEl.hidden = true;
  }

  /* ---------- лёгкий наклон рамки за курсором (без transition во время слежения) ---------- */
  if (finePointer && !reduced && frame) {
    const hero = frame.closest('.hero') || frame.parentElement;
    hero.addEventListener('mousemove', e => {
      const r = frame.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      frame.style.transition = 'box-shadow 0.25s ease';
      frame.style.transform = `perspective(1100px) rotateY(${dx * 1.6}deg) rotateX(${-dy * 1.2}deg)`;
    });
    hero.addEventListener('mouseleave', () => {
      frame.style.transition = 'transform 0.35s ease, box-shadow 0.25s ease';
      frame.style.transform = '';
    });
  }

  /* ---------- всплывающие метки сдвигов ---------- */
  function floatDeltas(deltas) {
    if (!stage || reduced) return;
    for (const [code, d] of Object.entries(deltas)) {
      const i = CODES.indexOf(code);
      if (i < 0) continue;
      const span = document.createElement('span');
      span.className = 'psy-delta ' + (d > 0 ? 'up' : 'down');
      span.textContent = (d > 0 ? '+' : '') + d;
      span.style.left = (xAt(i) / VB.w * 100) + '%';
      span.style.top = (yAt(target[i]) / VB.h * 100) + '%';
      stage.appendChild(span);
      setTimeout(() => span.remove(), 1400);
    }
  }

  /* ---------- мини-демо из 3 утверждений ---------- */
  const quizStep = document.getElementById(ids.quizStep || 'psy-quiz-step');
  const quizBody = document.getElementById(ids.quizBody || 'psy-quiz-body');
  let step = 0;
  let sketch = null;

  function renderQuizStep() {
    const q = document.getElementById('psy-quiz-q'); // элемент пересоздаётся при сбросе
    if (q) q.textContent = QUIZ[step].text;
    if (quizStep) quizStep.textContent = `${step + 1} / ${QUIZ.length}`;
  }

  function answer(kind) {
    if (!quizStarted) {
      quizStarted = true;
      stopCycle();
      sketch = current.map(v => v);
      setArchetypeLabel('ваш набросок · запись…');
    }
    const deltas = QUIZ[step][kind] || {};
    sketch = sketch.map((v, i) => clampT(v + (deltas[CODES[i]] || 0)));
    morphTo(sketch, 850);
    floatDeltas(deltas);
    step++;
    if (step < QUIZ.length) {
      renderQuizStep();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    setArchetypeLabel('ваш набросок · 3 ответа из 377');
    if (!quizBody) return;
    quizBody.innerHTML = `
      <p class="psy-quiz-done"><strong>Профиль дрогнул уже от трёх ответов.</strong>
      Настоящая картина складывается из ${'377'} утверждений, ключей и норм по полу — и она бесплатна.</p>
      <div class="psy-quiz-cta">
        <a class="btn btn-primary" href="test.html">Построить настоящий профиль</a>
        <button class="btn btn-ghost btn-sm" type="button" id="psy-quiz-restart">Сбросить</button>
      </div>`;
    document.getElementById('psy-quiz-restart')?.addEventListener('click', resetQuiz);
    quizBody.querySelector('a.btn')?.focus({ preventScroll: true }); // фокус не теряется при перестройке
  }

  function resetQuiz() {
    step = 0;
    quizStarted = false;
    sketch = null;
    if (quizBody) {
      quizBody.innerHTML = `
        <p class="psy-quiz-q" id="psy-quiz-q"></p>
        <div class="psy-quiz-answers" role="group" aria-label="Ответ на утверждение">
          <button class="answer-btn" type="button" data-a="v">Верно</button>
          <button class="answer-btn" type="button" data-a="f">Неверно</button>
          <button class="answer-btn" type="button" data-a="u">Не знаю</button>
        </div>`;
      bindQuiz();
      quizBody.querySelector('[data-a]')?.focus({ preventScroll: true });
    }
    setArchetypeLabel(ARCHETYPES[archIdx].label);
    morphTo(ARCHETYPES[archIdx].t, 900);
    if (!reduced) startCycle();
  }

  function bindQuiz() {
    quizBody?.querySelectorAll('[data-a]').forEach(btn =>
      btn.addEventListener('click', () => answer(btn.dataset.a)));
    renderQuizStep();
  }

  /* ---------- запуск ---------- */
  bindQuiz();
  requestAnimationFrame(loop);
  drawOn(() => { if (!reduced) startCycle(); });
}
