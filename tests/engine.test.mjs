/* Тесты движка расчёта: node tests/engine.test.mjs */
import { TEST } from '../assets/data/mmil.js';
import { rawScores, applyCorrection, tScores, tBand, scoreAttempt, effectiveKey } from '../assets/js/engine.js';

let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name, extra); }
}
function answersAll(v) {
  const a = {};
  for (const it of TEST.items) a[it.id] = v;
  return a;
}

console.log('1. Сырые баллы');
{
  const { raw, unknown, answered } = rawScores(TEST, 'male', answersAll(1));
  const expected = {};
  for (const s of TEST.scales) expected[s.code] = 0;
  for (const it of TEST.items) for (const k of it.keys) if (effectiveKey(k, 'male') === 'T') expected[k.scale]++;
  check('все «Верно»: баллы = числу T-ключей', TEST.scales.every(s => raw[s.code] === expected[s.code]),
    JSON.stringify({ raw, expected }));
  check('answered = все пункты', answered === TEST.items.length);
  check('unknown = 0', unknown === 0);

  const un = rawScores(TEST, 'male', answersAll(null));
  check('все «Не знаю»: unknown = N, баллы = 0', un.unknown === TEST.items.length && TEST.scales.every(s => un.raw[s.code] === 0));
}

console.log('2. K-коррекция (Hs +0.5K, Pd +0.4K, Pt +1.0K, Sc +1.0K, Ma +0.2K)');
{
  const raw = {}; for (const s of TEST.scales) raw[s.code] = 4;
  raw.K = 10;
  const c = applyCorrection(TEST, raw);
  check('Hs +0.5·K', c['1'] === 4 + 0.5 * 10);
  check('Pd +0.4·K', c['4'] === 4 + 0.4 * 10);
  check('Pt +1.0·K', c['7'] === 4 + 10);
  check('Sc +1.0·K', c['8'] === 4 + 10);
  check('Ma +0.2·K', c['9'] === 4 + 2);
  check('D без коррекции', c['2'] === 4);
}

console.log('3. T-баллы: T = 50 + 10·(X − M)/σ');
{
  const norms = TEST.norms.male['2'];
  const corrected = {}; for (const s of TEST.scales) corrected[s.code] = TEST.norms.male[s.code].m;
  corrected['2'] = norms.m + norms.sd; // ровно +1σ
  const t = tScores(TEST, 'male', corrected);
  check('X = M → T = 50', t['1'] === 50 && t['0'] === 50);
  check('X = M + σ → T = 60', t['2'] === 60, `got ${t['2']}`);
}

console.log('4. Разные ключи мужской/женской формы (шкала 5)');
{
  const flip = TEST.items.find(it => it.keys.some(k => k.keyedFemale && k.keyedFemale !== k.keyed));
  check('в банке есть пункты с различающимся женским ключом', !!flip);
  if (flip) {
    const key = flip.keys.find(k => k.keyedFemale && k.keyedFemale !== k.keyed);
    const ans = { [flip.id]: key.keyed === 'T' ? 1 : 0 }; // попадает в мужской ключ
    const m = rawScores(TEST, 'male', ans).raw[key.scale];
    const f = rawScores(TEST, 'female', ans).raw[key.scale];
    check('один и тот же ответ даёт балл только в одной форме', m === 1 && f === 0, `m=${m} f=${f}`);
  }
}

console.log('5. Диапазоны T-баллов');
{
  check('39 → low', tBand(39) === 'low');
  check('40 → norm', tBand(40) === 'norm');
  check('60 → norm', tBand(60) === 'norm');
  check('61 → mild', tBand(61) === 'mild');
  check('70 → mild', tBand(70) === 'mild');
  check('71 → high', tBand(71) === 'high');
}

console.log('6. Достоверность');
{
  const manyUnknown = answersAll(0);
  const ids = TEST.items.map(i => i.id);
  for (const id of ids.slice(0, Math.ceil(ids.length * 0.3))) manyUnknown[id] = null;
  const r = scoreAttempt(TEST, 'male', manyUnknown);
  check('>25% «Не знаю» → профиль недостоверен', r.validity.status === 'invalid',
    JSON.stringify(r.validity));

  const honest = answersAll(0);
  const rr = scoreAttempt(TEST, 'female', honest);
  check('расчёт проходит для женской формы, все шкалы посчитаны',
    TEST.scales.every(s => Number.isFinite(rr.t[s.code])));
}

console.log('7. Достижимость порогов достоверности');
{
  const rules = TEST.validityRules;
  for (const form of ['male', 'female']) {
    const maxT = code => {
      const n = TEST.items.reduce((acc, it) => acc + (it.keys.some(k => k.scale === code) ? 1 : 0), 0);
      const { m, sd } = TEST.norms[form][code];
      return Math.round(50 + 10 * ((n - m) / sd));
    };
    check(`[${form}] max T(F)=${maxT('F')} > fInvalidT=${rules.fInvalidT}`, maxT('F') > rules.fInvalidT);
    check(`[${form}] max T(L)=${maxT('L')} > lCautionT=${rules.lCautionT}`, maxT('L') > rules.lCautionT);
    check(`[${form}] max T(K)=${maxT('K')} > kCautionT=${rules.kCautionT}`, maxT('K') > rules.kCautionT);
  }
}

console.log('8. Полный сквозной расчёт');
{
  const answers = {};
  for (const [i, it] of TEST.items.entries()) answers[it.id] = i % 3 === 0 ? 1 : (i % 3 === 1 ? 0 : null);
  const r = scoreAttempt(TEST, 'male', answers);
  check('T-баллы в допустимых пределах [10..120]', TEST.scales.every(s => r.t[s.code] >= 10 && r.t[s.code] <= 120));
  check('unknown посчитан', r.unknown === TEST.items.filter((_, i) => i % 3 === 2).length);
}

if (failed) { console.error(`\nПРОВАЛЕНО: ${failed}`); process.exit(1); }
console.log('\nВсе тесты движка пройдены.');
