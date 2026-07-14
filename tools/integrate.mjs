/* Интеграция контента, сгенерированного воркфлоу, в файлы сайта.
   1) assets/data/mmil.js  — определение теста: шкалы, пункты, ключи, нормы, правила
   2) assets/data/interp.js — библиотека интерпретаций
   3) Вставка HTML-фрагментов в страницы по парным маркерам <!--CONTENT:key--> ... <!--/CONTENT:key-->
   Запуск: node tools/integrate.mjs <path-to-workflow-output.json>
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = process.argv[2];
if (!srcPath) { console.error('usage: node tools/integrate.mjs <workflow-output.json>'); process.exit(2); }

const rawText = readFileSync(srcPath, 'utf8');
const jsonText = rawText.slice(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
const parsed = JSON.parse(jsonText);
const { items, interp, copy } = parsed.result ?? parsed;
if (!items?.items || !interp?.scales || !copy?.faq) { console.error('Неожиданная структура результата воркфлоу'); process.exit(1); }

/* точечные правки формулировок сгенерированного банка */
const TEXT_PATCHES = {
  10: 'Мне почти каждую ночь снится один и тот же сон.',
};
for (const it of items.items) if (TEXT_PATCHES[it.id]) it.text = TEXT_PATCHES[it.id];

/* ---------- метаданные шкал (названия по Ф. Б. Березину) ---------- */
const SCALES = [
  { code: 'L', mmpi: 'L',  group: 'validity', name: 'Шкала лжи',            desc: 'Стремление выглядеть социально одобряемо' },
  { code: 'F', mmpi: 'F',  group: 'validity', name: 'Шкала достоверности',  desc: 'Атипичность ответов, небрежность или аггравация' },
  { code: 'K', mmpi: 'K',  group: 'validity', name: 'Шкала коррекции',      desc: 'Защитная закрытость, осторожность самораскрытия' },
  { code: '1', mmpi: 'Hs', group: 'clinical', name: 'Соматизация тревоги',  desc: 'Внимание к телесным ощущениям и самочувствию' },
  { code: '2', mmpi: 'D',  group: 'clinical', name: 'Тревога и депрессивные тенденции', desc: 'Сниженный фон настроения, беспокойство' },
  { code: '3', mmpi: 'Hy', group: 'clinical', name: 'Вытеснение факторов тревоги', desc: 'Эмоциональная лабильность, демонстративность' },
  { code: '4', mmpi: 'Pd', group: 'clinical', name: 'Реализация напряжённости в поведении', desc: 'Импульсивность, нонконформизм' },
  { code: '5', mmpi: 'Mf', group: 'clinical', name: 'Мужские и женские черты', desc: 'Профиль интересов и предпочтений' },
  { code: '6', mmpi: 'Pa', group: 'clinical', name: 'Ригидность аффекта',   desc: 'Устойчивость установок, недоверчивость' },
  { code: '7', mmpi: 'Pt', group: 'clinical', name: 'Фиксация тревоги',     desc: 'Перфекционизм, навязчивые сомнения' },
  { code: '8', mmpi: 'Sc', group: 'clinical', name: 'Аутизация',            desc: 'Своеобразие мышления, отгороженность' },
  { code: '9', mmpi: 'Ma', group: 'clinical', name: 'Отрицание тревоги',    desc: 'Активность, приподнятое настроение' },
  { code: '0', mmpi: 'Si', group: 'clinical', name: 'Социальная интроверсия', desc: 'Обращённость внутрь, избирательность контактов' },
];

/* ---------- валидация банка ---------- */
const validCodes = new Set(SCALES.map(s => s.code));
const seenIds = new Set();
for (const it of items.items) {
  if (!Number.isInteger(it.id) || seenIds.has(it.id)) { console.error('Дублирующийся/некорректный id пункта:', it.id); process.exit(1); }
  seenIds.add(it.id);
  for (const k of it.keys) {
    if (!validCodes.has(k.scale)) { console.error(`Пункт ${it.id}: неизвестная шкала "${k.scale}"`); process.exit(1); }
    if (!['T', 'F'].includes(k.keyed) || (k.keyedFemale && !['T', 'F'].includes(k.keyedFemale))) {
      console.error(`Пункт ${it.id}: некорректный ключ`); process.exit(1);
    }
  }
}

/* ---------- нормы (демо): M и σ из фактического числа пунктов банка ---------- */
const counts = {};
for (const s of SCALES) counts[s.code] = 0;
for (const it of items.items) for (const k of it.keys) counts[k.scale]++;

const CORRECTION = { '1': 0.5, '4': 0.4, '7': 1.0, '8': 1.0, '9': 0.2 };

function buildNorms(form) {
  const norms = {};
  const mK = +(0.40 * counts.K).toFixed(1);
  for (const s of SCALES) {
    const n = counts[s.code];
    let m, sd;
    /* оценочные шкалы: реалистичные средние, чтобы пороги достоверности были достижимы:
       F — редко подтверждаемые утверждения (низкое M), L — маловероятные добродетели */
    if (s.code === 'F') { m = 0.15 * n; sd = Math.max(1.2, 0.17 * n); }
    else if (s.code === 'L') { m = 0.25 * n; sd = Math.max(1.2, 0.20 * n); }
    else if (s.code === 'K') { m = 0.40 * n; sd = Math.max(1.5, 0.21 * n); }
    else {
      m = 0.40 * n;
      if (form === 'female' && (s.code === '2' || s.code === '3')) m += 0.4;
      if (form === 'male' && (s.code === '4' || s.code === '9')) m += 0.4;
      if (CORRECTION[s.code]) m += CORRECTION[s.code] * mK;
      sd = Math.max(1.5, 0.24 * n + (CORRECTION[s.code] ? 0.6 * CORRECTION[s.code] : 0));
    }
    norms[s.code] = { m: +m.toFixed(1), sd: +sd.toFixed(1) };
  }
  return norms;
}

const testDef = {
  id: 'mmil',
  title: 'ММИЛ — многостороннее исследование личности',
  version: 'demo-1.0',
  demo: true,
  fullItemCount: 377,
  scales: SCALES,
  items: items.items,
  correction: CORRECTION,
  norms: { male: buildNorms('male'), female: buildNorms('female') },
  validityRules: { maxUnknownShare: 0.25, fCautionT: 80, fInvalidT: 90, lCautionT: 70, kCautionT: 70, fkRawMax: 7 },
};

const banner = `/* Сгенерировано tools/integrate.mjs — демонстрационный банк утверждений.
   Это НЕ оригинальные пункты ММИЛ: полный банк (377 утверждений), ключи и нормы
   методики подключаются владельцем лицензии через замену этого файла (см. README). */\n`;

writeFileSync(resolve(root, 'assets/data/mmil.js'),
  banner + 'export const TEST = ' + JSON.stringify(testDef, null, 2) + ';\n', 'utf8');
console.log('✓ assets/data/mmil.js  (' + items.items.length + ' пунктов, нормы рассчитаны из банка)');

writeFileSync(resolve(root, 'assets/data/interp.js'),
  '/* Сгенерировано tools/integrate.mjs — демонстрационная библиотека интерпретаций. */\n' +
  'export const INTERP = ' + JSON.stringify(interp, null, 2) + ';\n', 'utf8');
console.log('✓ assets/data/interp.js (' + interp.scales.length + ' шкал, ' + interp.combos.length + ' паттернов)');

/* ---------- вставка контента в страницы ---------- */
/* правки сгенерированных текстов (согласование терминологии и фактов с интерфейсом) */
const patch = (str, pairs) => pairs.reduce((s, [a, b]) => s.split(a).join(b), str);

copy.aboutProject = patch(copy.aboutProject, [
  ['Вы в любой момент можете удалить свой аккаунт и все результаты.',
   'Все данные можно удалить в любой момент: в демо-версии — кнопкой «Удалить все данные» на странице «Мои результаты» (данные хранятся только в вашем браузере), в боевой версии — через настройки личного кабинета.'],
]);

let faqHtml = copy.faq.map(f =>
  `<details class="faq-item"><summary>${f.q}</summary><div class="faq-body">${f.a}</div></details>`).join('\n');

faqHtml = patch(faqHtml, [
  ['<p>В среднем ответы на 377 утверждений занимают от 40 минут до полутора часов — темп у всех разный, и это нормально.',
   '<p>Полная форма из 377 утверждений обычно занимает 30–60 минут, у кого-то — дольше: темп у всех разный, и это нормально. Демо-банк из 102 утверждений проходится за 10–15 минут.'],
  ['<p>Диапазон примерно от 40 до 60 T-баллов считается «коридором нормы» — типичной зоной, куда попадает большинство людей.',
   '<p>«Коридором нормы» считается диапазон 30–70 T-баллов; типичная зона, куда попадает большинство людей, — примерно 40–60.'],
  ['<p>Вы можете в любой момент удалить свой аккаунт и все связанные с ним данные, включая ответы на утверждения и результаты тестирования, в настройках личного кабинета либо направив запрос на адрес поддержки, указанный в политике конфиденциальности.</p><p>После подтверждения запроса данные удаляются безвозвратно в срок, установленный законодательством о персональных данных.',
   '<p>В демо-версии все данные — ответы, профили и интерпретации — хранятся только локально в вашем браузере и никуда не отправляются. Удалить их можно в любой момент кнопкой «Удалить все данные» на странице «Мои результаты» — безвозвратно.</p><p>В боевой версии с личным кабинетом удаление аккаунта и всех связанных данных выполняется в настройках кабинета или запросом в поддержку (право на удаление по 152-ФЗ).'],
]);

const injections = [
  ['index.html', 'faq', faqHtml],
  ['about.html', 'aboutMethod', copy.aboutMethod],
  ['about.html', 'aboutProject', copy.aboutProject],
  ['privacy.html', 'privacy', copy.privacy],
  ['offer.html', 'offer', copy.offer],
  ['terms.html', 'terms', copy.terms],
];

for (const [file, key, html] of injections) {
  const path = resolve(root, file);
  if (!existsSync(path)) { console.log('· пропуск (нет файла):', file, key); continue; }
  let page = readFileSync(path, 'utf8');
  const re = new RegExp(`(<!--CONTENT:${key}-->)[\\s\\S]*?(<!--/CONTENT:${key}-->)`);
  if (!re.test(page)) { console.log('· пропуск (нет маркера):', file, key); continue; }
  page = page.replace(re, `$1\n${html}\n$2`);
  writeFileSync(path, page, 'utf8');
  console.log('✓', file, '←', key);
}
console.log('Готово.');
