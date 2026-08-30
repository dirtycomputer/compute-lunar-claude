import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile } from '../src/core/scoring.js';
import {
  matchProfiles, gate, dimScore, baziAffinity, astroAffinity, hexagramAffinity,
  buildPairCode, gradeOf, axisComparison, DIM_MATCH_CONFIG,
} from '../src/core/matching.js';
import { ITEMS } from '../src/core/questionnaire.js';
import { DIM_KEYS } from '../src/core/dimensions.js';

const BIRTH_A = { year: 1993, month: 11, day: 4, hour: 7, minute: 20, tzHours: 8, lonEast: 121.47, latNorth: 31.23 };
const BIRTH_B = { year: 1990, month: 3, day: 19, hour: 21, minute: 5, tzHours: 8, lonEast: 113.26, latNorth: 23.13 };

function profile(bias, ctx = {}, birth = BIRTH_A, seed = 5) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const responses = {};
  for (const it of ITEMS) {
    responses[it.id] = Math.max(1, Math.min(7, Math.round(4 + (bias[it.d] ?? 0) * it.k + (rnd() - 0.5) * 0.8)));
  }
  return buildProfile({
    birth,
    responses,
    context: { attractedTo: ['any'], relStyle: 'mono', intimacyPace: 'medium', symbolWeight: 0.15, ...ctx },
  });
}

test('相性算法输出结构完整且取值合法', () => {
  const m = matchProfiles(profile({ R: 2 }), profile({ D: 2 }, {}, BIRTH_B, 9));
  assert.ok(m.total >= 0 && m.total <= 100);
  assert.ok(['S', 'A', 'B', 'C', 'D'].includes(m.grade));
  assert.equal(m.dimRows.length, 12);
  assert.equal(m.symbolParts.length, 5);
  assert.match(m.pairCode, /^[A-Za-z]{6}-[SABCD]$/);
  for (const r of m.dimRows) assert.ok(r.score >= 0 && r.score <= 100, `${r.key}=${r.score}`);
  for (const v of Object.values(m.sub)) assert.ok(v >= 0 && v <= 100);
  assert.ok(m.advice.length > 0 && m.risks.length > 0);
  assert.ok(m.archetype.zh && m.attachment.note);
});

test('相性对称：交换 A/B 总分不变', () => {
  const a = profile({ R: 2, W: 1 }, {}, BIRTH_A, 3);
  const b = profile({ D: 1, M: 2 }, {}, BIRTH_B, 11);
  assert.equal(matchProfiles(a, b).total, matchProfiles(b, a).total);
  assert.equal(matchProfiles(a, b).layers.psyche, matchProfiles(b, a).layers.psyche);
  assert.equal(matchProfiles(a, b).layers.symbol, matchProfiles(b, a).layers.symbol);
});

test('同一个人与自己配对：共鸣极高、张力极低', () => {
  const a = profile({ O: 2, W: 2 });
  const m = matchProfiles(a, a);
  assert.ok(m.sub.resonance >= 95, `resonance=${m.sub.resonance}`);
  assert.ok(m.sub.friction <= 15, `friction=${m.sub.friction}`);
  assert.equal(m.pairCode.slice(0, 6), m.pairCode.slice(0, 6).toUpperCase());
  assert.equal(m.archetype.zh, '同源镜像');
});

test('价值观维度差距越大，共鸣越低', () => {
  const base = profile({ O: 2, G: 2 }, {}, BIRTH_A, 4);
  const near = profile({ O: 1.6, G: 1.6 }, {}, BIRTH_A, 4);
  const far = profile({ O: -2.4, G: -2.4 }, {}, BIRTH_A, 4);
  assert.ok(matchProfiles(base, near).sub.resonance > matchProfiles(base, far).sub.resonance + 20);
});

// ——————————————————— 伦理：性别对称性 ———————————————————
test('准入层：同性配对与异性配对在相同人格下得分完全一致', () => {
  const dims = { R: 2, O: 1, W: 1.5 };
  const dims2 = { D: 1, L: 1, M: 2 };
  const straight = matchProfiles(
    profile(dims, { gender: 'woman', orientation: 'straight', attractedTo: ['man'] }, BIRTH_A, 7),
    profile(dims2, { gender: 'man', orientation: 'straight', attractedTo: ['woman'] }, BIRTH_B, 8),
  );
  const lesbian = matchProfiles(
    profile(dims, { gender: 'woman', orientation: 'gay', attractedTo: ['woman'] }, BIRTH_A, 7),
    profile(dims2, { gender: 'woman', orientation: 'gay', attractedTo: ['woman'] }, BIRTH_B, 8),
  );
  const gay = matchProfiles(
    profile(dims, { gender: 'man', orientation: 'gay', attractedTo: ['man'] }, BIRTH_A, 7),
    profile(dims2, { gender: 'man', orientation: 'gay', attractedTo: ['man'] }, BIRTH_B, 8),
  );
  const enby = matchProfiles(
    profile(dims, { gender: 'nonbinary', orientation: 'queer', attractedTo: ['any'] }, BIRTH_A, 7),
    profile(dims2, { gender: 'nonbinary', orientation: 'queer', attractedTo: ['any'] }, BIRTH_B, 8),
  );
  assert.equal(straight.total, lesbian.total);
  assert.equal(straight.total, gay.total);
  assert.equal(straight.total, enby.total);
  assert.equal(straight.pairCode, enby.pairCode);
});

test('性别认同不进入任何维度分与代码', () => {
  const genders = ['woman', 'man', 'nonbinary', 'genderfluid', 'agender', 'transfem', 'transmasc', 'intersex', 'undisclosed'];
  const codes = new Set();
  const zs = new Set();
  for (const g of genders) {
    const p = profile({ R: 1, S: 1 }, { gender: g, orientation: 'queer' }, BIRTH_A, 2);
    codes.add(p.code.code);
    zs.add(JSON.stringify(p.zVec));
  }
  assert.equal(codes.size, 1, '不同性别认同产生了不同代码');
  assert.equal(zs.size, 1, '不同性别认同产生了不同维度分');
});

test('八字合婚已对称化：交换双方结果不变，且与性别无关', () => {
  const a = profile({}, { gender: 'woman' }, BIRTH_A);
  const b = profile({}, { gender: 'man' }, BIRTH_B, 6);
  const a2 = profile({}, { gender: 'man' }, BIRTH_A);
  const b2 = profile({}, { gender: 'woman' }, BIRTH_B, 6);
  assert.equal(baziAffinity(a.chart, b.chart).score, baziAffinity(b.chart, a.chart).score);
  assert.equal(baziAffinity(a.chart, b.chart).score, baziAffinity(a2.chart, b2.chart).score);
});

test('准入层：单方不寻求关系时不互相满足，但仍可用伙伴模式', () => {
  const a = profile({}, { gender: 'woman', attractedTo: ['none'] });
  const b = profile({}, { gender: 'man', attractedTo: ['woman'] }, BIRTH_B, 6);
  const g = gate(a.context, b.context);
  assert.equal(g.mutualWilling, false);
  assert.ok(g.notes.length > 0);
  const romantic = matchProfiles(a, b, { mode: 'romantic' });
  const partner = matchProfiles(a, b, { mode: 'partner' });
  assert.ok(partner.total > romantic.total, '伙伴模式应绕过准入层折减');
  assert.ok(romantic.risks.some((r) => r.includes('准入层')));
});

test('关系形态：单偶 × 多元被折减并给出协商提示', () => {
  const mono = profile({}, { relStyle: 'mono' });
  const poly = profile({}, { relStyle: 'poly' }, BIRTH_B, 6);
  const same = profile({}, { relStyle: 'mono' }, BIRTH_B, 6);
  const g1 = gate(mono.context, poly.context);
  const g2 = gate(mono.context, same.context);
  assert.ok(g1.relFactor < g2.relFactor);
  assert.ok(g1.notes.some((n) => n.includes('关系形态')));
});

test('性倾向标签本身不改变分数（只有匹配意愿会）', () => {
  const base = { gender: 'woman', attractedTo: ['any'] };
  const totals = new Set();
  for (const o of ['straight', 'gay', 'bi', 'pan', 'ace', 'queer', 'questioning', 'undisclosed']) {
    const a = profile({ P: 1 }, { ...base, orientation: o }, BIRTH_A, 4);
    const b = profile({ S: 1 }, { gender: 'nonbinary', attractedTo: ['any'], orientation: o }, BIRTH_B, 5);
    totals.add(matchProfiles(a, b).total);
  }
  assert.equal(totals.size, 1);
});

// ——————————————————— 单维匹配函数 ———————————————————
test('趋同型：差距越小分越高', () => {
  assert.ok(dimScore('sim', 1, 1) > dimScore('sim', 1, 2));
  assert.ok(dimScore('sim', 1, 2) > dimScore('sim', 1, 3));
  assert.equal(dimScore('sim', 0.5, 0.5), 100);
});

test('互补型：在最优差距处取峰值', () => {
  const cfg = { optimal: 0.9 };
  const peak = dimScore('comp', 0, 0.9, cfg);
  assert.ok(peak > dimScore('comp', 0, 0, cfg));
  assert.ok(peak > dimScore('comp', 0, 2.5, cfg));
});

test('争夺型：双方掌控欲同高时扣分', () => {
  assert.ok(dimScore('clash', 1.5, 1.5) < dimScore('clash', 0, 0));
});

test('振幅型：双高振幅扣分，但被稳态补偿', () => {
  const raw = dimScore('volatility', 1.5, 1.5, {}, { stability: -1 });
  const supported = dimScore('volatility', 1.5, 1.5, {}, { stability: 1.5 });
  assert.ok(supported > raw);
});

test('联合水平型：双方稳态越高分越高', () => {
  assert.ok(dimScore('joint-high', 1.5, 1.5) > dimScore('joint-high', -1.5, -1.5));
});

test('十二维匹配配置完整', () => {
  for (const k of DIM_KEYS) {
    const cfg = DIM_MATCH_CONFIG[k];
    assert.ok(cfg, k);
    assert.ok(['sim', 'comp', 'clash', 'volatility', 'joint-high'].includes(cfg.mode), k);
    assert.ok(cfg.w > 0 && cfg.note.length > 2);
  }
});

// ——————————————————— 符号层 ———————————————————
test('星盘相位对称且有界', () => {
  const a = profile({}, {}, BIRTH_A);
  const b = profile({}, {}, BIRTH_B, 6);
  const s1 = astroAffinity(a.chart, b.chart);
  const s2 = astroAffinity(b.chart, a.chart);
  assert.equal(s1.score, s2.score);
  assert.ok(s1.score >= 0 && s1.score <= 100);
});

test('卦象关系：综卦/错卦/同卦被正确识别', () => {
  const mk = (core, lines) => ({
    core,
    hexagram: { number: hexNum(lines), name: 'x', lines },
    changing: {
      reverse: { number: hexNum([...lines].reverse()) },
      inverse: { number: hexNum(lines.map((x) => 1 - x)) },
    },
  });
  const lines = [1, 0, 1, 1, 0, 0];
  const self = mk('RLFPWM', lines);
  assert.equal(hexagramAffinity(self, self).relation, '同卦');
  const inv = mk('DOCSBG', lines.map((x) => 1 - x));
  assert.equal(hexagramAffinity(self, inv).relation, '错卦（阴阳全反）');
  const rev = mk('X', [...lines].reverse());
  assert.equal(hexagramAffinity(self, rev).relation, '综卦（倒转）');
});

function hexNum(lines) {
  // 与 dimensions.js 同一算法的独立复算，用于交叉验证
  const KW = [
    [1, 43, 14, 34, 9, 5, 26, 11], [10, 58, 38, 54, 61, 60, 41, 19],
    [13, 49, 30, 55, 37, 63, 22, 36], [25, 17, 21, 51, 42, 3, 27, 24],
    [44, 28, 50, 32, 57, 48, 18, 46], [6, 47, 64, 40, 59, 29, 4, 7],
    [33, 31, 56, 62, 53, 39, 52, 15], [12, 45, 35, 16, 20, 8, 23, 2],
  ];
  const t = (b) => 7 - (b[0] * 4 + b[1] * 2 + b[2]);
  return KW[t(lines.slice(0, 3))][t(lines.slice(3, 6))];
}

test('λb = 0 时符号层完全不参与总分', () => {
  const a = profile({ R: 2 }, { symbolWeight: 0 }, BIRTH_A, 3);
  const b = profile({ D: 2 }, { symbolWeight: 0 }, BIRTH_B, 4);
  const m = matchProfiles(a, b);
  assert.equal(m.weights.symbol, 0);
  assert.equal(m.weights.psyche, 1);
});

test('λb 越高，符号层权重越大（上限 0.5）', () => {
  const mk = (lb) => matchProfiles(
    profile({ R: 1 }, { symbolWeight: lb }, BIRTH_A, 3),
    profile({ D: 1 }, { symbolWeight: lb }, BIRTH_B, 4),
  ).weights.symbol;
  assert.ok(mk(0.4) > mk(0.15) && mk(0.15) > mk(0.05));
  assert.ok(mk(0.4) <= 0.5);
});

// ——————————————————— 辅助 ———————————————————
test('配对代码：同极大写、异极小写', () => {
  const A = { core: 'RLFPWM' };
  const B = { core: 'RLFPWM' };
  assert.equal(buildPairCode(A, B, 90), 'RLFPWM-S');
  assert.equal(buildPairCode(A, { core: 'DOCSBG' }, 40), 'rlfpwm-D');
  assert.equal(buildPairCode(A, { core: 'RLFSBG' }, 70), 'RLFpwm-B');
});

test('等级阈值单调', () => {
  const grades = [95, 80, 70, 55, 20].map(gradeOf);
  assert.deepEqual(grades, ['S', 'A', 'B', 'C', 'D']);
});

test('六轴对照输出 6 行并标记同异', () => {
  const a = profile({ R: 2 }, {}, BIRTH_A, 3);
  const b = profile({ R: 2 }, {}, BIRTH_A, 3);
  const cmp = axisComparison(a, b);
  assert.equal(cmp.length, 6);
  assert.ok(cmp.every((c) => c.same));
});
