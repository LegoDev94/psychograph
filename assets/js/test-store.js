/* Слой конфигурации теста: админ-правки (localStorage) поверх заводского определения.
   Админка сохраняет override, публичные страницы применяют его при загрузке. */
import { store } from './common.js';

const OVERRIDE_KEY = 'admin.test';   // { itemTexts: {id: text}, itemKeys: {id: keys[]}, norms, validityRules, correction }
const SETTINGS_KEY = 'admin.settings'; // { price, deepseek: {model, maxTokens, prompt} }

/** Заводское определение + админ-правки (глубокое слияние по разделам). */
export function withOverride(base) {
  const o = store.get(OVERRIDE_KEY);
  if (!o) return base;
  const test = structuredClone(base);
  if (o.itemTexts) for (const it of test.items) if (o.itemTexts[it.id] != null) it.text = o.itemTexts[it.id];
  if (o.itemKeys) for (const it of test.items) if (o.itemKeys[it.id]) it.keys = o.itemKeys[it.id];
  if (o.norms) {
    for (const form of ['male', 'female']) {
      if (!o.norms[form]) continue;
      for (const [code, n] of Object.entries(o.norms[form])) {
        if (test.norms[form][code]) test.norms[form][code] = { ...test.norms[form][code], ...n };
      }
    }
  }
  if (o.validityRules) test.validityRules = { ...test.validityRules, ...o.validityRules };
  if (o.correction) test.correction = { ...test.correction, ...o.correction };
  test.overridden = true;
  return test;
}

export function getOverride() { return store.get(OVERRIDE_KEY, {}); }
export function saveOverride(override) { store.set(OVERRIDE_KEY, override); }
export function resetOverride() { store.remove(OVERRIDE_KEY); }
export function hasOverride() { return !!store.get(OVERRIDE_KEY); }

/** Настройки сервиса (цена, ИИ) — читаются страницей анализа. */
export function getSettings() {
  return { price: 499, deepseek: { model: 'deepseek-chat', maxTokens: 4000, prompt: '' }, ...store.get(SETTINGS_KEY, {}) };
}
export function saveSettings(s) { store.set(SETTINGS_KEY, s); }

/** Журнал действий администраторов. */
export function logAction(actor, action) {
  const log = store.get('admin.log', []);
  log.unshift({ ts: Date.now(), actor, action });
  store.set('admin.log', log.slice(0, 200));
}
export function getLog() { return store.get('admin.log', []); }
