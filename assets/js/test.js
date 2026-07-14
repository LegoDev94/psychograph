/* Прохождение теста (M2): выбор формы, согласия, автосохранение, навигация, защита от повторной отправки */
import { initChrome, store, results, uid, toast, fmtDate } from './common.js';
import { TEST } from '../data/mmil.js';
import { scoreAttempt } from './engine.js';

initChrome('catalog');

const SESSION_KEY = 'session.' + TEST.id;
const $ = id => document.getElementById(id);

const screens = { intro: $('screen-intro'), quiz: $('screen-quiz'), finish: $('screen-finish') };
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

let session = null; // { form, answers: {id: 1|0|null}, idx, startedAt }
let computing = false;

/* ---------- экран 1: инструкция и согласие ---------- */
$('intro-count').textContent = TEST.items.length;

let pickedForm = null;
document.querySelectorAll('.form-pick .pick').forEach(btn => {
  btn.addEventListener('click', () => {
    pickedForm = btn.dataset.form;
    document.querySelectorAll('.form-pick .pick').forEach(b => {
      b.classList.toggle('selected', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    refreshStart();
  });
});

function refreshStart() {
  $('btn-start').disabled = !(pickedForm && $('consent-age').checked && $('consent-pd').checked);
}
$('consent-age').addEventListener('change', refreshStart);
$('consent-pd').addEventListener('change', refreshStart);

$('btn-start').addEventListener('click', () => {
  session = { form: pickedForm, answers: {}, idx: 0, startedAt: Date.now() };
  persist();
  startQuiz();
});

/* незавершённая попытка */
const saved = store.get(SESSION_KEY);
if (saved && saved.answers && !saved.finished) {
  const done = Object.keys(saved.answers).length;
  $('resume-info').textContent = `${saved.form === 'male' ? 'мужская' : 'женская'} форма, отвечено ${done} из ${TEST.items.length} (${fmtDate(saved.updatedAt || saved.startedAt)})`;
  $('resume-box').hidden = false;
  $('btn-resume').addEventListener('click', () => { session = saved; startQuiz(); });
  $('btn-discard').addEventListener('click', () => { store.remove(SESSION_KEY); $('resume-box').hidden = true; toast('Попытка удалена'); });
}

/* ---------- экран 2: вопросы ---------- */
function persist() {
  session.updatedAt = Date.now();
  store.set(SESSION_KEY, session);
}

function startQuiz() {
  show('quiz');
  $('q-form').textContent = session.form === 'male' ? 'мужская форма' : 'женская форма';
  render();
}

function render() {
  const i = session.idx;
  const item = TEST.items[i];
  const total = TEST.items.length;
  $('q-num').textContent = `Утверждение ${i + 1} из ${total}`;
  $('q-text').textContent = item.text;

  const a = session.answers[item.id];
  document.querySelectorAll('.answer-btn').forEach(btn => {
    const v = btn.dataset.answer === 'null' ? null : Number(btn.dataset.answer);
    btn.classList.toggle('selected', a !== undefined && v === a);
  });

  const answered = Object.keys(session.answers).length;
  const pct = Math.round(100 * answered / total);
  $('progress-label').textContent = `${i + 1} / ${total}`;
  $('progress-pct').textContent = `${pct}%`;
  $('progress-fill').style.width = pct + '%';
  $('progress-bar').setAttribute('aria-valuenow', String(pct));

  $('btn-prev').disabled = i === 0;
  $('btn-next').textContent = i === total - 1 ? 'Завершить' : 'Далее →';
}

function setAnswer(v) {
  const item = TEST.items[session.idx];
  session.answers[item.id] = v;
  persist();
  render();
  setTimeout(next, 160); // короткая пауза, чтобы был виден выбор
}

function next() {
  if (session.idx < TEST.items.length - 1) { session.idx++; persist(); render(); }
  else finish();
}
function prev() {
  if (session.idx > 0) { session.idx--; persist(); render(); }
}

document.querySelectorAll('.answer-btn').forEach(btn => {
  btn.addEventListener('click', () => setAnswer(btn.dataset.answer === 'null' ? null : Number(btn.dataset.answer)));
});
$('btn-next').addEventListener('click', next);
$('btn-prev').addEventListener('click', prev);
$('btn-pause').addEventListener('click', () => {
  toast('Ответы сохранены — вернуться можно с этой же страницы');
  location.href = 'index.html';
});

document.addEventListener('keydown', e => {
  if (screens.quiz.hidden) return;
  if (e.key === '1') setAnswer(1);
  else if (e.key === '2') setAnswer(0);
  else if (e.key === '3') setAnswer(null);
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
});

/* ---------- экран 3: завершение и расчёт ---------- */
function unansweredIds() {
  return TEST.items.filter(it => session.answers[it.id] === undefined).map(it => it.id);
}

function finish() {
  const missing = unansweredIds();
  show('finish');
  if (missing.length) {
    $('finish-title').textContent = 'Остались пропущенные утверждения';
    $('finish-info').textContent = `Без ответа: ${missing.length}. Можно вернуться и ответить — или рассчитать профиль как есть (пропуски трактуются как «Не знаю» и снижают достоверность).`;
    $('btn-unanswered').hidden = false;
  } else {
    $('finish-title').textContent = 'Все утверждения пройдены';
    $('finish-info').textContent = 'Ответы сохранены. Нажмите кнопку — система рассчитает баллы по шкалам, применит K-коррекцию и построит ваш личностный профиль.';
    $('btn-unanswered').hidden = true;
  }
}

$('btn-unanswered').addEventListener('click', () => {
  const missing = unansweredIds();
  if (!missing.length) return;
  const idx = TEST.items.findIndex(it => it.id === missing[0]);
  session.idx = idx;
  persist();
  startQuiz();
});

$('btn-compute').addEventListener('click', () => {
  if (computing) return; // защита от повторной отправки
  computing = true;
  $('btn-compute').innerHTML = '<span class="spinner"></span> Расчёт…';

  // пропуски считаем «Не знаю»
  const answers = { ...session.answers };
  for (const it of TEST.items) if (answers[it.id] === undefined) answers[it.id] = null;

  const scored = scoreAttempt(TEST, session.form, answers);
  const result = {
    id: uid(),
    testId: TEST.id,
    testVersion: TEST.version,
    date: Date.now(),
    startedAt: session.startedAt,
    form: session.form,
    answers,
    ...scored,
    paid: false,
    questionnaire: null,
    interpretation: null,
  };
  results.save(result);
  session.finished = true;
  store.remove(SESSION_KEY);
  location.href = 'results.html?rid=' + result.id;
});
