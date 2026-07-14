/* Главная: шапка/футер, «живой психограф» в герое, появление секций при скролле */
import { initChrome } from './common.js';
import { initHeroGraph } from './hero-graph.js';

initChrome('home');
initHeroGraph();

/* мягкое появление карточек при скролле */
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  document.querySelectorAll('.section .card, .section .faq-item, .scale-strip .scale-chip').forEach((node, i) => {
    node.classList.add('rise');
    node.style.setProperty('--rise-d', `${(i % 6) * 70}ms`);
    io.observe(node);
  });
}
