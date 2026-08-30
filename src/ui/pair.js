/** pair.js — 关系相性页 */

import { $, el, mountChrome, loadProfiles, saveProfile, deleteProfile, radarChart } from './common.js';
import { DIM_KEYS, AXES, DIMENSIONS } from '../core/dimensions.js';
import { matchProfiles, axisComparison } from '../core/matching.js';
import { buildProfile } from '../core/scoring.js';
import { ITEMS } from '../core/questionnaire.js';

const DIM = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));
const state = { a: null, b: null, mode: 'romantic' };

function refreshSelectors() {
  const list = loadProfiles();
  const box = $('#selectors');
  box.innerHTML = '';
  if (list.length === 0) {
    box.append(el('div', { class: 'notice' },
      '本机还没有已保存的档案。先去', el('a', { href: 'assess.html' }, '完成一次测评'),
      '并点击「保存档案到本机」，或用下方的「生成两份演示档案」体验算法。'));
    return;
  }
  const mk = (side) => el('div', { class: 'field' },
    el('label', {}, `档案 ${side.toUpperCase()}`),
    el('select', {
      id: `sel-${side}`,
      onchange: (e) => { state[side] = list.find((p) => p.id === e.target.value)?.profile || null; renderMatch(); },
    }, el('option', { value: '' }, '— 选择 —'),
    list.map((p) => el('option', { value: p.id }, `${p.label}　(${p.profile.code.code}　${new Date(p.savedAt).toLocaleDateString()})`))));
  box.append(el('div', { class: 'row' }, mk('a'), mk('b')));
  box.append(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
    list.map((p) => el('span', { class: 'tag' }, p.label, ' ',
      el('a', { href: '#', onclick: (e) => { e.preventDefault(); if (confirm(`删除档案「${p.label}」？`)) { deleteProfile(p.id); refreshSelectors(); } } }, '×')))));
}

/** 生成结构化的演示档案（不是全随机，保证维度有分化） */
function demoProfile(seed, birth, context) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const bias = {};
  for (const k of DIM_KEYS) bias[k] = (rnd() - 0.5) * 3.4;
  const responses = {};
  for (const it of ITEMS) {
    responses[it.id] = Math.max(1, Math.min(7, Math.round(4 + bias[it.d] * it.k + (rnd() - 0.5) * 2)));
  }
  return buildProfile({ birth, responses, context });
}

function makeDemos() {
  const a = demoProfile(20260829, { year: 1993, month: 11, day: 4, hour: 7, minute: 20, tzHours: 8, lonEast: 121.47, latNorth: 31.23 },
    { gender: 'woman', orientation: 'bi', attractedTo: ['woman', 'nonbinary'], relStyle: 'mono', intimacyPace: 'slow', symbolWeight: 0.15 });
  const b = demoProfile(77712345, { year: 1990, month: 3, day: 19, hour: 21, minute: 5, tzHours: 8, lonEast: 113.26, latNorth: 23.13 },
    { gender: 'nonbinary', orientation: 'queer', attractedTo: ['any'], relStyle: 'mono', intimacyPace: 'medium', symbolWeight: 0.15 });
  saveProfile(a, '演示档案 A');
  saveProfile(b, '演示档案 B');
  state.a = a; state.b = b;
  refreshSelectors();
  const sa = $('#sel-a'); const sb = $('#sel-b');
  if (sa && sb) { sb.selectedIndex = 1; sa.selectedIndex = 2; }
  renderMatch();
}

function renderMatch() {
  const out = $('#out');
  out.innerHTML = '';
  if (!state.a || !state.b) {
    out.append(el('p', { class: 'hint' }, '选择两份档案后自动计算。'));
    return;
  }
  const m = matchProfiles(state.a, state.b, { mode: state.mode });
  window.__omlMatch = m;

  const dimsA = Object.fromEntries(DIM_KEYS.map((k) => [k, state.a.dims[k].score]));
  const dimsB = Object.fromEntries(DIM_KEYS.map((k) => [k, state.b.dims[k].score]));

  out.append(el('div', { class: 'card' },
    el('div', { style: 'display:flex;gap:26px;flex-wrap:wrap;align-items:center' },
      el('div', {},
        el('p', { class: 'eyebrow' }, '综合相性'),
        el('div', { class: 'big', id: 'total-score' }, String(m.total)),
        el('p', { class: 'hint' }, `等级 ${m.grade}　·　配对代码 `,
          el('span', { class: 'mono', style: 'color:var(--gold)' }, m.pairCode))),
      el('div', { style: 'flex:1;min-width:260px' },
        el('p', { style: 'font-family:var(--serif);font-size:21px;margin:0;color:var(--fg)' },
          `${m.archetype.zh}　`, el('small', { style: 'font-size:14px' }, m.archetype.en)),
        el('p', {}, m.archetype.note),
        el('p', { class: 'hint' },
          `${state.a.code.code}（${state.a.code.name.zh}） × ${state.b.code.code}（${state.b.code.name.zh}）　·　`
          + `心理层 ${m.layers.psyche} × ${m.weights.psyche}　符号层 ${m.layers.symbol} × ${m.weights.symbol}　准入系数 ${m.layers.gate.factor}`))),
    m.layers.gate.notes.length
      ? el('div', { class: 'notice warn', style: 'margin-top:14px' },
        el('ul', { class: 'clean', style: 'margin:0' }, m.layers.gate.notes.map((n) => el('li', {}, n))))
      : null));

  // 五项子分
  const subLabels = {
    resonance: ['共鸣 Resonance', '世界观与亲密需求的同频程度'],
    complement: ['互补 Complement', '能量与掌控方式的错位是否恰到好处'],
    stability: ['稳态 Stability', '关系的情绪地基'],
    growth: ['成长 Growth', '一起变化的潜力'],
    friction: ['张力 Friction', '数值越高摩擦越强（不等于坏）'],
  };
  out.append(el('h2', {}, '五项子分'),
    el('div', { class: 'grid c3' }, Object.entries(m.sub).map(([k, v]) => el('div', { class: 'card tight' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' },
        el('span', {}, subLabels[k][0]),
        el('span', { class: 'mono', style: 'font-size:22px;color:var(--gold)' }, String(v))),
      el('div', { class: `bar${k === 'friction' ? '' : ' jade'}` }, el('i', { style: `width:${v}%` })),
      el('p', { class: 'hint' }, subLabels[k][1])))));

  // 雷达叠加 + 六轴对照
  const cmp = axisComparison(state.a, state.b);
  out.append(el('h2', {}, '剖面对照'),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' }, radarChart(dimsA, DIM_KEYS, dimsB),
        el('p', { class: 'hint', style: 'text-align:center' }, '实线金色 = A　虚线青色 = B')),
      el('div', { class: 'card' },
        el('p', { class: 'eyebrow' }, '六轴同异'),
        cmp.map((c) => el('div', { style: 'display:grid;grid-template-columns:74px 1fr 1fr;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)' },
          el('small', {}, c.axis.zh),
          el('span', { class: 'mono', style: `color:${c.same ? 'var(--jade)' : 'var(--rose)'}` },
            `${c.a} ${DIM[c.a].name} ${c.same ? '＝' : '↔'} ${c.b} ${DIM[c.b].name}`),
          el('small', { class: 'hint' }, c.same ? '同极：默认互相理解' : '异极：需要显式翻译'))),
        el('p', { class: 'hint', style: 'margin-top:10px' },
          `共 ${cmp.filter((c) => c.same).length} / 6 轴同极。全同易共鸣也易共盲，全异张力大也信息量大。`))));

  // 十二维明细
  out.append(el('h2', {}, '十二维相性明细'),
    el('div', { class: 'tablewrap' }, el('table', {},
      el('thead', {}, el('tr', {},
        el('th', {}, '维度'), el('th', {}, 'A'), el('th', {}, 'B'), el('th', {}, '模式'),
        el('th', {}, '权重'), el('th', {}, '相性'), el('th', {}, '说明'))),
      el('tbody', {}, m.dimRows.map((r) => el('tr', {},
        el('td', {}, `${r.name} ${r.key}`, el('br'), el('small', {}, r.en)),
        el('td', { class: 'mono' }, String(r.a)),
        el('td', { class: 'mono' }, String(r.b)),
        el('td', {}, el('small', {}, ({ sim: '趋同型', comp: '互补型', clash: '争夺型', volatility: '振幅型', 'joint-high': '联合水平型' })[r.mode])),
        el('td', { class: 'mono' }, r.weight.toFixed(1)),
        el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${r.score}%` })), el('small', { class: 'mono' }, String(r.score))),
        el('td', {}, el('small', {}, r.note))))))));

  // 符号层
  out.append(el('h2', {}, '符号层明细'),
    el('div', { class: 'grid c2' }, m.symbolParts.map((p) => el('div', { class: 'card tight' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' },
        el('strong', {}, p.label),
        el('span', { class: 'mono', style: 'color:var(--gold);font-size:19px' }, String(p.score))),
      el('div', { class: 'bar' }, el('i', { style: `width:${p.score}%` })),
      p.items
        ? el('ul', { class: 'clean' }, p.items.map((i) => el('li', {},
          `${i.label}：${(i.tags || []).filter(Boolean).join('、') || i.detail || ''} `,
          el('small', { class: 'mono' }, i.score > 0 ? `+${i.score}` : String(i.score)))))
        : el('p', { class: 'hint' }, p.note || p.relation || ''),
      p.note && p.items ? el('p', { class: 'hint' }, p.note) : null))),
    el('p', { class: 'hint' }, `符号层总权重由双方的 λb 均值决定（当前 ${m.weights.symbol}）。若双方都把 λb 设为 0，本层完全不参与总分。`));

  // 依恋 / 爱之语 / 建议 / 风险
  out.append(el('h2', {}, '相处结构'),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '依恋组合'),
        el('p', {}, `A：${m.attachment.a.zh}　B：${m.attachment.b.zh}`),
        el('p', { style: 'color:var(--fg)' }, m.attachment.note)),
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '爱之语'),
        el('p', {}, 'A 首选：', m.loveLanguages.a.join('、')),
        el('p', {}, 'B 首选：', m.loveLanguages.b.join('、')),
        el('p', { class: 'hint' }, m.loveLanguages.overlap.length
          ? `重合项：${m.loveLanguages.overlap.join('、')}——这是最省力的表达通道。`
          : '没有重合项：双方最自然的表达方式恰好不是对方最容易接收的，需要刻意翻译。'))),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, '建议'),
        el('ul', { class: 'clean' }, m.advice.map((a) => el('li', {}, a)))),
      el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, '风险点'),
        el('ul', { class: 'clean' }, m.risks.map((a) => el('li', {}, a))))),
    el('div', { class: 'notice warn' }, m.disclaimer));
}

mountChrome('pair.html');
$('#app').append(
  el('p', { class: 'eyebrow', style: 'margin-top:44px' }, 'Relational Compatibility'),
  el('h1', {}, '关系相性'),
  el('p', { class: 'lead' }, '四层结构：准入意愿 → 十二维心理相性 → 符号层（对称化八字合婚 / 星盘相位 / MBTI / 卦象 / 灵数）→ 合成。'),
  el('div', { class: 'notice' },
    '准入层只处理', el('strong', { style: 'color:var(--fg)' }, '双方是否愿意被匹配'),
    '，不对身份做任何特质推断。传统合婚里以性别定吉凶的规则（如「男怕…女怕…」）已全部替换为对称规则，因此本算法对同性、非二元与多元关系同等适用。'),
  el('div', { class: 'card' },
    el('div', { id: 'selectors' }),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:10px' },
      el('button', { id: 'demo', onclick: makeDemos }, '生成两份演示档案'),
      el('select', {
        id: 'mode',
        style: 'width:auto',
        onchange: (e) => { state.mode = e.target.value; renderMatch(); },
      }, el('option', { value: 'romantic' }, '恋爱模式（启用准入层）'),
      el('option', { value: 'partner' }, '伙伴模式（忽略准入，仅看合作相性）')),
      el('label', { style: 'display:flex;align-items:center;gap:6px;margin:0' },
        el('input', {
          type: 'file', accept: '.json', style: 'width:auto',
          onchange: async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
              const p = JSON.parse(await f.text());
              saveProfile(p, `导入 ${p.code.code}`);
              refreshSelectors();
            } catch { alert('无法解析该 JSON 档案。'); }
          },
        })))),
  el('div', { id: 'out' }));
refreshSelectors();
renderMatch();
