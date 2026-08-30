/** common.js — 页面共用的 DOM 工具、导航与本地档案存储 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const NAV = [
  ['index.html', '首页'],
  ['assess.html', '开始测评'],
  ['codex.html', '64 型图谱'],
  ['pair.html', '关系相性'],
  ['systems.html', '体系普查'],
  ['method.html', '方法与伦理'],
];

export function mountChrome(active) {
  const header = el('header', { class: 'top' },
    el('div', { class: 'inner' },
      el('a', { class: 'brand', href: 'index.html' },
        el('span', { class: 'logo' }, 'OML'),
        el('span', { class: 'sub' }, '全域命理格 · Omni-Mantic Lattice')),
      el('nav', { class: 'main' },
        NAV.map(([href, label]) => el('a', { href, class: href === active ? 'active' : '' }, label)))));
  document.body.prepend(header);

  document.body.append(el('footer', { class: 'bottom' },
    el('div', { class: 'wrap' },
      el('p', {}, 'OML v1.0 — 一个把世界各地命理体系与现代人格分类统一到十二维连续量表上的开源计算框架。'),
      el('p', {}, '所有输出为结构化自我描述，不构成命运预测、医疗、心理、法律或财务建议。身份类信息（性别认同、性倾向、关系形态）永不作为人格特质的预测变量。'),
      el('p', {}, '城市与时区数据来自 ',
        el('a', { href: 'https://www.geonames.org/', target: '_blank', rel: 'noopener' }, 'GeoNames'),
        '（CC BY 4.0）；时区偏移由浏览器的 IANA 时区库按出生时刻解析。'),
      el('p', {}, el('a', { href: 'method.html' }, '方法与伦理声明'), ' · ',
        el('a', { href: 'systems.html' }, '体系普查与影响力排名'), ' · ',
        el('a', { href: 'https://github.com/dirtycomputer/compute-lunar-claude', target: '_blank', rel: 'noopener' }, '源代码')))));
}

// ——— 本地档案存储（仅存在浏览器本地，不上传） ———
const KEY = 'oml.profiles.v1';

export function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProfile(profile, label) {
  const list = loadProfiles();
  const entry = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: label || profile.code.code,
    savedAt: new Date().toISOString(),
    profile,
  };
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 24)));
  return entry;
}

export function deleteProfile(id) {
  localStorage.setItem(KEY, JSON.stringify(loadProfiles().filter((p) => p.id !== id)));
}

export function getProfile(id) {
  return loadProfiles().find((p) => p.id === id) || null;
}

const DRAFT = 'oml.draft.v1';
export const saveDraft = (d) => localStorage.setItem(DRAFT, JSON.stringify(d));
export const loadDraft = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; }
};
export const clearDraft = () => localStorage.removeItem(DRAFT);

/** 12 维雷达图（SVG），可叠加第二个人 */
export function radarChart(dims, dimKeys, secondary = null, size = 480) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.365;
  const n = dimKeys.length;
  const NS = 'http://www.w3.org/2000/svg';
  const uid = `r${Math.random().toString(36).slice(2, 8)}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'radar');
  const mk = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  // 径向渐变填充：中心亮、边缘淡，比纯色块更有体积感
  const defs = mk('defs', {});
  const grad = mk('radialGradient', { id: `${uid}fill`, cx: '50%', cy: '50%', r: '50%' });
  grad.append(mk('stop', { offset: '0%', 'stop-color': '#e6bd63', 'stop-opacity': '0.42' }));
  grad.append(mk('stop', { offset: '100%', 'stop-color': '#e6bd63', 'stop-opacity': '0.14' }));
  defs.append(grad);
  svg.append(defs);

  for (const f of [0.25, 0.5, 0.75, 1]) {
    const d = `${dimKeys.map((_, i) => pt(i, R * f)).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')}Z`;
    svg.append(mk('path', { d, class: `ring${f === 1 ? ' outer' : ''}` }));
  }
  dimKeys.forEach((_, i) => {
    const [x, y] = pt(i, R);
    svg.append(mk('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'axis' }));
  });

  const poly = (data, cls) => {
    const d = `${dimKeys.map((k, i) => pt(i, (R * Math.max(4, data[k])) / 100))
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')}Z`;
    const path = mk('path', { d, class: cls });
    if (cls === 'poly') path.setAttribute('fill', `url(#${uid}fill)`);
    svg.append(path);
  };
  if (secondary) poly(secondary, 'poly2');
  poly(dims, 'poly');

  // 顶点圆点，让每一维的取值可读
  dimKeys.forEach((k, i) => {
    const [x, y] = pt(i, (R * Math.max(4, dims[k])) / 100);
    svg.append(mk('circle', { cx: x, cy: y, r: 2.6, class: 'dot' }));
  });

  // 轴标：维度字母在外，数值在其下
  dimKeys.forEach((k, i) => {
    const [x, y] = pt(i, R + 25);
    svg.append(mk('text', { x, y: y - 4, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, k));
    svg.append(mk('text', { x, y: y + 9, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'val' }, String(dims[k])));
  });
  return svg;
}

/**
 * 六爻图形：阳爻一整条、阴爻断开两段，自下而上（CSS 用 column-reverse 排列）。
 * @param {number[]} lines 6 个 0/1，索引 0 为初爻
 * @param {number} width 图形宽度（px）
 */
export function yaoLines(lines, width = 112) {
  // 爻线粗细与间距随宽度等比，否则小尺寸下会变成又高又窄的竖条
  const lh = Math.max(2.5, width / 16);
  const gap = Math.max(1.8, width / 22);
  return el('div', { class: 'yao', style: `width:${width}px;--lh:${lh}px;--gap:${gap}px` },
    lines.map((v) => el('i', { class: v ? 'yang' : 'yin' },
      v ? el('b', {}) : [el('b', {}), el('b', {})])));
}

export function axisRow(axis, dims, pick) {
  const [a, b] = axis.poles;
  const za = dims[a].score;
  const zb = dims[b].score;
  const total = za + zb || 1;
  const pctA = (za / total) * 100;
  return el('div', { class: 'axisrow' },
    el('div', { class: `left ${pick === a ? 'on' : ''}` }, `${dims[a].meta.name} ${a} ${za}`),
    el('div', { class: 'track' },
      el('i', { style: `left:3px;width:calc(${pctA.toFixed(1)}% - 6px)` }),
      el('span', { class: 'mid' })),
    el('div', { class: `right ${pick === b ? 'on' : ''}` }, `${b} ${dims[b].meta.name} ${zb}`));
}

export function fmtPct(x) { return `${Math.round(x * 100)}%`; }
