import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMENSIONS, DIM_KEYS, AXES, KING_WEN, HEXAGRAM_NAMES, TRIGRAMS,
  hexagramFromLines, reverseHexagram, inverseHexagram, PREFIX_NAMES, SUFFIX_NAMES,
} from '../src/core/dimensions.js';
import { ITEMS, ITEMS_BY_DIM, shuffledItems, CONTEXT_ITEMS, LIKERT } from '../src/core/questionnaire.js';
import { buildProfile, buildBirthChart, scoreQuestionnaire, symbolicPrior, composite, NORMS } from '../src/core/scoring.js';
import { v, crossSystemProfile, SIGN_VECTORS, ENNEAGRAM_VECTORS, SOURCE_WEIGHTS } from '../src/core/mapping.js';
import { rankedSystems, SYSTEMS, influenceIndex } from '../src/data/systems.js';

const BIRTH = { year: 1992, month: 9, day: 14, hour: 8, minute: 30, tzHours: 8, lonEast: 121.47, latNorth: 31.23, name: 'Wei Lan' };

function responsesFrom(bias, noiseSeed = 1) {
  let s = noiseSeed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const out = {};
  for (const it of ITEMS) {
    out[it.id] = Math.max(1, Math.min(7, Math.round(4 + (bias[it.d] ?? 0) * it.k + (rnd() - 0.5) * 0.8)));
  }
  return out;
}
const flat = (v2) => Object.fromEntries(ITEMS.map((i) => [i.id, v2]));

// ——————————————————— 十二维与轴 ———————————————————
test('十二维：12 个、键唯一、两两成 6 轴', () => {
  assert.equal(DIMENSIONS.length, 12);
  assert.equal(new Set(DIM_KEYS).size, 12);
  assert.equal(AXES.length, 6);
  const covered = AXES.flatMap((a) => a.poles).sort();
  assert.deepEqual(covered, [...DIM_KEYS].sort());
  for (const ax of AXES) {
    for (const [i, p] of ax.poles.entries()) {
      const d = DIMENSIONS.find((x) => x.key === p);
      assert.equal(d.axis, ax.id);
      assert.equal(d.pole, i);
    }
  }
});

test('十二维元数据完整', () => {
  for (const d of DIMENSIONS) {
    for (const f of ['name', 'en', 'pinyin', 'gloss', 'glossEn', 'high', 'low', 'chakra', 'dosha']) {
      assert.ok(d[f] && String(d[f]).length > 0, `${d.key}.${f}`);
    }
    assert.ok(d.element >= 0 && d.element <= 4);
  }
});

// ——————————————————— 卦序表 ———————————————————
test('文王卦序表：64 卦不重不漏', () => {
  const all = KING_WEN.flat().sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: 64 }, (_, i) => i + 1));
  assert.equal(HEXAGRAM_NAMES.length, 64);
  assert.equal(new Set(HEXAGRAM_NAMES).size, 64);
});

test('八卦二进制与顺序自洽（乾兑离震巽坎艮坤）', () => {
  TRIGRAMS.forEach((t, i) => {
    assert.equal(7 - (t.bits[0] * 4 + t.bits[1] * 2 + t.bits[2]), i, t.zh);
  });
});

test('六爻 → 卦：已知案例', () => {
  const cases = [
    [[1, 1, 1, 1, 1, 1], 1, '乾'],
    [[0, 0, 0, 0, 0, 0], 2, '坤'],
    [[1, 0, 0, 0, 1, 0], 3, '屯'], // 下震上坎
    [[0, 1, 0, 0, 0, 1], 4, '蒙'], // 下坎上艮
    [[1, 1, 1, 0, 1, 0], 5, '需'], // 下乾上坎
    [[0, 1, 0, 1, 1, 1], 6, '讼'], // 下坎上乾
    [[1, 1, 1, 0, 0, 0], 11, '泰'],
    [[0, 0, 0, 1, 1, 1], 12, '否'],
    [[1, 0, 1, 0, 1, 0], 63, '既济'],
    [[0, 1, 0, 1, 0, 1], 64, '未济'],
  ];
  for (const [lines, num, name] of cases) {
    const h = hexagramFromLines(lines);
    assert.equal(h.number, num, `${name} 期望 ${num} 实得 ${h.number}`);
    assert.equal(h.name, name);
  }
});

test('64 种极性组合一一映射到 64 卦', () => {
  const nums = new Set();
  for (let i = 0; i < 64; i += 1) {
    const lines = [0, 1, 2, 3, 4, 5].map((b) => (i >> b) & 1);
    nums.add(hexagramFromLines(lines).number);
  }
  assert.equal(nums.size, 64);
});

test('综卦与错卦为对合变换', () => {
  for (let i = 0; i < 64; i += 1) {
    const lines = [0, 1, 2, 3, 4, 5].map((b) => (i >> b) & 1);
    assert.equal(reverseHexagram(reverseHexagram(lines).lines).number, hexagramFromLines(lines).number);
    assert.equal(inverseHexagram(inverseHexagram(lines).lines).number, hexagramFromLines(lines).number);
  }
});

test('型名表覆盖全部 8×8 组合', () => {
  assert.equal(Object.keys(PREFIX_NAMES).length, 8);
  assert.equal(Object.keys(SUFFIX_NAMES).length, 8);
  for (let i = 0; i < 64; i += 1) {
    const lines = [0, 1, 2, 3, 4, 5].map((b) => (i >> b) & 1);
    const core = AXES.map((ax, k) => ax.poles[lines[k] === 1 ? 0 : 1]).join('');
    assert.ok(PREFIX_NAMES[core.slice(0, 3)], core);
    assert.ok(SUFFIX_NAMES[core.slice(3, 6)], core);
  }
});

// ——————————————————— 问卷 ———————————————————
test('问卷：144 题，每维 12 题（8 正 4 反），ID 唯一', () => {
  assert.equal(ITEMS.length, 144);
  assert.ok(ITEMS.length >= 100 && ITEMS.length <= 200, '题量应在 100–200 之间');
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, 144);
  for (const k of DIM_KEYS) {
    const items = ITEMS_BY_DIM[k];
    assert.equal(items.length, 12, k);
    assert.equal(items.filter((i) => i.k === 1).length, 8, `${k} 正向题`);
    assert.equal(items.filter((i) => i.k === -1).length, 4, `${k} 反向题`);
    for (const it of items) {
      assert.ok(it.zh.length > 4 && it.en.length > 4, it.id);
      assert.equal(it.id.slice(0, 1), k);
    }
  }
  assert.equal(new Set(ITEMS.map((i) => i.zh)).size, 144, '题干不得重复');
  assert.equal(LIKERT.length, 7);
});

test('打散题序：可复现、无遗漏、极少相邻同维', () => {
  const a = shuffledItems();
  const b = shuffledItems();
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.equal(a.length, 144);
  assert.equal(new Set(a.map((x) => x.id)).size, 144);
  let adjacent = 0;
  for (let i = 1; i < a.length; i += 1) if (a[i].d === a[i - 1].d) adjacent += 1;
  assert.ok(adjacent <= 6, `相邻同维 ${adjacent} 处`);
});

test('情境题：身份类字段被标注 scope 且不参与计分', () => {
  const ids = CONTEXT_ITEMS.map((c) => c.id);
  for (const need of ['gender', 'orientation', 'attractedTo', 'relStyle', 'symbolWeight']) {
    assert.ok(ids.includes(need), need);
  }
  for (const c of CONTEXT_ITEMS) assert.ok(['identity', 'matching', 'prior', 'config'].includes(c.scope));
  // 情境题的 id 不得与计分题重名
  for (const c of CONTEXT_ITEMS) assert.ok(!ITEMS.some((i) => i.id === c.id));
});

// ——————————————————— 计分 ———————————————————
test('反向题生效：全选 7 不会让所有维度都拉满', () => {
  const q = scoreQuestionnaire(flat(7));
  for (const k of DIM_KEYS) {
    // 8 正 4 反 → 原始分 = (8-4)/12 = 0.333
    assert.ok(Math.abs(q.perDim[k].raw - 1 / 3) < 5e-4, `${k} raw=${q.perDim[k].raw}`);
  }
  assert.ok(q.validity.flags.some((f) => f.includes('默认同意')));
  assert.ok(q.validity.consistency < 0.2, '全选同一档应判定为低一致性');
});

test('全选 4（中性）：原始分为 0，且触发离散度警示', () => {
  const q = scoreQuestionnaire(flat(4));
  for (const k of DIM_KEYS) assert.equal(q.perDim[k].raw, 0);
  assert.ok(q.validity.flags.some((f) => f.includes('直线作答')));
});

test('未作答按中性处理并降低完整度', () => {
  const partial = {};
  ITEMS.slice(0, 72).forEach((i) => { partial[i.id] = 6; });
  const q = scoreQuestionnaire(partial);
  assert.ok(Math.abs(q.validity.completeness - 0.5) < 1e-9);
  assert.ok(q.validity.flags.some((f) => f.includes('不完整')));
});

test('维度分随作答单调变化', () => {
  const low = buildProfile({ birth: null, responses: responsesFrom({ R: -3 }), context: {} });
  const high = buildProfile({ birth: null, responses: responsesFrom({ R: 3 }), context: {} });
  assert.ok(high.dims.R.score > low.dims.R.score + 30, `${low.dims.R.score} → ${high.dims.R.score}`);
  assert.ok(high.dims.R.score >= 80 && low.dims.R.score <= 25);
});

test('分数被限制在 1–99 且 95% 区间包含点估计', () => {
  for (const bias of [{}, { R: 5, F: 5 }, { D: -5, S: -5 }]) {
    const p = buildProfile({ birth: BIRTH, responses: responsesFrom(bias), context: { symbolWeight: 0.2 } });
    for (const k of DIM_KEYS) {
      const d = p.dims[k];
      assert.ok(d.score >= 1 && d.score <= 99, `${k}=${d.score}`);
      assert.ok(d.ci95[0] <= d.score && d.score <= d.ci95[1], `${k} CI ${d.ci95} vs ${d.score}`);
    }
  }
});

test('λb = 0 时出生信息对分数完全无影响', () => {
  const r = responsesFrom({ O: 2, W: -2 });
  const withBirth = buildProfile({ birth: BIRTH, responses: r, context: { symbolWeight: 0 } });
  const otherBirth = buildProfile({
    birth: { ...BIRTH, year: 1966, month: 2, day: 2, hour: 23 }, responses: r, context: { symbolWeight: 0 },
  });
  for (const k of DIM_KEYS) assert.equal(withBirth.dims[k].score, otherBirth.dims[k].score, k);
});

test('λb 增大时象征层占比随之增大', () => {
  const r = responsesFrom({ P: 1 });
  const a = buildProfile({ birth: BIRTH, responses: r, context: { symbolWeight: 0.05 } });
  const b = buildProfile({ birth: BIRTH, responses: r, context: { symbolWeight: 0.4 } });
  const shareA = DIM_KEYS.reduce((s, k) => s + a.dims[k].symbolicShare, 0);
  const shareB = DIM_KEYS.reduce((s, k) => s + b.dims[k].symbolicShare, 0);
  assert.ok(shareB > shareA * 2, `${shareA} → ${shareB}`);
  assert.equal(b.lambdaB, 0.4);
});

test('λb 被夹在 [0, 0.4]', () => {
  const p = buildProfile({ birth: BIRTH, responses: responsesFrom({}), context: { symbolWeight: 9 } });
  assert.equal(p.lambdaB, 0.4);
});

test('常模覆盖全部十二维且 σ > 0', () => {
  for (const k of DIM_KEYS) {
    assert.ok(NORMS[k], k);
    assert.ok(NORMS[k].sigma > 0.2 && NORMS[k].sigma < 1);
  }
});

// ——————————————————— OML 代码 ———————————————————
test('代码格式：6 字母 + 五行数字 + A/T', () => {
  for (let s = 1; s <= 30; s += 1) {
    const bias = {};
    DIM_KEYS.forEach((k, i) => { bias[k] = Math.sin(s * 7.13 + i * 2.7) * 3; });
    const p = buildProfile({ birth: BIRTH, responses: responsesFrom(bias, s), context: { symbolWeight: 0.15 } });
    assert.match(p.code.code, /^[RD][LO][FC][PS][WB][MG]-[1-5][AT]$/, p.code.code);
    assert.equal(p.code.core.length, 6);
    assert.ok(p.code.hexagram.number >= 1 && p.code.hexagram.number <= 64);
    assert.ok(p.code.name.zh.includes('·'));
    assert.ok(p.code.typeIndex >= 0 && p.code.typeIndex < 64);
  }
});

test('代码字母与轴向分数一致', () => {
  const p = buildProfile({ birth: BIRTH, responses: responsesFrom({ R: 3, D: -3, O: 3, L: -3 }), context: {} });
  assert.equal(p.code.core[0], 'R');
  assert.equal(p.code.core[1], 'O');
  AXES.forEach((ax, i) => {
    const [a, b] = ax.poles;
    const pick = p.code.core[i];
    assert.equal(pick, p.dims[a].z >= p.dims[b].z ? a : b, ax.zh);
  });
});

test('六爻与代码字母一一对应（轴 0 = 初爻）', () => {
  const p = buildProfile({ birth: BIRTH, responses: responsesFrom({ R: 2, F: 2, W: 2 }), context: {} });
  AXES.forEach((ax, i) => {
    assert.equal(p.code.hexagram.lines[i], p.code.core[i] === ax.poles[0] ? 1 : 0);
  });
});

test('同一输入完全可复现', () => {
  const r = responsesFrom({ M: 2, G: -2 }, 42);
  const a = buildProfile({ birth: BIRTH, responses: r, context: { symbolWeight: 0.15 } });
  const b = buildProfile({ birth: BIRTH, responses: r, context: { symbolWeight: 0.15 } });
  assert.equal(a.code.code, b.code.code);
  assert.deepEqual(a.zVec, b.zVec);
});

test('64 种核心型在参数空间内均可达', () => {
  const seen = new Set();
  for (let i = 0; i < 64; i += 1) {
    const bias = {};
    AXES.forEach((ax, k) => {
      const on = (i >> k) & 1;
      bias[ax.poles[0]] = on ? 2.6 : -2.6;
      bias[ax.poles[1]] = on ? -2.6 : 2.6;
    });
    const p = buildProfile({ birth: BIRTH, responses: responsesFrom(bias, i + 1), context: { symbolWeight: 0 } });
    seen.add(p.code.core);
  }
  assert.equal(seen.size, 64, `仅覆盖 ${seen.size} 种`);
});

test('A/T 后缀：高稳态低振幅 → A，低稳态高振幅 → T', () => {
  const calm = buildProfile({ birth: BIRTH, responses: responsesFrom({ S: 3, P: -3 }), context: { symbolWeight: 0 } });
  const storm = buildProfile({ birth: BIRTH, responses: responsesFrom({ S: -3, P: 3 }), context: { symbolWeight: 0 } });
  assert.equal(calm.code.temper, 'A');
  assert.equal(storm.code.temper, 'T');
});

test('内部张力：两极同高时张力显著大于两极分化时', () => {
  const both = buildProfile({ birth: BIRTH, responses: responsesFrom(Object.fromEntries(DIM_KEYS.map((k) => [k, 2.5]))), context: { symbolWeight: 0 } });
  const split = buildProfile({ birth: BIRTH, responses: responsesFrom({ R: 3, D: -3, L: 3, O: -3, F: 3, C: -3, P: 3, S: -3, W: 3, B: -3, M: 3, G: -3 }), context: { symbolWeight: 0 } });
  assert.ok(both.code.tension > split.code.tension + 0.5, `${both.code.tension} vs ${split.code.tension}`);
});

// ——————————————————— 出生图与先验 ———————————————————
test('出生图结构完整', () => {
  const c = buildBirthChart(BIRTH);
  assert.ok(c.western.sun.sign.zh && c.western.moon.sign.zh && c.western.ascendant.sign.zh);
  assert.ok(c.chinese.pillars.day.name.length === 2);
  assert.ok(c.vedic.nakshatra && c.vedic.ayanamsa > 20);
  assert.ok(c.numerology.lifePath >= 1);
  assert.ok(c.calendars.tzolkin.kin >= 1 && c.calendars.tzolkin.kin <= 260);
  assert.ok(c.calendars.humanDesignGate.gate >= 1 && c.calendars.humanDesignGate.gate <= 64);
  assert.ok(c.calendars.humanDesignGate.approximate === true);
});

test('未提供出生时间时不输出上升点', () => {
  const c = buildBirthChart({ ...BIRTH, timeKnown: false });
  assert.equal(c.western.ascendant, null);
  assert.equal(c.western.midheaven, null);
});

test('无出生信息时仍可完成测评（纯心理测量模式）', () => {
  const p = buildProfile({ birth: null, responses: responsesFrom({ R: 2 }), context: {} });
  assert.equal(p.chart, null);
  assert.equal(p.prior, null);
  assert.equal(p.lambdaB, 0);
  assert.match(p.code.code, /^[RD][LO][FC][PS][WB][MG]-[1-5][AT]$/);
});

test('象征先验：有限、有界、可解释', () => {
  const c = buildBirthChart(BIRTH);
  const prior = symbolicPrior(c, { mbtiSelf: 'INTJ', enneaSelf: '5', bloodType: 'A' });
  assert.equal(prior.vector.length, 12);
  assert.ok(prior.vector.every(Number.isFinite));
  assert.ok(prior.vector.every((x) => Math.abs(x) < 2), '先验不应超出 2σ');
  assert.ok(prior.contributions.length >= 10);
  for (const c2 of prior.contributions) {
    assert.ok(c2.label && c2.weight > 0 && c2.vector.length === 12);
  }
  // 自陈 MBTI 应出现在贡献项里
  assert.ok(prior.contributions.some((x) => x.label.includes('INTJ')));
});

test('非法自陈 MBTI 被忽略', () => {
  const c = buildBirthChart(BIRTH);
  const prior = symbolicPrior(c, { mbtiSelf: 'XXXX' });
  assert.ok(!prior.contributions.some((x) => x.label.includes('XXXX')));
});

// ——————————————————— 映射表 ———————————————————
test('映射向量维度一致', () => {
  assert.equal(v({ R: 1 }).length, 12);
  assert.equal(SIGN_VECTORS.length, 12);
  for (const vec of SIGN_VECTORS) assert.equal(vec.length, 12);
  for (const vec of Object.values(ENNEAGRAM_VECTORS)) assert.equal(vec.length, 12);
  for (const w of Object.values(SOURCE_WEIGHTS)) assert.ok(w > 0 && w <= 1);
});

test('反向映射：MBTI 随对应维度翻转', () => {
  const z = DIM_KEYS.map(() => 0);
  const R = DIM_KEYS.indexOf('R'); const D = DIM_KEYS.indexOf('D');
  z[R] = 2; z[D] = -2;
  assert.equal(crossSystemProfile(z).mbti.code[0], 'E');
  z[R] = -2; z[D] = 2;
  assert.equal(crossSystemProfile(z).mbti.code[0], 'I');
});

test('反向映射：全部通道产出且取值合法', () => {
  const p = buildProfile({ birth: BIRTH, responses: responsesFrom({ O: 2, P: 2, W: 1 }), context: {} });
  const c = p.cross;
  assert.match(c.mbti.code, /^[EI][NS][FT][PJ]$/);
  for (const val of Object.values(c.bigFive)) assert.ok(val >= 1 && val <= 99);
  assert.ok(c.enneagram.type >= 1 && c.enneagram.type <= 9);
  assert.ok(['secure', 'anxious', 'dismissive', 'fearful'].includes(c.attachment.key));
  assert.equal(c.loveLanguages.length, 5);
  assert.equal(Object.values(c.elementAffinity).reduce((a, b) => a + b, 0), 100);
  assert.ok(c.chakra.dominant && c.dosha.dominant && c.tcm.dominant && c.humanDesign.type);
});

test('反向映射：神经质随汐升磐降而升', () => {
  const calm = buildProfile({ birth: null, responses: responsesFrom({ S: 3, P: -3 }), context: {} });
  const storm = buildProfile({ birth: null, responses: responsesFrom({ S: -3, P: 3 }), context: {} });
  assert.ok(storm.cross.bigFive.neuroticism > calm.cross.bigFive.neuroticism + 25);
});

// ——————————————————— 体系普查 ———————————————————
test('体系普查：47 项、ID 唯一、影响指数可复算', () => {
  assert.equal(SYSTEMS.length, 47);
  assert.equal(new Set(SYSTEMS.map((s) => s.id)).size, 47);
  const r = rankedSystems();
  assert.equal(r[0].rank, 1);
  for (let i = 1; i < r.length; i += 1) assert.ok(r[i - 1].influence >= r[i].influence);
  for (const s of SYSTEMS) {
    assert.ok(influenceIndex(s) >= 0 && influenceIndex(s) <= 100);
    for (const k of ['reach', 'active', 'commerce', 'institution', 'academia']) {
      assert.ok(s[k] >= 0 && s[k] <= 100, `${s.id}.${k}`);
    }
    assert.ok(['divination', 'psychometric', 'popculture', 'identity', 'somatic'].includes(s.family));
    assert.ok(s.mechanism.length > 5 && s.omlUse.length > 5, s.id);
  }
});

test('体系普查覆盖六大文明区的代表体系', () => {
  const ids = new Set(SYSTEMS.map((s) => s.id));
  for (const need of ['western-astrology', 'bazi', 'vedic', 'maya', 'ifa', 'runes', 'abjad', 'mbti', 'bigfive', 'kinsey', 'gendersp']) {
    assert.ok(ids.has(need), need);
  }
});
