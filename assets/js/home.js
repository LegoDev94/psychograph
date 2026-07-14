/* Главная: шапка/футер + «живой психограф» в герое (rise-анимации — в common.js) */
import { initChrome } from './common.js';
import { initHeroGraph } from './hero-graph.js';

initChrome('home');
initHeroGraph();

/* числа в герое «досчитываются» при загрузке */
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.hero-meta [data-count]').forEach(node => {
    const target = Number(node.dataset.count);
    const t0 = performance.now(), dur = 900;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}
