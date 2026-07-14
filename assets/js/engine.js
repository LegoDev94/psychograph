/* ПСИХОГРАФ — движок расчёта профиля (M3 по ТЗ)
   Чистые функции без DOM: работают и в браузере, и в node-тестах.

   Ответы: { [itemId]: 1 | 0 | null }  — 1 «Верно», 0 «Неверно»,
   null — неопределённый ответ (пропущенное утверждение): балл не начисляется,
   учитывается в оценке достоверности.
   Формулы по ТЗ:
     • K-коррекция: Hs +0.5·K, Pd +0.4·K, Pt +1.0·K, Sc +1.0·K, Ma +0.2·K
     • T = 50 + 10·(X − M) / σ  (нормы по полу)
*/

/** Эффективный ключ пункта для формы (женская форма может иметь противоположный ключ). */
export function effectiveKey(key, form) {
  return (form === 'female' && key.keyedFemale) ? key.keyedFemale : key.keyed;
}

/** Сырые баллы по всем шкалам + счётчик неопределённых ответов (пропусков). */
export function rawScores(test, form, answers) {
  const raw = {};
  for (const s of test.scales) raw[s.code] = 0;
  let unknown = 0;
  let answered = 0;

  for (const item of test.items) {
    const a = answers[item.id];
    if (a === undefined) continue;
    answered++;
    if (a === null) { unknown++; continue; }
    for (const key of item.keys) {
      const k = effectiveKey(key, form);
      if ((a === 1 && k === 'T') || (a === 0 && k === 'F')) raw[key.scale]++;
    }
  }
  return { raw, unknown, answered };
}

/** K-коррекция: X' = X + coef·K (коэффициенты из ТЗ, задаются в описании теста). */
export function applyCorrection(test, raw) {
  const corrected = { ...raw };
  const K = raw.K ?? 0;
  for (const [scale, coef] of Object.entries(test.correction || {})) {
    corrected[scale] = raw[scale] + coef * K;
  }
  return corrected;
}

/** Перевод в T-баллы: T = 50 + 10·(X − M)/σ, нормы по полу. */
export function tScores(test, form, corrected) {
  const norms = test.norms[form];
  const t = {};
  for (const s of test.scales) {
    const { m, sd } = norms[s.code];
    const val = 50 + 10 * ((corrected[s.code] - m) / sd);
    t[s.code] = Math.round(Math.max(10, Math.min(120, val)));
  }
  return t;
}

/** Диапазон T-балла для интерпретации и подсветки. */
export function tBand(t) {
  if (t < 40) return 'low';
  if (t <= 60) return 'norm';
  if (t <= 70) return 'mild';
  return 'high';
}

export const BAND_LABELS = {
  low: 'Ниже типичных значений',
  norm: 'В пределах нормы',
  mild: 'Умеренное повышение',
  high: 'Выраженное повышение',
};

/** Оценка достоверности профиля по L / F / K и числу пропусков (правила — в описании теста). */
export function assessValidity(test, { raw, unknown, answered, t }) {
  const rules = test.validityRules;
  const flags = [];
  let status = 'ok';
  const worse = s => { if (s === 'invalid' || status === 'invalid') status = 'invalid'; else status = 'caution'; };

  const unknownShare = answered > 0 ? unknown / answered : 0;
  if (unknownShare > rules.maxUnknownShare) {
    worse('invalid');
    flags.push({ code: 'unknown', level: 'invalid',
      text: `Слишком много утверждений оставлено без ответа (${unknown} из ${answered}). Профиль может быть занижен и недостоверен.` });
  } else if (unknownShare > rules.maxUnknownShare / 2) {
    worse('caution');
    flags.push({ code: 'unknown', level: 'caution',
      text: `Заметная доля утверждений без ответа (${unknown}). Отдельные шкалы могут быть занижены.` });
  }

  if (t.F > rules.fInvalidT) {
    worse('invalid');
    flags.push({ code: 'F', level: 'invalid',
      text: `Очень высокий показатель шкалы F (T=${t.F}): ответы атипичны — возможны случайные ответы или стремление подчеркнуть трудности.` });
  } else if (t.F > rules.fCautionT) {
    worse('caution');
    flags.push({ code: 'F', level: 'caution',
      text: `Повышенная шкала F (T=${t.F}): интерпретировать профиль следует с осторожностью.` });
  }

  if (t.L > rules.lCautionT) {
    worse('caution');
    flags.push({ code: 'L', level: 'caution',
      text: `Повышенная шкала L (T=${t.L}): выражено стремление показать себя в социально одобряемом свете, профиль может быть сглажен.` });
  }

  if (t.K > rules.kCautionT) {
    worse('caution');
    flags.push({ code: 'K', level: 'caution',
      text: `Высокая шкала K (T=${t.K}): защитная закрытость — реальная выраженность отдельных характеристик может быть выше видимой.` });
  }

  const fk = raw.F - raw.K;
  if (fk > rules.fkRawMax) {
    worse('caution');
    flags.push({ code: 'FK', level: 'caution',
      text: `Индекс F−K = ${fk}: возможно стремление подчеркнуть тяжесть состояния (аггравация).` });
  }

  return { status, flags, fk, unknown, unknownShare };
}

/** Полный расчёт попытки: сырые → коррекция → T-баллы → достоверность. */
export function scoreAttempt(test, form, answers) {
  const { raw, unknown, answered } = rawScores(test, form, answers);
  const corrected = applyCorrection(test, raw);
  const t = tScores(test, form, corrected);
  const validity = assessValidity(test, { raw, unknown, answered, t });
  return { form, raw, corrected, t, unknown, answered, validity };
}

/** Сборка текстовой интерпретации из библиотеки (для бесплатного резюме и демо-режима ИИ). */
export function buildInterpretation(interp, scored, scalesMeta) {
  const parts = [];
  const clinical = scalesMeta.filter(s => s.group === 'clinical');
  for (const s of clinical) {
    const band = tBand(scored.t[s.code]);
    const lib = interp.scales.find(x => x.code === s.code);
    if (lib) parts.push({ code: s.code, name: s.name, t: scored.t[s.code], band, text: lib[band] });
  }
  const elevated = new Set(clinical.filter(s => scored.t[s.code] > 65).map(s => s.code));
  // код шкалы в комбинации может иметь суффикс "-low" — тогда требуется снижение, а не подъём
  const matches = code => {
    const [c, mod] = code.split('-');
    return mod === 'low' ? tBand(scored.t[c]) === 'low' : elevated.has(c);
  };
  const combos = (interp.combos || []).filter(c => c.scales.every(matches));
  return { parts, combos };
}
