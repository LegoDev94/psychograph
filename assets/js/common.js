/* ПСИХОГРАФ — общий слой: шапка/футер, тема, хранилище, утилиты */

const LS_PREFIX = 'pg.';

/* ---------- хранилище ---------- */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* квота/приватный режим */ }
  },
  remove(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch {} },
};

/* ---------- результаты (локальный «личный кабинет») ---------- */
export const results = {
  list() { return store.get('results', []); },
  get(id) { return this.list().find(r => r.id === id) || null; },
  save(result) {
    const all = this.list().filter(r => r.id !== result.id);
    all.unshift(result);
    store.set('results', all.slice(0, 50));
  },
  remove(id) { store.set('results', this.list().filter(r => r.id !== id)); },
};

export function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- тема ---------- */
export function currentTheme() {
  return document.documentElement.dataset.theme || 'light';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    document.dispatchEvent(new CustomEvent('pg:theme', { detail: next }));
  };
  // плавный кросс-фейд всей страницы, где поддерживается
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

/* ---------- шапка и футер ---------- */
const BRAND_MARK = `
<svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
  <rect class="brand-mark-frame" x="1.5" y="1.5" width="27" height="27" rx="4" stroke-width="1.5"/>
  <polyline class="brand-mark-line" points="5,20 9,12 13,17 17,8 21,15 25,11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

const NAV_ITEMS = [
  { href: 'catalog.html', key: 'catalog', label: 'Каталог тестов' },
  { href: 'about.html', key: 'about', label: 'Методика' },
  { href: 'index.html#faq', key: 'faq', label: 'Вопросы' },
  { href: 'history.html', key: 'history', label: 'Мои результаты' },
];

export function initChrome(active = '') {
  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'К содержимому';
    document.body.prepend(skip);
  }

  const header = document.getElementById('site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <div class="container">
        <a class="brand" href="index.html">${BRAND_MARK}<span>Психограф<sup>ММИЛ</sup></span></a>
        <nav class="site-nav" id="site-nav" aria-label="Основная навигация">
          ${NAV_ITEMS.map(i => `<a href="${i.href}" ${active === i.key ? 'aria-current="page"' : ''}>${i.label}</a>`).join('')}
        </nav>
        <div class="header-actions">
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Переключить тему">
            <svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
            <svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>
          </button>
          <a class="btn btn-primary btn-sm no-print" href="test.html">Пройти тест</a>
          <button class="nav-burger" id="nav-burger" type="button" aria-label="Меню" aria-controls="site-nav" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>`;
    header.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
    const burger = header.querySelector('#nav-burger');
    const nav = header.querySelector('#site-nav');
    const setOpen = open => {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    };
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); }
    });
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <div class="cols">
          <div>
            <a class="brand" href="index.html" style="margin-bottom:14px">${BRAND_MARK}<span>Психограф</span></a>
            <p class="footer-disclaimer">Сервис психологического самоисследования. Результаты тестирования и ИИ-интерпретация не являются медицинским диагнозом и не заменяют консультацию специалиста.</p>
            <span class="stamp">Демонстрационная версия</span>
          </div>
          <div>
            <h4>Разделы</h4>
            <ul>
              <li><a href="catalog.html">Каталог тестов</a></li>
              <li><a href="about.html">О методике ММИЛ</a></li>
              <li><a href="history.html">Мои результаты</a></li>
              <li><a href="index.html#pricing">Тарифы</a></li>
            </ul>
          </div>
          <div>
            <h4>Документы</h4>
            <ul>
              <li><a href="privacy.html">Политика обработки ПДн</a></li>
              <li><a href="offer.html">Публичная оферта</a></li>
              <li><a href="terms.html">Пользовательское соглашение</a></li>
            </ul>
          </div>
          <div>
            <h4>Контакты</h4>
            <ul>
              <li><a href="mailto:hello@psychograph.example">hello@psychograph.example</a></li>
              <li><a href="https://github.com/LegoDev94" rel="noopener">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-legal">
          <span>© 2026 Психограф. Демонстрационный проект по техническому заданию.</span>
          <span class="age-badge">18+</span>
        </div>
      </div>`;
  }

  if (!document.querySelector('.toast-zone')) {
    const zone = document.createElement('div');
    zone.className = 'toast-zone';
    zone.setAttribute('aria-live', 'polite');
    document.body.appendChild(zone);
  }

  initRise();
}

/* мягкое появление карточек при попадании во вьюпорт (все страницы) */
export function initRise(root = document) {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  root.querySelectorAll('.section .card:not([data-no-rise]), .section .faq-item, .scale-strip .scale-chip')
    .forEach((node, i) => {
      if (node.classList.contains('rise') || node.closest('[hidden]')) return;
      node.classList.add('rise');
      node.style.setProperty('--rise-d', `${(i % 6) * 70}ms`);
      io.observe(node);
    });
}

/* ---------- тосты ---------- */
export function toast(message, ms = 3200) {
  const zone = document.querySelector('.toast-zone');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms);
}

/* ---------- цвета для ECharts из CSS-переменных ---------- */
export function chartColors() {
  const css = getComputedStyle(document.documentElement);
  const v = name => css.getPropertyValue(name).trim();
  return {
    ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'),
    paper: v('--paper'), hairline: v('--hairline'), hairlineStrong: v('--hairline-strong'),
    accent: v('--accent'), accent2: v('--accent-2'), accent3: v('--accent-3'),
    corridor: v('--corridor'), corridorLine: v('--corridor-line'),
    fontMono: v('--font-mono'), fontBody: v('--font-body'),
  };
}

/* пересборка графика при смене темы */
export function onThemeChange(fn) {
  document.addEventListener('pg:theme', fn);
}

/* печать всегда в светлой теме: перерисовываем графики на время печати */
let printRestoreTheme = null;
window.addEventListener('beforeprint', () => {
  if (currentTheme() === 'dark') {
    printRestoreTheme = 'dark';
    document.documentElement.dataset.theme = 'light';
    document.dispatchEvent(new CustomEvent('pg:theme', { detail: 'light' }));
  }
});
window.addEventListener('afterprint', () => {
  if (printRestoreTheme) {
    document.documentElement.dataset.theme = printRestoreTheme;
    document.dispatchEvent(new CustomEvent('pg:theme', { detail: printRestoreTheme }));
    printRestoreTheme = null;
  }
});

/* показ <dialog> с фолбэком для браузеров без showModal */
export function openModal(dialog) {
  if (typeof dialog.showModal === 'function') { dialog.showModal(); return true; }
  return false;
}
