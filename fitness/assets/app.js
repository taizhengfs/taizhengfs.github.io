/* Garmin 数据实验室 —— 纯前端，无构建步骤 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const C = {
  hr: '#ff4d6d', pace: '#ffb703', power: '#a26bff', alt: '#35d0ba',
  sleep: '#7b8cff', steps: '#4cc9f0', weight: '#ffd166', cad: '#6ee7b7',
  accent: '#ff7a3d', accent2: '#35d0ba', dim: '#647084',
  z: ['#4c6ef5', '#22b8cf', '#51cf66', '#fab005', '#ff6b6b'],
};

const STATE = { core: null, health: null, tab: 'overview', act: null, stream: null, pbDist: '5000', rhrRange: 'all' };

/* ============================ 全局错误捕获 ============================ */
const APP_VERSION = 'v3';
function fatal(where, err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  console.error(where, err);
  const bar = document.getElementById('errbar');
  if (bar) bar.innerHTML = `<b>运行出错：${where}（${APP_VERSION}）</b>${String(msg).slice(0, 500)}`;
}
addEventListener('error', e => fatal('window.error', e.error || e.message));
addEventListener('unhandledrejection', e => fatal('未捕获的 Promise 异常', e.reason));
console.log('[garmin-fit-lab] app.js ' + APP_VERSION + ' 已加载');

/* ============================ 工具 ============================ */
const nf = (v, d = 0) => (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d);
const isNum = v => v !== null && v !== undefined && isFinite(v);

function fmtDur(sec) {
  if (!isNum(sec)) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtPace(p) { // min/km -> m:ss
  if (!isNum(p) || p <= 0) return '—';
  const m = Math.floor(p), s = Math.round((p - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtKm(v) { return isNum(v) ? (v >= 100 ? Math.round(v) : v.toFixed(1)) : '—'; }
function fmtNum(v, d = 0) { return isNum(v) ? v.toFixed(d) : '—'; }
function monthLabel(m) { if (!m) return ''; const [y, mo] = m.split('-'); return `${(y || '').slice(2)}/${mo || ''}`; }
function shortDate(d) { return d ? d.slice(5).replace('-', '/') : ''; }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function showTip(html, x, y) {
  const t = $('#tip');
  t.innerHTML = html;
  t.style.opacity = 1;
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y - r.height - 12;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top < 8) top = y + 16;
  t.style.left = left + 'px';
  t.style.top = top + 'px';
}
const hideTip = () => { $('#tip').style.opacity = 0; };

function niceDomain(min, max, ticks = 5) {
  if (!isFinite(min) || !isFinite(max)) return [0, 1];
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / ticks)));
  const err = span / ticks / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = mult * step;
  return [Math.floor(min / s) * s, Math.ceil(max / s) * s, s];
}

/* ============================ 图表 ============================ */
/** 折线/面积图。cfg: {height, series:[{name,color,data,axis,fill,dash,width}], x:[label],
 *  yFmt, y2Fmt, yInvert, y2Invert, xTicks, dot, tip:(i)=>html} */
function lineChart(node, cfg) {
  const W = node.clientWidth || 600;
  const H = cfg.height || 260;
  const pad = { t: 12, r: cfg.series.some(s => s.axis === 'y2') ? 48 : 14, b: 26, l: 50 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = Math.max(...cfg.series.map(s => s.data.length), 1);

  const vals = a => a.filter(isNum);
  const dom = (arr, inv) => {
    const v = vals(arr); if (!v.length) return [0, 1];
    return niceDomain(Math.min(...v), Math.max(...v));
  };
  const y1 = cfg.yDomain || dom(cfg.series.filter(s => s.axis !== 'y2').flatMap(s => s.data));
  const useY2 = cfg.series.some(s => s.axis === 'y2');
  const y2 = cfg.y2Domain || (useY2 ? dom(cfg.series.filter(s => s.axis === 'y2').flatMap(s => s.data)) : null);

  const X = i => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y1 = v => isNum(v) ? pad.t + ih - ((v - y1[0]) / (y1[1] - y1[0] || 1)) * ih : null;
  const Y2 = v => isNum(v) ? pad.t + ih - ((v - y2[0]) / (y2[1] - y2[0] || 1)) * ih : null;

  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  // 网格 + Y 轴刻度
  const yt = 5;
  for (let i = 0; i <= yt; i++) {
    const yy = pad.t + (i / yt) * ih;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39" stroke-width="1"/>`;
    const v = y1[1] - (i / yt) * (y1[1] - y1[0]);
    svg += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${(cfg.yFmt || (x => x.toFixed(0)))(v)}</text>`;
    if (useY2) {
      const v2 = y2[1] - (i / yt) * (y2[1] - y2[0]);
      svg += `<text x="${W - pad.r + 8}" y="${yy + 4}" fill="#8b7fd4" font-size="10.5">${(cfg.y2Fmt || (x => x.toFixed(0)))(v2)}</text>`;
    }
  }
  // X 轴刻度
  if (cfg.x && cfg.x.length) {
    const step = Math.max(1, Math.floor(n / (cfg.xTicks || 6)));
    for (let i = 0; i < n; i += step) {
      svg += `<text x="${X(i)}" y="${H - 7}" fill="#647084" font-size="10.5" text-anchor="middle">${cfg.x[i] ?? ''}</text>`;
    }
  }
  // 系列
  for (const s of cfg.series) {
    const dom2 = s.axis === 'y2' ? y2 : y1;
    const inv = s.axis === 'y2' ? !!cfg.y2Invert : !!cfg.yInvert;
    const Ys = v => {
      if (!isNum(v)) return null;
      const t = (v - dom2[0]) / (dom2[1] - dom2[0] || 1);
      const tt = inv ? 1 - t : t;
      return pad.t + ih - tt * ih;
    };
    let d = '', started = false;
    for (let i = 0; i < s.data.length; i++) {
      const yy = Ys(s.data[i]);
      if (yy === null) { started = false; continue; }
      d += `${started ? 'L' : 'M'}${X(i).toFixed(1)},${yy.toFixed(1)}`;
      started = true;
    }
    if (!d) continue;
    if (s.fill) {
      const base = pad.t + ih;
      svg += `<path d="${d}L${X(s.data.length - 1).toFixed(1)},${base}L${X(0).toFixed(1)},${base}Z" fill="${s.color}" opacity="0.14"/>`;
    }
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.9}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
    if (cfg.dot) {
      for (let i = 0; i < s.data.length; i++) {
        const yy = Ys(s.data[i]);
        if (yy === null) continue;
        svg += `<circle cx="${X(i).toFixed(1)}" cy="${yy.toFixed(1)}" r="2.2" fill="${s.color}" opacity="${cfg.dotOpacity || 0.5}"/>`;
      }
    }
  }
  // hover
  svg += `<line id="cx" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + ih}" stroke="#8b93a5" stroke-width="1" opacity="0" pointer-events="none"/>`;
  svg += `<rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" class="hover"/>`;
  svg += `</svg>`;
  node.innerHTML = svg;

  const sv = node.querySelector('svg');
  const cx = sv.querySelector('#cx');
  const hov = sv.querySelector('.hover');
  const toLocal = ev => {
    const r = sv.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * W;
  };
  hov.addEventListener('mousemove', ev => {
    const mx = toLocal(ev);
    let i = Math.round(((mx - pad.l) / (iw || 1)) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    cx.setAttribute('x1', X(i)); cx.setAttribute('x2', X(i)); cx.setAttribute('opacity', 0.5);
    if (cfg.tip) showTip(cfg.tip(i), ev.clientX, ev.clientY);
  });
  hov.addEventListener('mouseleave', () => { cx.setAttribute('opacity', 0); hideTip(); });
}

/** 柱状图。cfg: {height, labels, values, colors, fmt, rotate} */
function barChart(node, cfg) {
  const W = node.clientWidth || 600, H = cfg.height || 240;
  const pad = { t: 12, r: 12, b: cfg.rotate ? 42 : 26, l: 48 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = cfg.labels.length;
  const max = cfg.max !== undefined ? cfg.max : Math.max(...cfg.values.filter(isNum), 1);
  const bw = iw / n;
  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    svg += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${(cfg.yFmt || (v => Math.round(v)))(max - (i / 4) * max)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 14));
  cfg.labels.forEach((L, i) => {
    const v = cfg.values[i];
    const h = isNum(v) ? Math.max(0, (v / (max || 1)) * ih) : 0;
    const x = pad.l + i * bw + bw * 0.16, w = bw * 0.68;
    const col = typeof cfg.colors === 'function' ? cfg.colors(L, i, v) : (cfg.colors || C.accent2);
    svg += `<rect x="${x.toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${col}" opacity="0.9"><title>${L}: ${cfg.fmt ? cfg.fmt(v) : v}</title></rect>`;
    if (i % step === 0) {
      if (cfg.rotate) svg += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 12}" fill="#647084" font-size="10" text-anchor="end" transform="rotate(-52 ${(x + w / 2).toFixed(1)} ${H - 12})">${L}</text>`;
      else svg += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" fill="#647084" font-size="10.5" text-anchor="middle">${L}</text>`;
    }
  });
  svg += `</svg>`;
  node.innerHTML = svg;
}

/** 分组柱状图（多系列）。cfg: {height, labels, series:[{name,color,data}], fmt, yFmt} */
function groupedBar(node, cfg) {
  const W = node.clientWidth || 600, H = cfg.height || 260;
  const pad = { t: 12, r: 12, b: 26, l: 48 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = cfg.labels.length, k = cfg.series.length;
  const max = Math.max(...cfg.series.flatMap(s => s.data.filter(isNum)), 1);
  const gw = iw / n, bw = (gw * 0.74) / k;
  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    svg += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${(cfg.yFmt || (v => Math.round(v)))(max - (i / 4) * max)}</text>`;
  }
  cfg.labels.forEach((L, i) => {
    cfg.series.forEach((s, j) => {
      const v = s.data[i];
      const h = isNum(v) ? Math.max(0, (v / max) * ih) : 0;
      const x = pad.l + i * gw + gw * 0.13 + j * bw;
      svg += `<rect x="${x.toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}" width="${(bw * 0.88).toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${s.color}" opacity="0.92"><title>${L} · ${s.name}: ${cfg.fmt ? cfg.fmt(v) : v}</title></rect>`;
    });
    svg += `<text x="${(pad.l + i * gw + gw / 2).toFixed(1)}" y="${H - 8}" fill="#647084" font-size="10.5" text-anchor="middle">${L}</text>`;
  });
  svg += `</svg>`;
  node.innerHTML = svg;
}

/** 堆叠柱状图。cfg: {height, labels, stacks:[{name,color,data}], yFmt} */
function stackedBar(node, cfg) {
  const W = node.clientWidth || 600, H = cfg.height || 240;
  const pad = { t: 12, r: 12, b: 26, l: 44 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = cfg.labels.length;
  const tot = cfg.labels.map((_, i) => cfg.stacks.reduce((s, st) => s + (st.data[i] || 0), 0));
  const max = Math.max(...tot, 1) * 1.02;
  const bw = iw / n;
  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    svg += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${(cfg.yFmt || (v => v.toFixed(1)))(max - (i / 4) * max)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 13));
  cfg.labels.forEach((L, i) => {
    let acc = 0;
    cfg.stacks.forEach(st => {
      const v = st.data[i] || 0;
      const h = (v / max) * ih;
      const y = pad.t + ih - ((acc + v) / max) * ih;
      svg += `<rect x="${(pad.l + i * bw + bw * 0.16).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${st.color}" opacity="0.9"><title>${L} · ${st.name}: ${v.toFixed(2)}h</title></rect>`;
      acc += v;
    });
    if (i % step === 0) svg += `<text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" fill="#647084" font-size="10.5" text-anchor="middle">${L}</text>`;
  });
  svg += `</svg>`;
  node.innerHTML = svg;
}

/** 散点图。cfg: {height, points:[{x,y,color,label}], xFmt, yFmt, xLabel, yLabel, xInvert, yInvert} */
function scatter(node, cfg) {
  const W = node.clientWidth || 600, H = cfg.height || 300;
  const pad = { t: 14, r: 16, b: 34, l: 52 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const xs = cfg.points.map(p => p.x).filter(isNum), ys = cfg.points.map(p => p.y).filter(isNum);
  const [x0, x1] = cfg.xDomain || niceDomain(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = cfg.yDomain || niceDomain(Math.min(...ys), Math.max(...ys));
  const X = v => pad.l + ((v - x0) / (x1 - x0 || 1)) * iw;
  const Y = v => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih * (cfg.yInvert ? -1 : 1) - (cfg.yInvert ? 0 : 0);
  const Yv = v => {
    const t = (v - y0) / (y1 - y0 || 1);
    return pad.t + ih - (cfg.yInvert ? 1 - t : t) * ih;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    svg += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    const v = y1 - (i / 4) * (y1 - y0);
    svg += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${(cfg.yFmt || (x => x.toFixed(0)))(v)}</text>`;
  }
  for (let i = 0; i <= 5; i++) {
    const xx = pad.l + (i / 5) * iw;
    const v = x0 + (i / 5) * (x1 - x0);
    svg += `<text x="${xx}" y="${H - 12}" fill="#647084" font-size="10.5" text-anchor="middle">${(cfg.xFmt || (x => x.toFixed(0)))(v)}</text>`;
  }
  if (cfg.xLabel) svg += `<text x="${pad.l + iw / 2}" y="${H - 1}" fill="#647084" font-size="10.5" text-anchor="middle">${cfg.xLabel}</text>`;
  for (const p of cfg.points) {
    if (!isNum(p.x) || !isNum(p.y)) continue;
    svg += `<circle cx="${X(p.x).toFixed(1)}" cy="${Yv(p.y).toFixed(1)}" r="${p.r || 4}" fill="${p.color || C.accent2}" opacity="0.72"><title>${p.label || ''}</title></circle>`;
  }
  svg += `</svg>`;
  node.innerHTML = svg;
}

function legend(node, items) {
  node.innerHTML = items.map(i => `<span><i style="background:${i.color}"></i>${i.name}</span>`).join('');
}

/* ============================ 数据加载 ============================ */
async function load() {
  try {
    const [core, health] = await Promise.all([
      fetch('data/core.json').then(r => r.json()),
      fetch('data/health.json').then(r => r.json()),
    ]);
    STATE.core = core; STATE.health = health;
    $('#loading').style.display = 'none';
    $('#hdr-sub').textContent =
      `${core.range.start} — ${core.range.end} · ${core.range.n} 次活动 · ${health.range.days} 天生理数据 · 源自 560 个 FIT 原始文件`;
    $('#foot').innerHTML = `数据生成于 ${new Date(core.generatedAt).toLocaleString('zh-CN')} · 重新解析： <code>python3 scripts/parse_fit.py && python3 scripts/split_data.py</code>`;
    renderOverview(); renderHealth(); renderTraining(); renderActivityTab(); renderPB();
    const h = location.hash.replace('#', '');
    if (h && $('#tab-' + h)) { switchTab(h); if (h === 'activity') ensureActivitySelected(); }
  } catch (e) {
    fatal('数据加载', e);
    $('#loading').innerHTML =
      `<div style="max-width:640px;margin:0 auto;text-align:left">
        <b style="color:#ff6b6b">数据加载失败</b><br><br>
        浏览器禁止 <code>file://</code> 下的本地数据读取。请在项目目录启动一个静态服务器：<br><br>
        <code style="background:#151a23;padding:8px 12px;border-radius:8px;display:block">
        cd /Users/warden/Developer/garmin/fit-lab<br>python3 -m http.server 8848
        </code><br>然后访问 <code>http://localhost:8848</code><br><br>
        <span style="color:#647084">${e.message}</span></div>`;
  }
}

const RUN_CN = ['跑步', '越野跑', '跑步机', '场地跑'];
const isRun = a => RUN_CN.includes(a.sportCn);

/* ============================ 概览 ============================ */
function renderOverview() {
  const core = STATE.core, acts = core.activities;
  const totKm = acts.reduce((s, a) => s + (a.distKm || 0), 0);
  const totH = acts.reduce((s, a) => s + (a.durSec || 0), 0) / 3600;
  const totAsc = acts.reduce((s, a) => s + (a.ascent || 0), 0);
  const runKm = acts.filter(isRun).reduce((s, a) => s + (a.distKm || 0), 0);

  const kpi = [
    { l: '活动总数', v: core.range.n, u: '次', s: `${core.sportCounts['跑步'] || 0} 跑 · ${core.sportCounts['徒步'] || 0} 徒步 · ${core.sportCounts['骑行'] || 0} 骑行` },
    { l: '总距离', v: Math.round(totKm).toLocaleString(), u: 'km', s: `跑步 ${Math.round(runKm)} km` },
    { l: '总时长', v: Math.round(totH).toLocaleString(), u: '小时', s: `约 ${(totH / 24).toFixed(1)} 个完整昼夜` },
    { l: '累计爬升', v: Math.round(totAsc).toLocaleString(), u: 'm', s: `≈ ${(totAsc / 8848).toFixed(1)} 座珠峰` },
  ];
  $('#ov-kpi').innerHTML = kpi.map(k =>
    `<div class="card kpi"><div class="label">${k.l}</div><div class="value">${k.v}<span class="unit">${k.u}</span></div><div class="delta flat">${k.s}</div></div>`).join('');

  // 洞察
  const ry = core.runYearly;
  const last = ry[ry.length - 1], peak = ry.reduce((a, b) => (b.pace && (!a.pace || b.pace < a.pace)) ? b : a, {});
  const vo2s = acts.filter(a => isRun(a) && a.vo2).map(a => ({ d: a.date, v: a.vo2 }));
  const firstVo2 = vo2s[0], lastVo2 = vo2s[vo2s.length - 1], peakVo2 = vo2s.reduce((a, b) => b.v > a.v ? b : a, vo2s[0] || {});
  if (vo2s.length) {
    const drop = peakVo2.v - lastVo2.v;
    $('#ov-note').innerHTML =
      `<b>体能画像</b>：VO2 Max 峰值 <b>${peakVo2.v}</b>（${peakVo2.d}）→ 当前 <b>${lastVo2.v}</b>（${lastVo2.d}），
       落差 <b>${drop.toFixed(0)} 点</b>。
       跑量 ${ry[0].km} km（${ry[0].key}）→ ${ry[ry.length - 1].km} km（${ry[ry.length - 1].key}），
       配速峰值出现在 <b>${peak.key}</b>（${fmtPace(peak.pace)}/km）。
       VO2 Max 与跑量的走势高度一致，说明变化主要来自训练量而非测量噪声。`;
  } else {
    $('#ov-note').innerHTML =
      `<b>体能画像</b>：跑量 ${ry[0].km} km（${ry[0].key}）→ ${ry[ry.length - 1].km} km（${ry[ry.length - 1].key}），
       配速峰值出现在 <b>${peak.key}</b>（${fmtPace(peak.pace)}/km）。本次导出未包含 VO2 Max 字段。`;
  }

  drawRunYearCombo(ry);
  legend($('#ov-run-year-lg'), [
    { name: `跑量 km（柱）：${ry.map(r => r.km).join(' → ')}`, color: C.accent2 },
    { name: '平均配速（右轴，越高越快）', color: C.pace },
    { name: '平均心率（左轴）', color: C.hr },
  ]);

  // 运动类型
  const mix = Object.entries(core.sportCounts).slice(0, 8);
  const mx = mix[0][1];
  $('#ov-sportmix').innerHTML = mix.map(([k, v]) =>
    `<div class="bar-row"><span class="n">${k}</span><span class="b"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${k === '跑步' ? C.accent : k === '徒步' ? C.alt : k === '骑行' ? C.steps : '#5b6b82'}"></i></span><span class="v">${v}</span></div>`).join('');

  // 年度训练量
  const yy = core.yearly;
  groupedBar($('#ov-year'), {
    height: 260,
    labels: yy.map(y => y.key),
    series: [
      { name: '距离 km', color: C.accent2, data: yy.map(y => y.km) },
      { name: '小时', color: C.pace, data: yy.map(y => y.hours) },
      { name: '爬升 百米', color: C.alt, data: yy.map(y => y.ascent / 100) },
    ],
    fmt: v => Math.round(v),
  });
  legend($('#ov-year-lg'), [
    { name: '距离 km', color: C.accent2 },
    { name: '时长 h', color: C.pace },
    { name: '爬升（百米）', color: C.alt },
  ]);

  // 月度活动数
  const mm = core.monthly;
  barChart($('#ov-month'), {
    height: 240, labels: mm.map(m => monthLabel(m.key)), values: mm.map(m => m.n),
    colors: (L, i, v) => v === 0 ? '#2b3442' : `rgba(53,208,186,${0.35 + 0.65 * Math.min(1, v / Math.max(...mm.map(x => x.n)))})`,
    yFmt: v => Math.round(v), rotate: true,
  });

  // 跑步效率散点
  const pts = acts.filter(a => isRun(a) && a.distKm >= 2 && a.avgHR)
    .map(a => ({ x: (a.durSec / 60) / a.distKm, y: a.avgHR, d: a.date, km: a.distKm }))
    .filter(p => p.x > 2.5 && p.x < 12);
  const dates = pts.map(p => new Date(p.d).getTime());
  const d0 = Math.min(...dates), d1 = Math.max(...dates);
  scatter($('#ov-efficiency'), {
    height: 300,
    points: pts.map(p => ({
      x: p.x, y: p.y, r: 3.6,
      color: `hsl(${200 - 190 * ((new Date(p.d).getTime() - d0) / (d1 - d0 || 1))}, 72%, 58%)`,
      label: `${p.d} · ${p.km} km · ${fmtPace(p.x)}/km · ${p.y} bpm`,
    })),
    xFmt: v => fmtPace(v) === '—' ? '' : fmtPace(v),
    yFmt: v => Math.round(v),
    xLabel: '配速 min/km（越左越快）',
  });
}

function drawRunYearCombo(ry) {
  const node = $('#ov-run-year');
  const W = node.clientWidth || 600, H = 280;
  const pad = { t: 14, r: 52, b: 26, l: 50 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = ry.length;
  const kmMax = Math.max(...ry.map(r => r.km)) * 1.18;
  const [p0, p1] = niceDomain(Math.min(...ry.map(r => r.pace)) - 0.25, Math.max(...ry.map(r => r.pace)) + 0.25);
  const [h0, h1] = niceDomain(Math.min(...ry.map(r => r.hr)) - 5, Math.max(...ry.map(r => r.hr)) + 5);
  const gw = iw / n, bw = gw * 0.34;
  const Xc = i => pad.l + i * gw + gw / 2;
  const Ykm = v => pad.t + ih - (v / kmMax) * ih;
  const Yp = v => pad.t + ih - ((v - p0) / (p1 - p0 || 1)) * ih;   // 配速：值小在上
  const Yh = v => pad.t + ih - ((v - h0) / (h1 - h0 || 1)) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    s += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    s += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${Math.round(kmMax - (i / 4) * kmMax)}</text>`;
    s += `<text x="${W - pad.r + 8}" y="${yy + 4}" fill="#c9a227" font-size="10.5">${fmtPace(p1 - (i / 4) * (p1 - p0))}</text>`;
  }
  ry.forEach((r, i) => {
    const h = (r.km / kmMax) * ih;
    s += `<rect x="${(Xc(i) - bw / 2).toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${C.accent2}" opacity="0.34"/>`;
    s += `<text x="${Xc(i).toFixed(1)}" y="${(pad.t + ih - h - 6).toFixed(1)}" fill="#7fe3d5" font-size="11" text-anchor="middle" font-weight="600">${r.km}</text>`;
    s += `<text x="${Xc(i).toFixed(1)}" y="${H - 8}" fill="#8b93a5" font-size="11.5" text-anchor="middle">${r.key}</text>`;
  });
  const path = (getY, key, col) => {
    let d = '';
    ry.forEach((r, i) => { const y = getY(r[key]); d += `${i ? 'L' : 'M'}${Xc(i).toFixed(1)},${y.toFixed(1)}`; });
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round"/>`;
  };
  s += path(Yp, 'pace', C.pace) + path(Yh, 'hr', C.hr);
  ry.forEach((r, i) => {
    s += `<circle cx="${Xc(i).toFixed(1)}" cy="${Yp(r.pace).toFixed(1)}" r="4" fill="${C.pace}"/>`;
    s += `<circle cx="${Xc(i).toFixed(1)}" cy="${Yh(r.hr).toFixed(1)}" r="4" fill="${C.hr}"/>`;
    s += `<rect x="${(Xc(i) - gw / 2).toFixed(1)}" y="${pad.t}" width="${gw.toFixed(1)}" height="${ih}" fill="transparent">
      <title>${r.key}\n跑量 ${r.km} km / ${r.n} 次\n配速 ${fmtPace(r.pace)}/km\n心率 ${r.hr} bpm\n功率 ${r.pw || '—'} W\n垂直振幅 ${r.vo || '—'} mm</title></rect>`;
  });
  s += `</svg>`;
  node.innerHTML = s;
}

/* ============================ 健康趋势 ============================ */
function renderHealth() {
  const H = STATE.health, daily = H.daily;
  const recent = daily.slice(-30);
  const prev = daily.slice(-60, -30);
  const avg = (arr, f) => { const v = arr.map(x => x[f]).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  const kpis = [
    { l: '静息心率 30 日', v: nf(avg(recent, 'rhr'), 1), u: 'bpm', d: avg(recent, 'rhr') - avg(prev, 'rhr'), good: -1, unit: '' },
    { l: '睡眠 30 日', v: nf(avg(recent, 'sleepH'), 1), u: '小时', d: avg(recent, 'sleepH') - avg(prev, 'sleepH'), good: 1, unit: 'h' },
    { l: '睡眠评分 30 日', v: nf(avg(recent, 'sleepScore'), 0), u: '', d: avg(recent, 'sleepScore') - avg(prev, 'sleepScore'), good: 1, unit: '' },
    { l: '日均步数 30 日', v: Math.round(avg(recent, 'steps') || 0).toLocaleString(), u: '步', d: avg(recent, 'steps') - avg(prev, 'steps'), good: 1, unit: '' },
  ];
  $('#he-kpi').innerHTML = kpis.map(k => {
    const dd = k.d;
    const cls = !isNum(dd) || Math.abs(dd) < 0.05 ? 'flat' : (dd * k.good > 0 ? 'up' : 'down');
    const arrow = cls === 'flat' ? '' : (dd > 0 ? '▲' : '▼');
    const dv = k.unit === 'h' ? nf(Math.abs(dd), 2) : nf(Math.abs(dd), k.l.includes('步数') ? 0 : 1);
    return `<div class="card kpi"><div class="label">${k.l}</div><div class="value">${k.v}<span class="unit">${k.u}</span></div>
      <div class="delta ${cls}">${arrow} ${dv} 较前 30 日</div></div>`;
  }).join('');

  const first30 = avg(daily.slice(0, 30), 'rhr'), now30 = avg(recent, 'rhr');
  $('#he-note').innerHTML =
    `<b>长期变化</b>：静息心率从最初 30 日的 <b>${nf(first30, 1)}</b> 到现在 <b>${nf(now30, 1)}</b>（${now30 > first30 ? '+' : ''}${nf(now30 - first30, 1)} bpm）；
     日均睡眠 <b>${nf(avg(daily.slice(0, 90), 'sleepH'), 2)}</b> → <b>${nf(avg(recent, 'sleepH'), 2)}</b> 小时。
     体重仅 <b>${H.weights.length}</b> 条记录（覆盖率 ${(H.weights.length / daily.length * 100).toFixed(0)}%），趋势仅供参考。`;

  // RHR
  const rangeBtns = [['all', '全部'], ['365', '近 1 年'], ['180', '近 半年'], ['90', '近 90 天']];
  $('#he-rhr-range').innerHTML = rangeBtns.map(([v, l]) =>
    `<button class="chip ${STATE.rhrRange === v ? 'on' : ''}" data-r="${v}">${l}</button>`).join('');
  $$('#he-rhr-range .chip').forEach(b => b.onclick = () => { STATE.rhrRange = b.dataset.r; renderHealth(); });

  let d = daily;
  if (STATE.rhrRange !== 'all') d = daily.slice(-Number(STATE.rhrRange));
  const step = Math.max(1, Math.floor(d.length / 900));
  const dd = d.filter((_, i) => i % step === 0);
  lineChart($('#he-rhr'), {
    height: 300,
    x: dd.map(x => x.date.slice(2, 7)),
    series: [
      { name: '每日', color: C.hr, data: dd.map(x => x.rhr), width: 1, fill: true },
      { name: '30 日均', color: '#ff9db1', data: dd.map(x => x.rhr30), width: 2.6 },
    ],
    yFmt: v => Math.round(v),
    tip: i => `<div class="t">${dd[i].date}</div>
      <div class="r"><span>静息心率</span><b>${dd[i].rhr ?? '—'} bpm</b></div>
      <div class="r"><span>30 日均</span><b>${dd[i].rhr30 ?? '—'}</b></div>
      <div class="r"><span>睡眠</span><b>${dd[i].sleepH ?? '—'} h</b></div>
      <div class="r"><span>步数</span><b>${(dd[i].steps ?? 0).toLocaleString()}</b></div>`,
  });

  // 睡眠
  const m = H.monthly;
  lineChart($('#he-sleep'), {
    height: 250, x: m.map(x => monthLabel(x.month)),
    series: [
      { name: '时长', color: C.sleep, data: m.map(x => x.sleepH), width: 2.2 },
      { name: '评分', color: C.cad, data: m.map(x => x.score), axis: 'y2', width: 1.8, dash: '4 3' },
    ],
    yFmt: v => v.toFixed(1) + 'h', y2Fmt: v => Math.round(v),
    tip: i => `<div class="t">${m[i].month}</div>
      <div class="r"><span>睡眠</span><b>${m[i].sleepH ?? '—'} h</b></div>
      <div class="r"><span>评分</span><b>${m[i].score ?? '—'}</b></div>
      <div class="r"><span>深睡</span><b>${m[i].deepH ?? '—'} h</b></div>
      <div class="r"><span>REM</span><b>${m[i].remH ?? '—'} h</b></div>`,
  });
  legend($('#he-sleep-lg'), [{ name: '睡眠时长（左轴）', color: C.sleep }, { name: '睡眠评分（右轴）', color: C.cad }]);

  stackedBar($('#he-sleepstruct'), {
    height: 250, labels: m.map(x => monthLabel(x.month)),
    stacks: [
      { name: '深睡', color: '#3b5bdb', data: m.map(x => x.deepH || 0) },
      { name: 'REM', color: '#7b8cff', data: m.map(x => x.remH || 0) },
      { name: '清醒', color: '#e8965e', data: m.map(x => x.awakeH || 0) },
    ],
    yFmt: v => v.toFixed(1) + 'h',
  });
  legend($('#he-sleepstruct-lg'), [{ name: '深睡', color: '#3b5bdb' }, { name: 'REM', color: '#7b8cff' }, { name: '清醒', color: '#e8965e' }]);

  // 步数
  lineChart($('#he-steps'), {
    height: 250, x: m.map(x => monthLabel(x.month)),
    series: [{ name: '日均步数', color: C.steps, data: m.map(x => x.steps), width: 2.2, fill: true }],
    yFmt: v => (v / 1000).toFixed(0) + 'k',
    tip: i => `<div class="t">${m[i].month}</div><div class="r"><span>日均步数</span><b>${(m[i].steps ?? 0).toLocaleString()}</b></div>`,
  });

  // 星期节律：步数柱状 + 各指标明细表
  const wd = H.weekday;
  groupedBar($('#he-weekday'), {
    height: 200, labels: wd.map(w => w.label),
    series: [{ name: '日均步数', color: C.steps, data: wd.map(w => w.steps || 0) }],
    fmt: v => Math.round(v).toLocaleString(), yFmt: v => (v / 1000).toFixed(0) + 'k',
  });
  const rhrs = wd.map(w => w.rhr).filter(isNum), sleeps = wd.map(w => w.sleepH).filter(isNum);
  const rAvg = rhrs.reduce((a, b) => a + b, 0) / (rhrs.length || 1);
  const slAvg = sleeps.reduce((a, b) => a + b, 0) / (sleeps.length || 1);
  // 相对个人均值着色：静息心率越低越好，睡眠/评分越高越好
  const tint = (v, avg, higherIsBetter) => {
    if (!isNum(v)) return '';
    const d = (v - avg) / (avg || 1);
    const a = Math.min(0.5, Math.abs(d) * 6);
    const good = higherIsBetter ? d > 0 : d < 0;
    return `background:rgba(${good ? '53,208,186' : '255,77,109'},${a.toFixed(2)})`;
  };
  $('#he-weekday-lg').innerHTML =
    `<table style="margin-top:12px"><thead><tr><th>星期</th><th>日均步数</th><th>静息心率</th><th>睡眠时长</th><th>睡眠评分</th></tr></thead><tbody>` +
    wd.map(w => `<tr>
      <td>${w.label}</td>
      <td>${Math.round(w.steps || 0).toLocaleString()}</td>
      <td style="${tint(w.rhr, rAvg, false)}">${nf(w.rhr, 1)}</td>
      <td style="${tint(w.sleepH, slAvg, true)}">${nf(w.sleepH, 2)} h</td>
      <td style="${tint(w.score, 70, true)}">${nf(w.score, 0)}</td></tr>`).join('') +
    `</tbody></table>
    <div class="hint" style="margin-top:8px">绿底＝优于个人均值，红底＝劣于均值。静息心率越低越好，睡眠时长与评分越高越好。</div>`;

  // 半年对比表
  const hy = H.halfyearly;
  const rows = [['', ...hy.map(h => h.key)]];
  const metrics = [['静息心率', 'rhr', 1, 'bpm', -1], ['睡眠时长', 'sleepH', 2, 'h', 1], ['睡眠评分', 'score', 0, '', 1], ['日均步数', 'steps', 0, '', 1]];
  let html = '<thead><tr><th>指标</th>' + hy.map(h => `<th>${h.key}</th>`).join('') + '</tr></thead><tbody>';
  for (const [label, key, dig, unit, good] of metrics) {
    const vals = hy.map(h => h[key]);
    const mn = Math.min(...vals.filter(isNum)), mx = Math.max(...vals.filter(isNum));
    html += `<tr><td>${label}</td>` + vals.map(v => {
      const alpha = isNum(v) ? 0.18 + 0.62 * ((v - mn) / (mx - mn || 1)) : 0;
      const col = good > 0 ? `rgba(53,208,186,${alpha})` : `rgba(255,77,109,${alpha})`;
      return `<td style="background:${col}22;color:${isNum(v) ? '#e6edf6' : '#4a5568'}">${isNum(v) ? (key === 'steps' ? Math.round(v).toLocaleString() : v.toFixed(dig)) : '—'}</td>`;
    }).join('') + '</tr>';
  }
  html += '</tbody>';
  $('#he-half-table').innerHTML = html;

  // 相关性
  const CN = {
    sleepH_vs_rhr: ['睡眠时长', '当日静息心率'],
    sleepH_vs_rhr_next: ['睡眠时长', '次日静息心率'],
    steps_vs_sleepH: ['当日步数', '当晚睡眠时长'],
    score_vs_rhr: ['睡眠评分', '当日静息心率'],
    steps_vs_rhr_next: ['当日步数', '次日静息心率'],
    sleepH_vs_steps_next: ['睡眠时长', '次日步数'],
  };
  $('#he-corr').innerHTML = Object.entries(H.correlations).map(([k, v]) => {
    if (!v) return '';
    const [a, b] = CN[k] || [k, ''];
    const mag = Math.min(1, Math.abs(v.r) / 0.35);
    const col = v.r < 0 ? C.accent2 : C.hr;
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span style="color:#97a3b6">${a} → ${b}</span>
        <b style="color:${col};font-variant-numeric:tabular-nums">r = ${v.r}</b>
      </div>
      <div style="height:6px;background:#1b212c;border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${(mag * 100).toFixed(0)}%;background:${col};opacity:.85"></div>
      </div>
      <div style="font-size:11px;color:#647084;margin-top:3px">n = ${v.n} 天</div></div>`;
  }).join('');

  // 体重
  const w = H.weights;
  $('#he-weight-hint').textContent = `${w.length} 条记录 · ${w.length ? w[0].date + ' — ' + w[w.length - 1].date : ''}`;
  if (w.length) {
    lineChart($('#he-weight'), {
      height: 220, x: w.map(x => x.date.slice(2)),
      series: [{ name: '体重 kg', color: C.weight, data: w.map(x => x.kg), width: 2, dot: true, dotOpacity: 0.9 }],
      yFmt: v => v.toFixed(1),
      yDomain: niceDomain(Math.min(...w.map(x => x.kg)) - 1, Math.max(...w.map(x => x.kg)) + 1),
      tip: i => `<div class="t">${w[i].date}</div><div class="r"><span>体重</span><b>${w[i].kg} kg</b></div>
        <div class="r"><span>体脂</span><b>${w[i].fat ?? '—'}%</b></div>`,
    });
  } else $('#he-weight').innerHTML = '<div class="empty">无体重数据</div>';
}

/* ============================ 训练分析 ============================ */
function renderTraining() {
  const core = STATE.core, acts = core.activities;
  const totLoad = acts.reduce((s, a) => s + (a.load || 0), 0);
  const totCal = acts.reduce((s, a) => s + (a.cal || 0), 0);
  const withPower = acts.filter(a => a.avgPower).length;
  const kpi = [
    { l: '累计训练负荷', v: Math.round(totLoad).toLocaleString(), u: '', s: 'Garmin Training Load' },
    { l: '累计消耗', v: Math.round(totCal).toLocaleString(), u: 'kcal', s: `≈ ${(totCal / 7700).toFixed(1)} kg 脂肪` },
    { l: '有功率数据', v: withPower, u: '次', s: '主要来自跑步' },
    { l: '最高心率记录', v: core.hrMaxObserved, u: 'bpm', s: '全部活动中的观测峰值' },
  ];
  $('#tr-kpi').innerHTML = kpi.map(k =>
    `<div class="card kpi"><div class="label">${k.l}</div><div class="value">${k.v}<span class="unit">${k.u}</span></div><div class="delta flat">${k.s}</div></div>`).join('');

  // 负荷月度
  const mm = core.monthly;
  barChart($('#tr-load'), {
    height: 250, labels: mm.map(x => monthLabel(x.key)), values: mm.map(x => x.load),
    colors: (L, i, v) => v === 0 ? '#2b3442' : `rgba(255,122,61,${0.3 + 0.7 * Math.min(1, v / Math.max(...mm.map(x => x.load)))})`,
    yFmt: v => Math.round(v), rotate: true,
  });

  // 心率区间（按活动加权：用有 zones 的活动求平均）
  const zActs = acts.filter(a => a.zones);
  if (zActs.length) {
    const avg = [0, 0, 0, 0, 0];
    zActs.forEach(a => a.zones.forEach((v, i) => avg[i] += v));
    const z = avg.map(v => v / zActs.length);
    const names = ['Z1 <60%', 'Z2 60-70%', 'Z3 70-80%', 'Z4 80-90%', 'Z5 >90%'];
    $('#tr-zones').innerHTML = z.map((v, i) =>
      `<div style="width:${v.toFixed(1)}%;background:${C.z[i]}" title="${names[i]} ${v.toFixed(1)}%">${v > 6 ? v.toFixed(0) + '%' : ''}</div>`).join('');
    $('#tr-zones-lg').innerHTML = names.map((n, i) =>
      `<span><i style="background:${C.z[i]}"></i>${n} · ${z[i].toFixed(1)}%</span>`).join('');
  }

  // 负荷 vs 静息心率
  const hm = STATE.health.monthly;
  const byMonth = Object.fromEntries(hm.map(x => [x.month, x.rhr]));
  const labels = mm.map(x => x.key);
  const load = mm.map(x => x.load);
  const rhr = mm.map(x => byMonth[x.key] ?? null);
  drawLoadRhrCombo(labels, load, rhr);
  legend($('#tr-load-rhr-lg'), [{ name: '月度训练负荷（柱）', color: 'rgba(255,122,61,0.75)' }, { name: '月度静息心率（线，右轴）', color: C.hr }]);

  // 筛选器
  const types = ['全部类型', ...new Set(acts.map(a => a.sportCn))];
  const years = ['全部年份', ...[...new Set(acts.map(a => (a.date || '').slice(0, 4)))].sort()];
  $('#tr-type').innerHTML = types.map(t => `<option>${t}</option>`).join('');
  $('#tr-year').innerHTML = years.map(t => `<option>${t}</option>`).join('');
  const draw = () => renderActTable($('#tr-table'), 'tr');
  $('#tr-type').onchange = draw; $('#tr-year').onchange = draw; $('#tr-sort').onchange = draw;
  draw();
}

/** 训练负荷（柱） + 静息心率（线）组合图 */
function drawLoadRhrCombo(labels, load, rhr) {
  const node = $('#tr-load-rhr');
  const W = node.clientWidth || 700, H = 270;
  const pad = { t: 14, r: 48, b: 40, l: 50 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = labels.length;
  const lMax = Math.max(...load.filter(isNum), 1) * 1.15;
  const rv = rhr.filter(isNum);
  const [r0, r1] = rv.length ? niceDomain(Math.min(...rv) - 2, Math.max(...rv) + 2) : [0, 1];
  const bw = iw / n;
  const Xc = i => pad.l + i * bw + bw / 2;
  const Yl = v => pad.t + ih - (v / lMax) * ih;
  const Yr = v => pad.t + ih - ((v - r0) / (r1 - r0 || 1)) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih;
    s += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    s += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${Math.round(lMax - (i / 4) * lMax)}</text>`;
    s += `<text x="${W - pad.r + 8}" y="${yy + 4}" fill="#ff6b6b" font-size="10.5">${Math.round(r1 - (i / 4) * (r1 - r0))}</text>`;
  }
  load.forEach((v, i) => {
    const h = (v / lMax) * ih;
    s += `<rect x="${(Xc(i) - bw * 0.34).toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="rgba(255,122,61,0.5)"/>`;
    if (i % 2 === 0) s += `<text x="${Xc(i).toFixed(1)}" y="${H - 24}" fill="#647084" font-size="9.5" text-anchor="end" transform="rotate(-52 ${Xc(i).toFixed(1)} ${H - 24})">${monthLabel(labels[i])}</text>`;
  });
  let d = '', started = false;
  rhr.forEach((v, i) => {
    if (!isNum(v)) { started = false; return; }
    d += `${started ? 'L' : 'M'}${Xc(i).toFixed(1)},${Yr(v).toFixed(1)}`;
    started = true;
  });
  s += `<path d="${d}" fill="none" stroke="${C.hr}" stroke-width="2.2" stroke-linejoin="round"/>`;
  rhr.forEach((v, i) => {
    if (!isNum(v)) return;
    s += `<circle cx="${Xc(i).toFixed(1)}" cy="${Yr(v).toFixed(1)}" r="2.6" fill="${C.hr}"/>`;
    s += `<rect x="${(Xc(i) - bw / 2).toFixed(1)}" y="${pad.t}" width="${bw.toFixed(1)}" height="${ih}" fill="transparent">
      <title>${labels[i]}\n训练负荷 ${Math.round(load[i])}\n静息心率 ${v} bpm</title></rect>`;
  });
  s += `</svg>`;
  node.innerHTML = s;
}

function filteredActs(prefix) {
  const t = $(`#${prefix}-type`)?.value || '全部类型';
  const y = $(`#${prefix}-year`)?.value || '全部年份';
  const s = $(`#${prefix}-sort`)?.value || 'date_desc';
  const q = ($(`#${prefix}-search`)?.value || '').trim().toLowerCase();
  let a = STATE.core.activities.filter(x =>
    (t === '全部类型' || x.sportCn === t) &&
    (y === '全部年份' || (x.date || '').slice(0, 4) === y) &&
    (!q || (x.name || '').toLowerCase().includes(q) || (x.location || '').toLowerCase().includes(q)));
  const cmp = {
    date_desc: (p, q) => (q.date || '').localeCompare(p.date || ''),
    date_asc: (p, q) => (p.date || '').localeCompare(q.date || ''),
    dist_desc: (p, q) => (q.distKm || 0) - (p.distKm || 0),
    dur_desc: (p, q) => (q.durSec || 0) - (p.durSec || 0),
    hr_desc: (p, q) => (q.avgHR || 0) - (p.avgHR || 0),
    load_desc: (p, q) => (q.load || 0) - (p.load || 0),
  }[s];
  return a.sort(cmp);
}

function renderActTable(node, prefix) {
  const a = filteredActs(prefix);
  const head = `<thead><tr><th>日期</th><th>类型</th><th>名称</th><th>距离</th><th>时长</th><th>配速</th>
    <th>均心率</th><th>最大心率</th><th>功率</th><th>爬升</th><th>负荷</th><th>VO2</th></tr></thead>`;
  const body = a.map(x => {
    const pace = x.distKm ? (x.durSec / 60) / x.distKm : null;
    return `<tr class="click" data-id="${x.id}">
      <td>${x.date}</td>
      <td>${x.sportCn}</td>
      <td style="text-align:left;max-width:220px;overflow:hidden;text-overflow:ellipsis">${x.name || '—'}</td>
      <td>${fmtKm(x.distKm)} km</td>
      <td>${fmtDur(x.durSec)}</td>
      <td>${x.distKm && x.durSec ? fmtPace(pace) : '—'}</td>
      <td>${x.avgHR ?? '—'}</td>
      <td>${x.maxHR ?? '—'}</td>
      <td>${x.avgPower ?? '—'}</td>
      <td>${x.ascent ?? '—'} m</td>
      <td>${Math.round(x.load || 0) || '—'}</td>
      <td>${x.vo2 ?? '—'}</td></tr>`;
  }).join('');
  node.innerHTML = head + `<tbody>${body || '<tr><td colspan="12" class="empty">无匹配活动</td></tr>'}</tbody>`;
  $$('#' + node.id + ' tbody tr').forEach(tr => {
    tr.onclick = () => { if (tr.dataset.id) openActivity(tr.dataset.id); };
  });
}

/* 进入活动详情页签时，若还没选过活动就自动打开最近一次，避免看到空白 */
function ensureActivitySelected() {
  if (STATE.act || !STATE.core) return;
  const list = STATE.core.activities;
  const last = list[list.length - 1];
  if (last) openActivity(last.id);
}

/* ============================ 活动详情 ============================ */
function renderActivityTab() {
  const acts = STATE.core.activities;
  $('#ac-count').textContent = acts.length;
  const types = ['全部类型', ...new Set(acts.map(a => a.sportCn))];
  const years = ['全部年份', ...[...new Set(acts.map(a => (a.date || '').slice(0, 4)))].sort()];
  $('#ac-type').innerHTML = types.map(t => `<option>${t}</option>`).join('');
  $('#ac-year').innerHTML = years.map(t => `<option>${t}</option>`).join('');
  ['#ac-type', '#ac-year'].forEach(s => $(s).onchange = () => renderActTable($('#ac-table'), 'ac'));
  $('#ac-search').oninput = () => renderActTable($('#ac-table'), 'ac');
  renderActTable($('#ac-table'), 'ac');
}

async function openActivity(id) {
  STATE.tab = 'activity';
  switchTab('activity');
  const a = STATE.core.activities.find(x => x.id === id);
  if (!a) { fatal('找不到活动', id); return; }
  STATE.act = a;
  $('#ac-detail').style.display = 'none';
  let st;
  try {
    const res = await fetch(`data/streams/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    st = await res.json();
  } catch (e) {
    $('#ac-detail').style.display = '';
    fatal('加载活动明细失败 ' + id, e);
    return;
  }
  STATE.stream = st;
  renderActivity(a, st);
  if ($('#ac-detail').scrollIntoView) $('#ac-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderActivity(a, st) {
  $('#ac-detail').style.display = '';
  const emptyCard = $('#ac-empty');
  if (emptyCard) emptyCard.style.display = 'none';
  $('#ac-title').textContent = a.name || a.sportCn;
  const pace = a.distKm && a.durSec ? (a.durSec / 60) / a.distKm : null;
  $('#ac-subtitle').textContent =
    `${a.date} ${a.time || ''} · ${a.sportCn}${a.location ? ' · ' + a.location : ''} · ${a.nLaps} 个分段 · ${st.series.sec?.length || 0} 个采样点`;

  const kpi = [
    ['距离', fmtKm(a.distKm), 'km'], ['时长', fmtDur(a.durSec), ''],
    ['配速', pace ? fmtPace(pace) : '—', pace ? '/km' : ''],
    ['均心率', a.avgHR ?? '—', 'bpm'], ['最大心率', a.maxHR ?? '—', 'bpm'],
    ['爬升', a.ascent ?? '—', 'm'],
  ];
  $('#ac-kpi').innerHTML = kpi.map(([l, v, u]) =>
    `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}<span class="unit">${u}</span></div></div>`).join('');

  const S = st.series;
  const x = S.km || S.sec || [];
  const xl = S.km ? S.km.map(k => k.toFixed(1)) : (S.sec || []).map(s => Math.round(s / 60) + 'm');

  // 心率 + 配速（配速反转）
  {
    const hasPace = !!(S.pace && S.pace.some(isNum));
    const series = [{ name: '心率', color: C.hr, data: S.hr || [], width: 1.8, fill: true }];
    if (hasPace) series.push({ name: '配速', color: C.pace, data: S.pace, axis: 'y2', width: 1.8 });
    const pvals = (S.pace || []).filter(isNum);
    lineChart($('#ac-hr-pace'), {
      height: 260, x: xl, series,
      yFmt: v => Math.round(v) + '', y2Fmt: v => fmtPace(v),
      y2Invert: true,
      y2Domain: pvals.length ? niceDomain(Math.min(...pvals) - 0.3, Math.max(...pvals) + 0.3) : null,
      tip: i => `<div class="t">${(S.km ? S.km[i]?.toFixed(2) + ' km' : fmtDur(S.sec?.[i]))}</div>
        <div class="r"><span>心率</span><b>${nf(S.hr?.[i], 0)} bpm</b></div>
        ${S.pace?.[i] ? `<div class="r"><span>配速</span><b>${fmtPace(S.pace[i])}/km</b></div>` : ''}
        ${S.cad?.[i] ? `<div class="r"><span>步频</span><b>${nf(S.cad[i], 0)} spm</b></div>` : ''}`,
    });
    legend($('#ac-hr-pace-lg'), [{ name: '心率 bpm（左）', color: C.hr }, ...(hasPace ? [{ name: '配速 min/km（右，越高越快）', color: C.pace }] : [])]);
  }

  // 海拔
  if (S.alt && S.alt.some(isNum)) {
    lineChart($('#ac-alt'), {
      height: 260, x: xl,
      series: [{ name: '海拔', color: C.alt, data: S.alt, width: 1.6, fill: true }],
      yFmt: v => Math.round(v) + 'm',
      tip: i => `<div class="t">${S.km?.[i]?.toFixed(2) ?? ''} km</div><div class="r"><span>海拔</span><b>${nf(S.alt[i], 0)} m</b></div>`,
    });
  } else $('#ac-alt').innerHTML = '<div class="empty">本次活动无海拔数据</div>';

  // 功率
  if (S.power && S.power.some(isNum)) {
    $('#ac-power-card').style.display = '';
    lineChart($('#ac-power'), {
      height: 250, x: xl,
      series: [{ name: '功率', color: C.power, data: S.power, width: 1.6, fill: true }],
      yFmt: v => Math.round(v) + 'W',
      tip: i => `<div class="t">${S.km?.[i]?.toFixed(2) ?? ''} km</div><div class="r"><span>功率</span><b>${nf(S.power[i], 0)} W</b></div>`,
    });
  } else $('#ac-power-card').style.display = 'none';

  // 动力学
  const dyn = [];
  if (S.vo && S.vo.some(isNum)) dyn.push({ name: '垂直振幅 mm', color: '#ffd166', data: S.vo, width: 1.6 });
  if (S.stance && S.stance.some(isNum)) dyn.push({ name: '触地时间 ms', color: '#a26bff', data: S.stance, width: 1.6, axis: 'y2' });
  if (S.steplen && S.steplen.some(isNum)) dyn.push({ name: '步幅 m', color: C.cad, data: S.steplen, width: 1.6 });
  if (dyn.length) {
    $('#ac-dyn-card').style.display = '';
    lineChart($('#ac-dyn'), {
      height: 250, x: xl, series: dyn,
      yFmt: v => v.toFixed(dyn.some(d => d.name.includes('步幅')) ? 2 : 0),
      y2Fmt: v => Math.round(v),
      tip: i => `<div class="t">${S.km?.[i]?.toFixed(2) ?? ''} km</div>
        ${S.vo?.[i] ? `<div class="r"><span>垂直振幅</span><b>${nf(S.vo[i], 1)} mm</b></div>` : ''}
        ${S.stance?.[i] ? `<div class="r"><span>触地时间</span><b>${nf(S.stance[i], 0)} ms</b></div>` : ''}
        ${S.steplen?.[i] ? `<div class="r"><span>步幅</span><b>${nf(S.steplen[i], 2)} m</b></div>` : ''}`,
    });
    legend($('#ac-dyn-lg'), dyn.map(d => ({ name: d.name, color: d.color })));
  } else $('#ac-dyn-card').style.display = 'none';

  // 统计
  const rows = [
    ['活动类型', a.sportCn], ['开始时间', `${a.date} ${a.time || ''}`],
    ['移动时长', fmtDur(a.durSec)], ['总用时', fmtDur(a.elapsedSec)],
    ['卡路里', a.cal ? a.cal + ' kcal' : '—'],
    ['训练负荷', a.load ? Math.round(a.load) : '—'],
    ['有氧/无氧效应', (a.aerobic ?? '—') + ' / ' + (a.anaerobic ?? '—')],
    ['VO2 Max', a.vo2 ?? '—'],
    ['平均功率', a.avgPower ? a.avgPower + ' W' : '—'],
    ['标准化功率', a.np ? a.np + ' W' : '—'],
    ['最大功率', a.maxPower ? a.maxPower + ' W' : '—'],
    ['平均步频', a.avgCad ? a.avgCad + ' spm' : '—'],
    ['垂直振幅', a.vo ? a.vo + ' mm' : '—'],
    ['垂直比', a.vr ? a.vr + '%' : '—'],
    ['触地时间', a.stance ? a.stance + ' ms' : '—'],
    ['平均步幅', a.stepLen ? a.stepLen + ' m' : '—'],
    ['爬升 / 下降', (a.ascent ?? '—') + ' m'],
    ['心率区间', a.hrStats ? `${a.hrStats.p50} (中位) / ${a.hrStats.max} (峰值)` : '—'],
    ['身体电量变化', a.battery ?? '—'],
  ];
  $('#ac-stats').innerHTML = rows.map(([k, v]) =>
    `<div class="stat-line"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');

  // 心率区间
  if (a.zones) {
    const names = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
    $('#ac-zones').innerHTML = a.zones.map((v, i) =>
      `<div style="width:${v.toFixed(1)}%;background:${C.z[i]}" title="${names[i]} ${v.toFixed(1)}%">${v > 6 ? v.toFixed(0) + '%' : ''}</div>`).join('');
    $('#ac-zones-lg').innerHTML = names.map((n, i) =>
      `<span><i style="background:${C.z[i]}"></i>${n} ${a.zones[i].toFixed(0)}%</span>`).join('');
  } else { $('#ac-zones').innerHTML = ''; $('#ac-zones-lg').innerHTML = ''; }

  // 分段
  if (st.laps && st.laps.length) {
    $('#ac-laps-hint').textContent = `${st.laps.length} 段`;
    $('#ac-laps').innerHTML = `<thead><tr><th>#</th><th>距离</th><th>用时</th><th>配速</th><th>均心率</th><th>最大心率</th><th>功率</th><th>步频</th></tr></thead><tbody>` +
      st.laps.map((l, i) => {
        const p = l.dist && l.sec ? (l.sec / 60) / l.dist : null;
        return `<tr><td>${i + 1}</td><td>${fmtKm(l.dist)} km</td><td>${fmtDur(l.sec)}</td>
          <td>${p ? fmtPace(p) : '—'}</td><td>${l.hr ?? '—'}</td><td>${l.maxHr ?? '—'}</td>
          <td>${l.power ?? '—'}</td><td>${l.cad ?? '—'}</td></tr>`;
      }).join('') + '</tbody>';
  } else { $('#ac-laps').innerHTML = '<tbody><tr><td class="empty">无分段数据</td></tr></tbody>'; $('#ac-laps-hint').textContent = ''; }

  // 最佳成绩
  const ef = a.efforts || {};
  const labels = { '400': '400 m', '1000': '1 km', '3000': '3 km', '5000': '5 km', '10000': '10 km', '21097': '半马' };
  const items = Object.entries(ef);
  $('#ac-efforts').innerHTML = items.length ? items.map(([k, v]) =>
    `<div class="pb-card" style="margin-bottom:10px">
      <div class="d">${labels[k] || k + ' m'}</div>
      <div class="t">${fmtDur(v.sec)}</div>
      <div class="m">${fmtPace(v.pace)}/km · 起于 ${(v.startM / 1000).toFixed(1)} km 处</div>
    </div>`).join('') : '<div class="empty">无可计算的最佳成绩（距离不足）</div>';

  drawTrack(st.track, a);
}

/* ---------- 轨迹 ---------- */
function wgs2gcj(lat, lon) {
  const a = 6378245.0, ee = 0.00669342162296594323;
  const PI = Math.PI;
  const outOfChina = lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
  if (outOfChina) return [lat, lon];
  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLon = transformLon(lon - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat); magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
  dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
  return [lat + dLat, lon + dLon];
}
function transformLat(x, y) {
  const PI = Math.PI;
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}
function transformLon(x, y) {
  const PI = Math.PI;
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/** 判断腾讯地图密钥代理是否已被运行时注入（自建静态服务器时占位符不会被替换） */
function tmapReady() {
  if (typeof TMap === 'undefined') return false;
  const host = (window._TMapSecurityConfig && window._TMapSecurityConfig.serviceHost) || '';
  return host && !host.includes('__WB_HTTP_PORT__') && !host.includes('__WB_TMAP_SECRET__');
}

let mapObj = null;
function drawTrack(track, a) {
  const fb = $('#map-fallback');
  const mp = $('#map');
  if (!track || !track.lat || track.lat.length < 2) {
    mp.style.display = 'none'; fb.style.display = '';
    fb.innerHTML = '<div class="empty">本次活动无 GPS 轨迹</div>';
    return;
  }
  const pts = track.lat.map((la, i) => wgs2gcj(la, track.lon[i]));

  // 纯 SVG 轨迹图：始终先画出来，保证任何环境下都能看到
  const renderSvgTrack = (note) => {
    mp.style.display = 'none'; fb.style.display = '';
    const W = fb.clientWidth || 640, H = 340, pad = 30;
    const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
    const la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
    const sla = (la1 - la0) || 0.001, slo = (lo1 - lo0) || 0.001;
    const cos = Math.cos((la0 + la1) / 2 * Math.PI / 180);
    const sc = Math.min((W - pad * 2) / (slo * cos), (H - pad * 2) / sla);
    const ox = (W - slo * cos * sc) / 2, oy = (H - sla * sc) / 2;
    const X = lo => ox + (lo - lo0) * cos * sc;
    const Y = la => H - oy - (la - la0) * sc;

    // 沿轨迹累计距离，用于公里标记
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineM(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];

    let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
      <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="#1e2531" stroke-width="1"/></pattern></defs>
      <rect width="${W}" height="${H}" fill="#12171f" rx="10"/>
      <rect width="${W}" height="${H}" fill="url(#grid)" rx="10"/>
      <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[1]).toFixed(1)},${Y(p[0]).toFixed(1)}`).join('')}"
        fill="none" stroke="#ff7a3d" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;

    // 每公里标记
    const kmStep = total > 30000 ? 5000 : total > 10000 ? 2000 : 1000;
    for (let d = kmStep; d < total; d += kmStep) {
      let i = cum.findIndex(c => c >= d);
      if (i < 0) continue;
      s += `<circle cx="${X(pts[i][1]).toFixed(1)}" cy="${Y(pts[i][0]).toFixed(1)}" r="2.6" fill="#ffd166"/>
        <text x="${(X(pts[i][1]) + 6).toFixed(1)}" y="${(Y(pts[i][0]) - 5).toFixed(1)}" fill="#ffd166" font-size="9.5">${(d / 1000).toFixed(0)}k</text>`;
    }
    // 起点 / 终点
    s += `<circle cx="${X(pts[0][1]).toFixed(1)}" cy="${Y(pts[0][0]).toFixed(1)}" r="5.5" fill="#51cf66" stroke="#12171f" stroke-width="2"/>`;
    s += `<text x="${(X(pts[0][1]) + 9).toFixed(1)}" y="${(Y(pts[0][0]) + 4).toFixed(1)}" fill="#51cf66" font-size="10.5" font-weight="600">起</text>`;
    const last = pts.length - 1;
    s += `<circle cx="${X(pts[last][1]).toFixed(1)}" cy="${Y(pts[last][0]).toFixed(1)}" r="5.5" fill="#ff6b6b" stroke="#12171f" stroke-width="2"/>`;
    s += `<text x="${(X(pts[last][1]) + 9).toFixed(1)}" y="${(Y(pts[last][0]) + 4).toFixed(1)}" fill="#ff6b6b" font-size="10.5" font-weight="600">终</text>`;

    // 比例尺
    const mPerPx = 1 / (sc / (111320));
    let barM = 100;
    for (const c of [50, 100, 200, 500, 1000, 2000, 5000]) { barM = c; if (c / mPerPx > 90) break; }
    const barPx = barM / mPerPx;
    const bx = 16, by = H - 18;
    s += `<line x1="${bx}" y1="${by}" x2="${bx + barPx}" y2="${by}" stroke="#97a3b6" stroke-width="2"/>
      <line x1="${bx}" y1="${by - 4}" x2="${bx}" y2="${by + 4}" stroke="#97a3b6" stroke-width="2"/>
      <line x1="${bx + barPx}" y1="${by - 4}" x2="${bx + barPx}" y2="${by + 4}" stroke="#97a3b6" stroke-width="2"/>
      <text x="${bx}" y="${by - 8}" fill="#97a3b6" font-size="10">${barM >= 1000 ? barM / 1000 + ' km' : barM + ' m'}</text>`;
    s += `<text x="${W - 14}" y="20" fill="#647084" font-size="10.5" text-anchor="end">${note || '轨迹图'} · ${(total / 1000).toFixed(2)} km</text>`;
    s += `</svg>`;
    fb.innerHTML = s;
  };

  if (!tmapReady()) { renderSvgTrack('轨迹图（未连接底图服务）'); return; }

  // 在底图上绘制轨迹
  const paint = () => {
    new TMap.MultiPolyline({
      map: mapObj,
      styles: { line: new TMap.PolylineStyle({ color: '#ff7a3d', width: 4, borderWidth: 0, lineCap: 'round' }) },
      geometries: [{ id: 'track', styleId: 'line', paths: pts.map(p => new TMap.LatLng(p[0], p[1])) }],
    });
    new TMap.MultiMarker({
      map: mapObj,
      styles: {
        s: new TMap.MarkerStyle({ width: 12, height: 12, src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#51cf66" stroke="#0b0e13" stroke-width="2"/></svg>') }),
        e: new TMap.MarkerStyle({ width: 12, height: 12, src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#ff6b6b" stroke="#0b0e13" stroke-width="2"/></svg>') }),
      },
      geometries: [
        { id: 'start', styleId: 's', position: new TMap.LatLng(pts[0][0], pts[0][1]) },
        { id: 'end', styleId: 'e', position: new TMap.LatLng(pts[pts.length - 1][0], pts[pts.length - 1][1]) },
      ],
    });
    const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
    mapObj.fitBounds(new TMap.LatLngBounds(
      new TMap.LatLng(Math.min(...la), Math.min(...lo)),
      new TMap.LatLng(Math.max(...la), Math.max(...lo))), { padding: 40 });
  };

  // 有底图服务时才用腾讯地图；失败则回退 SVG
  try {
    mp.style.display = 'none'; fb.style.display = '';
    renderSvgTrack('正在加载底图…');
    const center = pts[Math.floor(pts.length / 2)];
    if (mapObj) { try { mapObj.destroy(); } catch (_) {} mapObj = null; }
    mapObj = new TMap.Map(mp, { zoom: 13, center: new TMap.LatLng(center[0], center[1]) });
    let done = false;
    const timer = setTimeout(() => { if (!done) renderSvgTrack('轨迹图（底图加载超时）'); }, 6000);
    mapObj.on('tilesloaded', () => {
      if (done) return; done = true; clearTimeout(timer);
      mp.style.display = ''; fb.style.display = 'none';
      paint();
    });
  } catch (e) { renderSvgTrack('轨迹图（底图不可用）'); }
}

function haversineM(a, b) {
  const R = 6371000, p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180;
  const dp = p2 - p1, dl = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ============================ PB ============================ */
const PB_LABELS = { '400': '400 m', '1000': '1 km', '3000': '3 km', '5000': '5 km', '10000': '10 km', '21097': '半程马拉松' };
function renderPB() {
  const pbs = STATE.core.pbs;
  $('#pb-cards').innerHTML = Object.entries(pbs).map(([k, v]) =>
    `<div class="pb-card">
      <div class="d">${v.label}</div>
      <div class="t">${fmtDur(v.sec)}</div>
      <div class="m">${fmtPace(v.pace)} / km</div>
      <div class="m" style="margin-top:6px;color:#8b93a5">${v.date} · ${v.name || ''}</div>
    </div>`).join('');

  const acts = STATE.core.activities.filter(a => isRun(a) && a.efforts && Object.keys(a.efforts).length);
  const dists = Object.keys(PB_LABELS);
  $('#pb-picker').innerHTML = dists.map(d =>
    `<button class="chip ${STATE.pbDist === d ? 'on' : ''}" data-d="${d}">${PB_LABELS[d]}</button>`).join('');
  $$('#pb-picker .chip').forEach(b => b.onclick = () => { STATE.pbDist = b.dataset.d; renderPB(); });

  const key = STATE.pbDist;
  const pts = acts.filter(a => a.efforts[key]).map(a => ({
    date: a.date, sec: a.efforts[key].sec, pace: a.efforts[key].pace, id: a.id, name: a.name, km: a.distKm,
  })).sort((a, b) => a.date.localeCompare(b.date));
  if (!pts.length) { $('#pb-chart').innerHTML = '<div class="empty">该距离无数据</div>'; return; }

  let best = Infinity, bestLine = [];
  pts.forEach(p => { if (p.sec < best) best = p.sec; bestLine.push(best); });

  const W = $('#pb-chart').clientWidth || 700, H = 300;
  const pad = { t: 16, r: 16, b: 30, l: 54 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const t0 = new Date(pts[0].date).getTime(), t1 = new Date(pts[pts.length - 1].date).getTime();
  const [y0, y1] = niceDomain(Math.min(...pts.map(p => p.sec)) * 0.94, Math.max(...pts.map(p => p.sec)) * 1.03);
  const X = d => pad.l + ((new Date(d).getTime() - t0) / (t1 - t0 || 1)) * iw;
  const Y = v => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}">`;
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (i / 4) * ih, v = y1 - (i / 4) * (y1 - y0);
    s += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="#242c39"/>`;
    s += `<text x="${pad.l - 8}" y="${yy + 4}" fill="#647084" font-size="10.5" text-anchor="end">${fmtDur(v)}</text>`;
  }
  for (let i = 0; i <= 6; i++) {
    const xx = pad.l + (i / 6) * iw;
    const dt = new Date(t0 + (i / 6) * (t1 - t0));
    s += `<text x="${xx}" y="${H - 10}" fill="#647084" font-size="10.5" text-anchor="middle">${String(dt.getFullYear()).slice(2)}/${String(dt.getMonth() + 1).padStart(2, '0')}</text>`;
  }
  let d = '';
  pts.forEach((p, i) => { d += `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(bestLine[i]).toFixed(1)}`; });
  s += `<path d="${d}" fill="none" stroke="${C.accent}" stroke-width="2.6" stroke-linejoin="round"/>`;
  for (const p of pts) {
    const isPb = p.sec === bestLine[pts.indexOf(p)];
    s += `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.sec).toFixed(1)}" r="${isPb ? 5 : 3.2}" fill="${isPb ? C.accent : '#4a5568'}" opacity="${isPb ? 1 : 0.7}"><title>${p.date} · ${fmtDur(p.sec)} · ${fmtPace(p.pace)}/km · ${p.name || ''}</title></circle>`;
  }
  s += `</svg>`;
  $('#pb-chart').innerHTML = s + `<div class="legend">
    <span><i style="background:${C.accent}"></i>历史最佳（阶梯线）</span>
    <span><i style="background:#4a5568"></i>单次活动最好成绩</span></div>`;
}

/* ============================ 导航 ============================ */
function switchTab(name) {
  STATE.tab = name;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { switchTab(b.dataset.tab); location.hash = b.dataset.tab; }
});
// 支持 #activity 之类的锚点直达
addEventListener('hashchange', () => {
  const h = location.hash.replace('#', '');
  if (h && $('#tab-' + h)) { switchTab(h); if (h === 'activity') ensureActivitySelected(); }
});
let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (!STATE.core) return;
    renderOverview(); renderHealth(); renderTraining(); renderPB();
    if (STATE.act && STATE.stream) renderActivity(STATE.act, STATE.stream);
  }, 220);
});

load();
