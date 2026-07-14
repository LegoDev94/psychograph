/* Профиль ММИЛ для ECharts: линия T-баллов по 13 шкалам, коридор нормы 30–70.
   Спецификация: линия 2px, маркеры 9px с обводкой цвета поверхности,
   выборочные подписи (только заметные отклонения), сдержанная сетка. */

import { BAND_LABELS } from './engine.js';
import { tBand } from './engine.js';

export function buildProfileOption({ scales, t, colors, compact = false }) {
  const codes = scales.map(s => s.code);
  const values = scales.map(s => t[s.code]);

  return {
    animationDuration: 900,
    animationEasing: 'cubicOut',
    grid: {
      left: compact ? 34 : 44, right: compact ? 18 : 26,
      top: compact ? 18 : 28, bottom: compact ? 26 : 34,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: colors.hairlineStrong, type: 'dashed' } },
      backgroundColor: colors.paper,
      borderColor: colors.hairlineStrong,
      textStyle: { color: colors.ink, fontFamily: colors.fontBody, fontSize: 13 },
      extraCssText: 'box-shadow:0 8px 24px -8px rgba(0,0,0,.25);border-radius:6px;',
      formatter(params) {
        const p = params[0];
        const scale = scales[p.dataIndex];
        const band = BAND_LABELS[tBand(p.value)];
        return `<b style="font-family:${colors.fontMono}">${scale.code}</b> · ${scale.name}` +
               `<br><span style="font-family:${colors.fontMono};font-size:15px">T = ${p.value}</span>` +
               ` <span style="opacity:.65">· ${band}</span>`;
      },
    },
    xAxis: {
      type: 'category',
      data: codes,
      boundaryGap: false,
      axisLine: { lineStyle: { color: colors.hairlineStrong } },
      axisTick: { show: false },
      axisLabel: {
        color: colors.ink2, fontFamily: colors.fontMono,
        fontSize: compact ? 10 : 12, margin: compact ? 8 : 12,
      },
    },
    yAxis: {
      type: 'value',
      min: 20, max: 110, interval: 10,
      axisLabel: {
        color: colors.ink3, fontFamily: colors.fontMono, fontSize: compact ? 9 : 11,
        showMinLabel: false,
      },
      splitLine: { lineStyle: { color: colors.hairline } },
    },
    series: [{
      type: 'line',
      data: values,
      lineStyle: { width: 2, color: colors.accent },
      itemStyle: { color: colors.accent, borderColor: colors.paper, borderWidth: 2 },
      symbol: 'circle',
      symbolSize: compact ? 7 : 9,
      z: 5,
      emphasis: { scale: 1.4 },
      label: {
        show: true,
        position: 'top',
        distance: 7,
        fontFamily: colors.fontMono,
        fontSize: compact ? 10 : 11,
        color: colors.ink,
        formatter: p => (p.value > 70 || p.value < 30) ? p.value : '', // выборочные подписи
      },
      markArea: {
        silent: true,
        itemStyle: { color: colors.corridor },
        label: {
          show: !compact, position: 'insideTopRight',
          color: colors.ink3, fontFamily: colors.fontMono, fontSize: 10,
        },
        data: [[{ yAxis: 30, name: compact ? '' : 'коридор нормы 30–70' }, { yAxis: 70 }]],
      },
      markLine: {
        silent: true, symbol: 'none',
        label: { show: false },
        lineStyle: { color: colors.corridorLine, type: 'dashed', width: 1 },
        data: [{ yAxis: 50 }],
      },
    }],
  };
}

/** Создание/пересоздание графика с реакцией на смену темы и ресайз. */
export function mountProfileChart(el, getOption) {
  let chart = echarts.init(el, null, { renderer: 'canvas' });
  chart.setOption(getOption());
  const onResize = () => chart.resize();
  window.addEventListener('resize', onResize);
  document.addEventListener('pg:theme', () => {
    chart.dispose();
    chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(getOption());
  });
  return () => chart;
}
