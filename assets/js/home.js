/* Главная: шапка/футер + демо-график в герое */
import { initChrome, chartColors } from './common.js';
import { TEST } from '../data/mmil.js';
import { buildProfileOption, mountProfileChart } from './profile-chart.js';

initChrome('home');

/* демонстрационный профиль — умеренно «живой», в пределах нормы с одним акцентом */
const DEMO_T = { L: 46, F: 52, K: 55, 1: 48, 2: 61, 3: 54, 4: 45, 5: 50, 6: 57, 7: 66, 8: 58, 9: 43, 0: 60 };

const el = document.getElementById('hero-chart');
if (el && window.echarts) {
  mountProfileChart(el, () => buildProfileOption({
    scales: TEST.scales,
    t: DEMO_T,
    colors: chartColors(),
    compact: true,
  }));
}
