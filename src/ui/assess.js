/** assess.js — 测评流程：出生信息 → 情境题 → 144 题 → 结果 */

import { $, el, mountChrome, saveProfile, saveDraft, loadDraft, clearDraft, radarChart, axisRow } from './common.js';
import { shuffledItems, LIKERT, CONTEXT_ITEMS, ITEMS } from '../core/questionnaire.js';
import { DIM_KEYS, DIMENSIONS, AXES } from '../core/dimensions.js';
import { buildProfile } from '../core/scoring.js';
import { renderResult } from './result.js';

export const CITIES = [
  ['北京', 116.41, 39.90, 8], ['上海', 121.47, 31.23, 8], ['广州', 113.26, 23.13, 8],
  ['深圳', 114.06, 22.55, 8], ['成都', 104.07, 30.57, 8], ['西安', 108.95, 34.34, 8],
  ['哈尔滨', 126.53, 45.80, 8], ['乌鲁木齐', 87.62, 43.83, 8], ['香港', 114.17, 22.32, 8],
  ['台北', 121.56, 25.03, 8], ['东京', 139.69, 35.69, 9], ['首尔', 126.98, 37.57, 9],
  ['新加坡', 103.82, 1.35, 8], ['曼谷', 100.50, 13.76, 7], ['新德里', 77.21, 28.61, 5.5],
  ['迪拜', 55.27, 25.20, 4], ['伦敦', -0.13, 51.51, 0], ['巴黎', 2.35, 48.86, 1],
  ['柏林', 13.40, 52.52, 1], ['莫斯科', 37.62, 55.76, 3], ['纽约', -74.01, 40.71, -5],
  ['洛杉矶', -118.24, 34.05, -8], ['多伦多', -79.38, 43.65, -5], ['圣保罗', -46.63, -23.55, -3],
  ['悉尼', 151.21, -33.87, 10], ['奥克兰', 174.76, -36.85, 12], ['开普敦', 18.42, -33.92, 2],
  ['拉各斯', 3.38, 6.52, 1], ['墨西哥城', -99.13, 19.43, -6],
];

const PAGE_SIZE = 18;
const state = {
  step: 0,
  birth: { year: 1995, month: 6, day: 15, hour: 12, minute: 0, tzHours: 8, lonEast: 116.41, latNorth: 39.90, name: '', timeKnown: true },
  context: { gender: 'undisclosed', pronouns: '', orientation: 'undisclosed', attractedTo: ['any'], relStyle: 'undecided', intimacyPace: 'medium', mbtiSelf: '', enneaSelf: '', bloodType: '', symbolWeight: 0.15 },
  responses: {},
  page: 0,
  items: shuffledItems(),
};

const app = () => $('#app');

function persist() {
  saveDraft({ birth: state.birth, context: state.context, responses: state.responses, page: state.page, step: state.step });
}

function restore() {
  const d = loadDraft();
  if (!d) return false;
  Object.assign(state.birth, d.birth || {});
  Object.assign(state.context, d.context || {});
  state.responses = d.responses || {};
  state.page = d.page || 0;
  state.step = d.step || 0;
  return Object.keys(state.responses).length > 0;
}

// ————————————————— Step 0：出生信息 —————————————————
function renderBirth() {
  const b = state.birth;
  const box = el('div', {},
    el('p', { class: 'eyebrow' }, 'Step 1 / 3'),
    el('h1', {}, '出生信息'),
    el('p', {}, '用于计算星盘、四柱、恒星黄道与历法符号。这些数据只留在你的浏览器里。若不填写，测评仍可进行——象征层将自动关闭，结果为纯心理测量。'),
    el('div', { class: 'card' },
      el('div', { class: 'row' },
        field('出生年', input('number', b.year, (v) => { b.year = +v; }, { min: 1600, max: 2100 })),
        field('月', input('number', b.month, (v) => { b.month = +v; }, { min: 1, max: 12 })),
        field('日', input('number', b.day, (v) => { b.day = +v; }, { min: 1, max: 31 }))),
      el('div', { class: 'row' },
        field('时（24 小时制）', input('number', b.hour, (v) => { b.hour = +v; }, { min: 0, max: 23 })),
        field('分', input('number', b.minute, (v) => { b.minute = +v; }, { min: 0, max: 59 })),
        field('时区（UTC 偏移）', input('number', b.tzHours, (v) => { b.tzHours = +v; }, { step: 0.5, min: -12, max: 14 }))),
      el('div', { class: 'field' },
        el('label', {}, el('input', {
          type: 'checkbox', id: 'timeknown', style: 'width:auto;margin-right:8px', ...(b.timeKnown ? { checked: 'checked' } : {}),
          onchange: (e) => { b.timeKnown = e.target.checked; persist(); },
        }), '我知道准确的出生时间（未勾选则按当日 12:00 计算，上升点与时柱不予输出）')),
      el('div', { class: 'row' },
        field('出生城市（快速填充经纬度）', citySelect()),
        field('东经（西经为负）', input('number', b.lonEast, (v) => { b.lonEast = +v; }, { step: 0.01, id: 'lon' })),
        field('北纬（南纬为负）', input('number', b.latNorth, (v) => { b.latNorth = +v; }, { step: 0.01, id: 'lat' }))),
      field('姓名拉丁拼写（可选，用于数字命理的表达数）', input('text', b.name, (v) => { b.name = v; }, { placeholder: 'Lin Wenqing' })),
      el('p', { class: 'hint' }, '真太阳时校正会按出生经度自动进行（每偏离时区中央经线 1° 约 4 分钟），影响时柱与晚子时进位。')),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { class: 'primary', onclick: () => go(1) }, '下一步：情境题 →'),
      el('button', { onclick: () => { state.birth = null; go(1); } }, '跳过出生信息（纯心理测量模式）')));
  return box;
}

function citySelect() {
  return el('select', {
    onchange: (e) => {
      const c = CITIES[+e.target.value];
      if (!c) return;
      state.birth.lonEast = c[1];
      state.birth.latNorth = c[2];
      state.birth.tzHours = c[3];
      $('#lon').value = c[1];
      $('#lat').value = c[2];
      persist();
      render();
    },
  }, el('option', { value: '' }, '— 选择城市 —'),
  CITIES.map((c, i) => el('option', { value: String(i) }, `${c[0]}（UTC${c[3] >= 0 ? '+' : ''}${c[3]}）`)));
}

function field(label, control) {
  return el('div', { class: 'field' }, el('label', {}, label), control);
}
function input(type, value, onInput, attrs = {}) {
  return el('input', {
    type, value: value ?? '', ...attrs,
    oninput: (e) => { onInput(e.target.value); persist(); },
  });
}

// ————————————————— Step 1：情境题 —————————————————
function renderContext() {
  const c = state.context;
  const controls = CONTEXT_ITEMS.map((it) => {
    if (it.type === 'select') {
      return field(`${it.zh}　${it.en}`, el('select', {
        onchange: (e) => { c[it.id] = e.target.value; persist(); },
      }, it.options.map(([v, l]) => el('option', { value: v, ...(c[it.id] === v ? { selected: 'selected' } : {}) }, l))));
    }
    if (it.type === 'multi') {
      return el('div', { class: 'field' },
        el('label', {}, `${it.zh}　${it.en}`),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          it.options.map(([v, l]) => el('button', {
            type: 'button',
            'aria-pressed': String((c[it.id] || []).includes(v)),
            class: (c[it.id] || []).includes(v) ? 'primary' : '',
            onclick: (e) => {
              const cur = new Set(c[it.id] || []);
              if (cur.has(v)) cur.delete(v); else cur.add(v);
              c[it.id] = [...cur];
              e.target.className = cur.has(v) ? 'primary' : '';
              e.target.setAttribute('aria-pressed', String(cur.has(v)));
              persist();
            },
          }, l))));
    }
    if (it.type === 'range') {
      return el('div', { class: 'field' },
        el('label', {}, `${it.zh}　当前 λb = `, el('span', { id: 'lb', class: 'mono', style: 'color:var(--gold)' }, String(c.symbolWeight))),
        el('input', {
          type: 'range', min: it.min, max: it.max, step: it.step, value: c.symbolWeight,
          oninput: (e) => { c.symbolWeight = +e.target.value; $('#lb').textContent = e.target.value; persist(); },
        }),
        el('p', { class: 'hint' }, '0 = 完全不使用出生信息，结果 100% 来自你的答卷；0.40 = 象征层影响达到设计上限（约占最终分数的三成）。默认 0.15。'));
    }
    return field(`${it.zh}　${it.en}`, input('text', c[it.id], (v) => { c[it.id] = v; }, { placeholder: it.placeholder || '' }));
  });

  return el('div', {},
    el('p', { class: 'eyebrow' }, 'Step 2 / 3'),
    el('h1', {}, '情境与身份'),
    el('div', { class: 'notice' },
      '这一节的身份字段（性别认同、人称、性倾向、关系形态）',
      el('strong', { style: 'color:var(--fg)' }, '不会进入任何人格特质的计算'),
      '。它们只用于：(a) 结果页的称谓；(b) 关系相性中的双向意愿准入。全部可留空。'),
    el('div', { class: 'card' }, controls),
    el('div', { style: 'display:flex;gap:10px' },
      el('button', { onclick: () => go(0) }, '← 上一步'),
      el('button', { class: 'primary', onclick: () => go(2) }, '下一步：144 题 →')));
}

// ————————————————— Step 2：问卷 —————————————————
function renderQuiz() {
  const total = state.items.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = state.page * PAGE_SIZE;
  const slice = state.items.slice(start, start + PAGE_SIZE);
  const answered = Object.keys(state.responses).length;

  const list = el('div', { class: 'card' }, slice.map((it, i) => questionRow(it, start + i + 1)));

  return el('div', {},
    el('p', { class: 'eyebrow' }, 'Step 3 / 3'),
    el('h1', {}, `OML-144 标准问卷`),
    el('div', { class: 'stepbar' },
      el('div', { class: 'bar' }, el('i', { style: `width:${((answered / total) * 100).toFixed(1)}%` })),
      el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;color:var(--fg-faint);margin-top:5px' },
        el('span', {}, `第 ${state.page + 1} / ${pages} 页`),
        el('span', { id: 'counter' }, `已答 ${answered} / ${total}`))),
    el('p', {}, '按第一反应作答，不要反复权衡。题目中有反向计分题，用于检测默认同意倾向。'),
    list,
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
      el('button', { onclick: () => { state.page = Math.max(0, state.page - 1); persist(); render(); window.scrollTo(0, 0); }, ...(state.page === 0 ? { disabled: 'disabled' } : {}) }, '← 上一页'),
      state.page < pages - 1
        ? el('button', { class: 'primary', onclick: () => { state.page += 1; persist(); render(); window.scrollTo(0, 0); } }, '下一页 →')
        : el('button', { class: 'primary', id: 'submit', onclick: submit }, '生成我的 OML 代码 →'),
      el('button', { id: 'demofill', onclick: demoFill, title: '用伪随机作答快速体验结果页' }, '演示填充'),
      el('button', { onclick: () => { if (confirm('清空全部作答？')) { state.responses = {}; state.page = 0; clearDraft(); persist(); render(); } } }, '清空')),
    el('p', { class: 'hint' }, '进度自动保存在本地，可随时关闭页面后继续。'));
}

function questionRow(it, index) {
  const cur = state.responses[it.id];
  const row = el('div', { class: `q${cur ? '' : ' unanswered'}`, id: `q-${it.id}` },
    el('div', { class: 'qtext' },
      el('span', { class: 'num' }, `${String(index).padStart(3, '0')} · ${it.id}`),
      it.zh,
      el('span', { class: 'en' }, it.en)),
    el('div', { class: 'likert' },
      LIKERT.map((l) => el('button', {
        type: 'button',
        'aria-pressed': String(cur === l.v),
        title: l.zh,
        'data-item': it.id, 'data-v': String(l.v),
        onclick: (e) => answer(it.id, l.v, e.target),
      }, String(l.v))),
      el('div', { class: 'lbl' },
        el('span', {}, '1 完全不符合'), el('span', {}, '4 中性'), el('span', {}, '7 完全符合'))));
  return row;
}

function answer(id, v, btn) {
  state.responses[id] = v;
  const parent = btn.parentElement;
  [...parent.children].forEach((c) => { if (c.tagName === 'BUTTON') c.setAttribute('aria-pressed', String(c === btn)); });
  const q = document.getElementById(`q-${id}`);
  if (q) q.classList.remove('unanswered');
  const counter = document.getElementById('counter');
  if (counter) counter.textContent = `已答 ${Object.keys(state.responses).length} / ${state.items.length}`;
  const barEl = document.querySelector('.stepbar .bar > i');
  if (barEl) barEl.style.width = `${((Object.keys(state.responses).length / state.items.length) * 100).toFixed(1)}%`;
  persist();
}

function demoFill() {
  let s = Date.now() % 100000;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  // 以维度为单位生成有结构的作答，避免全随机导致所有维度都趋中
  const bias = {};
  for (const k of DIM_KEYS) bias[k] = (rnd() - 0.5) * 3.4;
  for (const it of ITEMS) {
    const raw = 4 + bias[it.d] * it.k + (rnd() - 0.5) * 2.2;
    state.responses[it.id] = Math.max(1, Math.min(7, Math.round(raw)));
  }
  persist();
  render();
}

function submit() {
  const missing = ITEMS.filter((it) => !state.responses[it.id]);
  if (missing.length > 0) {
    const ok = confirm(`还有 ${missing.length} 题未作答，未答题将按中性 4 计入并降低置信度。仍要生成结果吗？`);
    if (!ok) {
      const first = missing[0];
      const page = Math.floor(state.items.findIndex((i) => i.id === first.id) / PAGE_SIZE);
      state.page = page;
      render();
      setTimeout(() => document.getElementById(`q-${first.id}`)?.scrollIntoView({ block: 'center' }), 50);
      return;
    }
  }
  const profile = buildProfile({ birth: state.birth, responses: state.responses, context: state.context });
  state.profile = profile;
  state.step = 3;
  render();
}

// ————————————————— Step 3：结果 —————————————————
function renderResultStep() {
  const p = state.profile;
  const box = el('div', {});
  box.append(renderResult(p, { radarChart, axisRow, DIM_KEYS, DIMENSIONS, AXES }));
  box.append(el('div', { class: 'card', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
    el('button', {
      class: 'primary',
      onclick: () => {
        const label = prompt('给这份档案起个名字（仅保存在本机）', p.code.code) || p.code.code;
        saveProfile(p, label);
        alert('已保存到本机。可前往「关系相性」页与另一份档案配对。');
      },
    }, '保存档案到本机'),
    el('button', {
      onclick: () => {
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `oml-${p.code.code}.json` });
        document.body.append(a); a.click(); a.remove();
      },
    }, '导出 JSON'),
    el('a', { class: 'btn', href: 'pair.html' }, '去做关系相性 →'),
    el('button', { onclick: () => { state.step = 2; render(); } }, '返回修改答卷')));
  return box;
}

// ————————————————— 路由 —————————————————
function go(step) { state.step = step; persist(); render(); window.scrollTo(0, 0); }

function render() {
  const root = app();
  root.innerHTML = '';
  const views = [renderBirth, renderContext, renderQuiz, renderResultStep];
  root.append(views[state.step]());
}

mountChrome('assess.html');
const hadDraft = restore();
if (hadDraft && state.step === 3) state.step = 2;
render();
if (hadDraft) {
  const n = Object.keys(state.responses).length;
  if (n > 0 && n < ITEMS.length) {
    const note = el('div', { class: 'notice', style: 'margin-bottom:16px' }, `检测到未完成的作答（${n}/${ITEMS.length} 题），已自动恢复。`);
    app().prepend(note);
  }
}
window.__omlState = state; // 供自动化测试读取
