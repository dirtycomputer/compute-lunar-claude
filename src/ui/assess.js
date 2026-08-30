/** assess.js — 测评流程：出生信息 → 情境题 → 144 题 → 结果 */

import { $, el, mountChrome, saveProfile, saveDraft, loadDraft, clearDraft, radarChart, axisRow } from './common.js';
import { shuffledItems, LIKERT, CONTEXT_ITEMS, ITEMS } from '../core/questionnaire.js';
import { DIM_KEYS, DIMENSIONS, AXES } from '../core/dimensions.js';
import { buildProfile } from '../core/scoring.js';
import {
  parseCityData, parseCountryData, buildIndex, searchCities,
  resolveBirthLocation, cityLabel, formatOffset,
} from '../core/geo.js';
import { renderResult } from './result.js';

// ——— 城市库（GeoNames，CC BY 4.0）。首屏只加载主库，补充库按需拉取 ———
const cityStore = { list: null, index: null, countries: null, extraLoaded: false, loading: null };

async function ensureCities() {
  if (cityStore.list) return cityStore;
  if (cityStore.loading) return cityStore.loading;
  cityStore.loading = (async () => {
    const [cityTxt, countryTxt] = await Promise.all([
      fetch('src/data/cities.txt').then((r) => r.text()),
      fetch('src/data/countries.txt').then((r) => r.text()),
    ]);
    cityStore.list = parseCityData(cityTxt);
    cityStore.countries = parseCountryData(countryTxt);
    cityStore.index = buildIndex(cityStore.list);
    return cityStore;
  })();
  return cityStore.loading;
}

async function loadExtraCities() {
  if (cityStore.extraLoaded) return;
  const txt = await fetch('src/data/cities-extra.txt').then((r) => r.text());
  const extra = parseCityData(txt);
  cityStore.list = cityStore.list.concat(extra);
  cityStore.index = cityStore.index.concat(buildIndex(extra));
  cityStore.extraLoaded = true;
}


const PAGE_SIZE = 18;
const state = {
  step: 0,
  birth: {
    year: 1995, month: 6, day: 15, hour: 12, minute: 0,
    lonEast: 116.397, latNorth: 39.908, timezone: 'Asia/Shanghai',
    name: '', timeKnown: true,
  },
  city: null,        // 选中的城市对象
  manualGeo: false,  // 是否改用手动经纬度/时区
  context: { gender: 'undisclosed', pronouns: '', orientation: 'undisclosed', attractedTo: ['any'], relStyle: 'undecided', intimacyPace: 'medium', mbtiSelf: '', enneaSelf: '', bloodType: '', symbolWeight: 0.15 },
  responses: {},
  page: 0,
  items: shuffledItems(),
};

const app = () => $('#app');

function persist() {
  saveDraft({
    birth: state.birth, city: state.city, manualGeo: state.manualGeo,
    context: state.context, responses: state.responses, page: state.page, step: state.step,
  });
}

function restore() {
  const d = loadDraft();
  if (!d) return false;
  Object.assign(state.birth, d.birth || {});
  state.city = d.city || null;
  state.manualGeo = !!d.manualGeo;
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
        field('出生年', input('number', b.year, (v) => { b.year = +v; updateGeoPanel(); }, { min: 1600, max: 2100 })),
        field('月', input('number', b.month, (v) => { b.month = +v; updateGeoPanel(); }, { min: 1, max: 12 })),
        field('日', input('number', b.day, (v) => { b.day = +v; updateGeoPanel(); }, { min: 1, max: 31 }))),
      el('div', { class: 'row' },
        field('时（24 小时制）', input('number', b.hour, (v) => { b.hour = +v; updateGeoPanel(); }, { min: 0, max: 23 })),
        field('分', input('number', b.minute, (v) => { b.minute = +v; updateGeoPanel(); }, { min: 0, max: 59 }))),
      el('div', { class: 'field' },
        el('label', {}, el('input', {
          type: 'checkbox', id: 'timeknown', style: 'width:auto;margin-right:8px', ...(b.timeKnown ? { checked: 'checked' } : {}),
          onchange: (e) => { b.timeKnown = e.target.checked; persist(); updateGeoPanel(); },
        }), '我知道准确的出生时间（未勾选则按当日 12:00 计算，上升点与时柱不予输出）')),

      el('div', { class: 'field' },
        el('label', {}, '出生城市　City of birth'),
        el('input', {
          type: 'text', id: 'city-search', autocomplete: 'off',
          placeholder: '输入中文或英文，如 北京 / Beijing / 乌鲁木齐 / New York',
          oninput: (e) => runCitySearch(e.target.value),
          onfocus: (e) => runCitySearch(e.target.value),
        }),
        el('div', { id: 'city-results' }),
        el('p', { class: 'hint' },
          '时区会按出生城市与出生日期自动判定，不需要你自己查 UTC——夏令时与历史时区变更（例如中国 1986–1991 年实行过夏令时）都会自动处理。')),

      el('div', { id: 'geo-panel' }),

      el('details', { style: 'margin-top:10px' },
        el('summary', { style: 'cursor:pointer;color:var(--fg-dim);font-size:13px' }, '高级：手动指定经纬度与时区'),
        el('div', { style: 'padding-top:10px' },
          el('div', { class: 'row' },
            field('东经（西经为负）', input('number', b.lonEast, (v) => { b.lonEast = +v; state.manualGeo = true; updateGeoPanel(); }, { step: 0.001, id: 'lon' })),
            field('北纬（南纬为负）', input('number', b.latNorth, (v) => { b.latNorth = +v; state.manualGeo = true; updateGeoPanel(); }, { step: 0.001, id: 'lat' })),
            field('UTC 偏移（小时，留空则用城市时区）', input('number', b.tzHours ?? '', (v) => {
              b.tzHours = v === '' ? undefined : +v;
              state.manualGeo = true;
              updateGeoPanel();
            }, { step: 0.25, min: -12, max: 14, id: 'tzmanual' }))),
          el('p', { class: 'hint' }, '仅在城市不在库中、或你确知当地当年使用的是特殊时制时才需要手填。填了 UTC 偏移就会覆盖城市时区。'))),

      field('姓名拉丁拼写（可选，用于数字命理的表达数）', input('text', b.name, (v) => { b.name = v; }, { placeholder: 'Lin Wenqing' }))),

    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' },
      el('button', { class: 'primary', onclick: () => go(1) }, '下一步：情境题 →'),
      el('button', { onclick: () => { state.birth = null; go(1); } }, '跳过出生信息（纯心理测量模式）')));

  // 异步载入城市库后刷新面板
  ensureCities().then(() => {
    updateGeoPanel();
    const inputEl = document.getElementById('city-search');
    if (inputEl && !state.city) inputEl.placeholder = `在 ${cityStore.list.length.toLocaleString()} 座城市中搜索：北京 / Beijing / New York`;
  }).catch(() => {
    const r = document.getElementById('city-results');
    if (r) r.append(el('p', { class: 'hint' }, '城市库加载失败，请用下方「高级」手动填写经纬度与时区。'));
  });

  return box;
}

/** 执行城市检索并渲染候选 */
function runCitySearch(query) {
  const box = document.getElementById('city-results');
  if (!box) return;
  box.innerHTML = '';
  if (!cityStore.index) { box.append(el('p', { class: 'hint' }, '城市库加载中…')); return; }
  const q = (query || '').trim();
  if (!q) return;
  const hits = searchCities(cityStore.index, q, { limit: 12 });
  if (!hits.length) {
    box.append(el('p', { class: 'hint' }, `没找到「${q}」。`),
      cityStore.extraLoaded
        ? el('p', { class: 'hint' }, '完整城市库已加载；若仍找不到，请选择邻近城市，或用下方「高级」手动填写。经度每差 1° 只影响真太阳时约 4 分钟。')
        : el('button', {
          id: 'load-extra',
          onclick: async (e) => {
            e.target.disabled = true;
            e.target.textContent = '加载中…';
            await loadExtraCities();
            runCitySearch(query);
          },
        }, '加载完整城市库（再增约 3.5 万座小城）'));
    return;
  }
  box.append(el('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:8px' },
    hits.map((c) => {
      const country = cityStore.countries[c.cc];
      return el('button', {
        type: 'button',
        class: 'cityhit',
        style: 'text-align:left;padding:7px 11px',
        onclick: () => selectCity(c),
      },
      el('span', {}, cityLabel(c)),
      el('small', { style: 'color:var(--fg-faint);margin-left:8px' },
        `${country ? country.zh : c.cc}${c.admin1 ? ` · ${c.admin1}` : ''} · ${c.tz}`));
    })));
}

function selectCity(c) {
  state.city = c;
  state.manualGeo = false;
  state.birth.lonEast = c.lon;
  state.birth.latNorth = c.lat;
  state.birth.timezone = c.tz;
  delete state.birth.tzHours; // 交回给时区自动解析
  const inputEl = document.getElementById('city-search');
  if (inputEl) inputEl.value = '';
  const results = document.getElementById('city-results');
  if (results) results.innerHTML = '';
  const lonEl = document.getElementById('lon');
  const latEl = document.getElementById('lat');
  const tzEl = document.getElementById('tzmanual');
  if (lonEl) lonEl.value = c.lon;
  if (latEl) latEl.value = c.lat;
  if (tzEl) tzEl.value = '';
  persist();
  updateGeoPanel();
}

/** 展示解析出的时区与真太阳时校正——让使用者看得见系统替他做了什么 */
function updateGeoPanel() {
  persist();
  const panel = document.getElementById('geo-panel');
  if (!panel) return;
  panel.innerHTML = '';
  const b = state.birth;
  if (!b) return;

  const manualTz = b.tzHours != null;
  let tzHours;
  let offsetLabel;
  let solar;
  let warn = null;

  if (manualTz) {
    tzHours = b.tzHours;
    offsetLabel = formatOffset(Math.round(tzHours * 60));
    solar = +((b.lonEast - tzHours * 15) * 4).toFixed(1);
  } else if (b.timezone) {
    const r = resolveBirthLocation(
      { lon: b.lonEast, lat: b.latNorth, tz: b.timezone },
      { year: b.year, month: b.month, day: b.day, hour: b.timeKnown ? b.hour : 12, minute: b.minute },
    );
    tzHours = r.tzHours;
    offsetLabel = r.offsetLabel;
    solar = r.solarCorrectionMinutes;
    if (r.nonexistent) warn = '这个当地时间在当年不存在（夏令时前拨的空档），已按前拨后的时制计算。';
    else if (r.ambiguous) warn = '这个当地时间在当年出现了两次（夏令时回拨），已取较早的一次。若你确知是回拨后出生，请在「高级」中手填 UTC 偏移。';
  } else {
    return;
  }

  const label = state.city
    ? `${cityLabel(state.city)}　${(cityStore.countries && cityStore.countries[state.city.cc]) ? cityStore.countries[state.city.cc].zh : state.city.cc}`
    : '自定义坐标';

  panel.append(el('div', { class: 'card tight', id: 'geo-summary', style: 'margin-top:12px' },
    el('div', { style: 'display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline' },
      el('strong', { style: 'font-size:15px' }, label),
      el('span', { class: 'mono', style: 'color:var(--gold)', id: 'geo-offset' }, offsetLabel)),
    el('div', { class: 'kv', style: 'margin-top:8px' },
      el('dt', {}, '时区'), el('dd', { class: 'mono' }, manualTz ? '手动指定' : b.timezone),
      el('dt', {}, '经纬度'), el('dd', { class: 'mono' }, `${b.lonEast.toFixed(3)}°E, ${b.latNorth.toFixed(3)}°N`),
      el('dt', {}, '真太阳时校正'), el('dd', { class: 'mono', id: 'geo-solar' },
        `${solar > 0 ? '+' : ''}${solar} 分钟`),
      el('dt', {}, '时区中央经线'), el('dd', { class: 'mono' }, `${(tzHours * 15).toFixed(1)}°`)),
    el('p', { class: 'hint' },
      `钟表时间 ${String(b.timeKnown ? b.hour : 12).padStart(2, '0')}:${String(b.minute).padStart(2, '0')} 对应的真太阳时约为 `
      + `${fmtClock((b.timeKnown ? b.hour : 12) * 60 + b.minute + solar)}，四柱的时柱按后者判定。`),
    warn ? el('p', { class: 'hint', style: 'color:var(--rose)' }, warn) : null,
    Math.abs(solar) >= 90
      ? el('p', { class: 'hint', style: 'color:var(--gold)' },
        `这里的真太阳时校正达 ${Math.abs(solar).toFixed(0)} 分钟，超过一个时辰的一半——`
        + '因为当地经度与所用时区的中央经线相差很远（中国全境用北京时间、西班牙用中欧时间等都属此类）。'
        + (state.city && state.city.cc === 'CN'
          ? '本站按出生证明与户籍的口径，中国城市一律以北京时间解析；若家人告知的是新疆时间，请在下方「高级」中把 UTC 偏移改为 6。'
          : ''))
      : null));
}

function fmtClock(totalMinutes) {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
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
