/**
 * scoring.js — 十二维评分引擎与 OML 代码生成
 * Scoring engine: questionnaire → z-scores, birth data → symbolic prior, and the OML code.
 *
 * 主公式（详见 docs/02-oml-spec.md）：
 *
 *   x_i      = k_i · (r_i − 4) / 3                      单题归一化，k 为正/反向键
 *   Q_d      = mean_{i∈d} x_i                            维度原始分 ∈ [−1, 1]
 *   Zq_d     = (Q_d − μ_d) / σ_d                         按常模标准化
 *   B_d      = Σ_s w_s · vec_s[d] / Σ_s w_s              象征先验（出生信息 + 自陈他系统）
 *   Z_d      = (λq·Zq_d + λb·B̂_d) / √(λq² + λb²)         复合（保持单位方差）
 *   Score_d  = clamp(round(50 + 15·Z_d), 1, 99)          十二维分数
 *
 * λb 由用户控制（默认 0.15，可置 0 得到纯心理测量结果）。λq = 1 − λb 归一前的基准取 1。
 */

import {
  localToJD, julianDay, sunLongitude, moonLongitude, ascendantMC, lunarPhase,
  signOf, signIndex, degreeInSign, ayanamsaLahiri, NAKSHATRAS, norm360, solarTermOf,
} from './astro.js';
import { analyzeBazi, ELEMENTS, ELEMENT_KEY } from './bazi.js';
import { lifePath, nameNumbers, hdGate, birthRune, celticTree, tzolkin } from './numerology.js';
import {
  DIMENSIONS, DIM_KEYS, AXES, PREFIX_NAMES, SUFFIX_NAMES, ELEMENT_LABEL,
  TEMPER, hexagramFromLines, reverseHexagram, inverseHexagram,
} from './dimensions.js';
import { ITEMS, ITEMS_BY_DIM } from './questionnaire.js';
import {
  SIGN_VECTORS, LUNAR_PHASE_VECTORS, ELEMENT_VECTORS, DAY_MASTER_VECTORS,
  TEN_GOD_VECTORS, ZODIAC_VECTORS, LIFE_PATH_VECTORS, TZOLKIN_VECTORS,
  MBTI_AXIS_VECTORS, ENNEAGRAM_VECTORS, BLOOD_TYPE_VECTORS, SOURCE_WEIGHTS,
  addVec, scaleVec, zeroVec, v, crossSystemProfile,
} from './mapping.js';

/**
 * 十二维常模（provisional norms）。
 * 当前为设计常模：以「量表中点 + 轻度默认同意偏差」为基准的先验值，
 * 待收集 ≥1000 份真实样本后应替换为分层常模（见 docs/02-oml-spec.md §7.2）。
 */
export const NORMS = {
  R: { mu: 0.05, sigma: 0.44 }, D: { mu: 0.18, sigma: 0.40 },
  L: { mu: 0.16, sigma: 0.40 }, O: { mu: 0.08, sigma: 0.45 },
  F: { mu: 0.10, sigma: 0.42 }, C: { mu: 0.06, sigma: 0.41 },
  P: { mu: 0.14, sigma: 0.44 }, S: { mu: 0.04, sigma: 0.43 },
  W: { mu: 0.12, sigma: 0.42 }, B: { mu: 0.02, sigma: 0.43 },
  M: { mu: 0.10, sigma: 0.42 }, G: { mu: 0.12, sigma: 0.41 },
};

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

// ————————————————————————— 一、出生信息算法 —————————————————————————
/**
 * @param {object} birth {year,month,day,hour,minute,tzHours,lonEast,latNorth,name}
 * @returns 完整的出生符号图（星盘 + 八字 + 数字 + 历法）
 */
export function buildBirthChart(birth) {
  const {
    year, month, day, hour = 12, minute = 0,
    tzHours = 8, lonEast = 116.4, latNorth = 39.9, name = '',
    timeKnown = true,
  } = birth;

  const jd = localToJD({ year, month, day, hour: timeKnown ? hour : 12, minute, tzHours });
  const jdn = Math.floor(julianDay(year, month, day)) + 1;

  const sunLon = sunLongitude(jd);
  const moonLon = moonLongitude(jd);
  const { asc, mc } = ascendantMC(jd, lonEast, latNorth);
  const phase = lunarPhase(jd);
  const ayan = ayanamsaLahiri(jd);
  const sidSun = norm360(sunLon - ayan);
  const sidMoon = norm360(moonLon - ayan);

  const bazi = analyzeBazi({ year, month, day, hour: timeKnown ? hour : 12, minute, tzHours, lonEast });
  const lp = lifePath(year, month, day);
  const tz = tzolkin(jdn);

  return {
    input: { ...birth, timeKnown },
    jd,
    jdn,
    western: {
      sun: { lon: sunLon, sign: signOf(sunLon), signIndex: signIndex(sunLon), deg: +degreeInSign(sunLon).toFixed(2) },
      moon: { lon: moonLon, sign: signOf(moonLon), signIndex: signIndex(moonLon), deg: +degreeInSign(moonLon).toFixed(2) },
      ascendant: timeKnown
        ? { lon: asc, sign: signOf(asc), signIndex: signIndex(asc), deg: +degreeInSign(asc).toFixed(2) }
        : null,
      midheaven: timeKnown ? { lon: mc, sign: signOf(mc), signIndex: signIndex(mc) } : null,
      lunarPhase: phase,
      sunSignModality: signOf(sunLon).modality,
      sunSignElement: signOf(sunLon).element,
    },
    vedic: {
      ayanamsa: +ayan.toFixed(3),
      sun: { lon: sidSun, sign: signOf(sidSun) },
      moon: { lon: sidMoon, sign: signOf(sidMoon) },
      nakshatra: NAKSHATRAS[Math.floor(sidMoon / (360 / 27))],
      nakshatraPada: Math.floor((sidMoon % (360 / 27)) / (360 / 108)) + 1,
    },
    chinese: {
      ...bazi,
      solarTerm: solarTermOf(jd).name,
    },
    numerology: {
      lifePath: lp,
      name: nameNumbers(name),
    },
    calendars: {
      tzolkin: tz,
      humanDesignGate: hdGate(sunLon),
      rune: birthRune(jdn),
      celticTree: celticTree(month, day),
    },
  };
}

// ————————————————————————— 二、象征先验 B_d —————————————————————————
/**
 * 汇总所有符号来源 → 十二维先验向量（已按权重归一，单位近似 z）。
 * 返回 {vector, contributions} 便于在 UI 中展示「这一分来自哪里」。
 */
export function symbolicPrior(chart, ctx = {}) {
  let acc = zeroVec();
  let wsum = 0;
  const contributions = [];

  const push = (label, weight, vec, detail) => {
    if (!vec || weight <= 0) return;
    acc = addVec(acc, vec, weight);
    wsum += weight;
    contributions.push({ label, weight, detail, vector: vec });
  };

  const w = SOURCE_WEIGHTS;
  const west = chart.western;
  push(`太阳 ${west.sun.sign.zh}座`, w.sunSign, SIGN_VECTORS[west.sun.signIndex], west.sun.sign.zh);
  push(`月亮 ${west.moon.sign.zh}座`, w.moonSign, SIGN_VECTORS[west.moon.signIndex], west.moon.sign.zh);
  if (west.ascendant) {
    push(`上升 ${west.ascendant.sign.zh}座`, w.ascSign, SIGN_VECTORS[west.ascendant.signIndex], west.ascendant.sign.zh);
  }
  push(`月相 ${west.lunarPhase.zh}`, w.lunarPhase, LUNAR_PHASE_VECTORS[west.lunarPhase.index], west.lunarPhase.zh);

  // 五行：以偏离均衡值 0.2 的三倍作为强度
  const ratio = chart.chinese.elements.ratio;
  let elemVec = zeroVec();
  ratio.forEach((r, i) => { elemVec = addVec(elemVec, ELEMENT_VECTORS[i], (r - 0.2) * 3); });
  push(`五行结构（${ELEMENTS[chart.chinese.elements.dominant]}旺）`, w.fiveElements, elemVec,
    ratio.map((r, i) => `${ELEMENTS[i]}${Math.round(r * 100)}%`).join(' '));

  push(`日主 ${chart.chinese.dayMaster.stem}`, w.dayMaster, DAY_MASTER_VECTORS[chart.chinese.dayMaster.stem], chart.chinese.dayMaster.stem);

  const st = chart.chinese.strength.score;
  push(`日主${chart.chinese.strength.label}`, w.strength,
    v({ F: 0.6 * st, B: 0.5 * st, S: 0.4 * st, C: -0.3 * st, W: -0.2 * st }), chart.chinese.strength.label);

  const topGod = chart.chinese.tenGodProfile.top[0];
  if (topGod) push(`十神主气 ${topGod.god}`, w.tenGod, TEN_GOD_VECTORS[topGod.god], topGod.god);

  const zIdx = chart.chinese.pillars.year.branch;
  push(`生肖 ${chart.chinese.zodiac}`, w.chineseZodiac, ZODIAC_VECTORS[zIdx], chart.chinese.zodiac);

  push(`生命灵数 ${chart.numerology.lifePath}`, w.lifePath, LIFE_PATH_VECTORS[chart.numerology.lifePath], String(chart.numerology.lifePath));
  push(`卓尔金 ${chart.calendars.tzolkin.name}`, w.tzolkin, TZOLKIN_VECTORS[chart.calendars.tzolkin.nameIdx], chart.calendars.tzolkin.name);

  // 自陈他系统（可选）
  const mbti = (ctx.mbtiSelf || '').toUpperCase().trim();
  if (/^[EI][SN][TF][JP]$/.test(mbti)) {
    let mv = zeroVec();
    for (const ch of mbti) mv = addVec(mv, MBTI_AXIS_VECTORS[ch], 0.25);
    push(`自陈 MBTI ${mbti}`, w.mbtiSelf, mv, mbti);
  }
  if (ctx.enneaSelf && ENNEAGRAM_VECTORS[ctx.enneaSelf]) {
    push(`自陈九型 ${ctx.enneaSelf} 号`, w.enneagramSelf, ENNEAGRAM_VECTORS[ctx.enneaSelf], String(ctx.enneaSelf));
  }
  if (ctx.bloodType && BLOOD_TYPE_VECTORS[ctx.bloodType]) {
    push(`血型 ${ctx.bloodType}`, w.bloodType, BLOOD_TYPE_VECTORS[ctx.bloodType], ctx.bloodType);
  }

  const vector = wsum > 0 ? scaleVec(acc, 1 / wsum) : zeroVec();
  // 归一到近似单位方差：先验向量本身的尺度约 0.25σ，放大到可比的 z 尺度
  const scaled = scaleVec(vector, 2.4);
  return { vector: scaled, rawVector: vector, contributions, weightSum: wsum };
}

// ————————————————————————— 三、问卷计分 —————————————————————————
/**
 * @param {object} responses {itemId: 1..7}
 */
export function scoreQuestionnaire(responses = {}) {
  const perDim = {};
  const answeredAll = [];
  for (const key of DIM_KEYS) {
    const items = ITEMS_BY_DIM[key];
    const xs = [];
    const pos = [];
    const neg = [];
    let answered = 0;
    for (const it of items) {
      const r = responses[it.id];
      const raw = Number.isFinite(r) ? r : 4;
      if (Number.isFinite(r)) { answered += 1; answeredAll.push(raw); }
      const x = (it.k * (raw - 4)) / 3;
      xs.push(x);
      (it.k > 0 ? pos : neg).push(x);
    }
    const Q = mean(xs);
    const { mu, sigma } = NORMS[key];
    perDim[key] = {
      raw: +Q.toFixed(4),
      z: +((Q - mu) / sigma).toFixed(4),
      answered,
      total: items.length,
      // 正反向题的一致性：两组均值差越小越一致
      keyGap: +Math.abs(mean(pos) - mean(neg)).toFixed(3),
      se: sigma / Math.sqrt(Math.max(1, answered)),
    };
  }

  const all = ITEMS.map((it) => responses[it.id]).filter(Number.isFinite);
  const completeness = all.length / ITEMS.length;
  const variability = sd(all);
  const acquiescence = all.length ? mean(all) - 4 : 0;
  const keyGaps = DIM_KEYS.map((k) => perDim[k].keyGap);
  const consistency = clamp(1 - mean(keyGaps) / 1.2, 0, 1);

  const flags = [];
  if (completeness < 0.9) flags.push('作答不完整：未答题按中性 4 处理，结果置信度下降。');
  if (variability < 0.6 && all.length > 20) flags.push('作答离散度过低：可能存在直线作答（straight-lining）。');
  if (Math.abs(acquiescence) > 1.2) flags.push('存在明显的默认同意/否认倾向，已由反向题部分抵消。');
  if (consistency < 0.55) flags.push('正反向题一致性偏低：部分维度分数需谨慎解读。');

  return {
    perDim,
    validity: {
      completeness: +completeness.toFixed(3),
      variability: +variability.toFixed(3),
      acquiescence: +acquiescence.toFixed(3),
      consistency: +consistency.toFixed(3),
      overall: +clamp(0.45 * completeness + 0.35 * consistency + 0.2 * clamp(variability / 1.4, 0, 1), 0, 1).toFixed(3),
      flags,
    },
  };
}

// ————————————————————————— 四、复合评分 —————————————————————————
export function composite(qs, prior, lambdaB = 0.15) {
  const lb = clamp(lambdaB, 0, 0.4);
  const lq = 1;
  const denom = Math.sqrt(lq * lq + lb * lb);
  const dims = {};
  const zVec = [];
  DIM_KEYS.forEach((key, i) => {
    const zq = qs.perDim[key].z;
    const b = prior ? prior.vector[i] : 0;
    const z = (lq * zq + lb * b) / denom;
    const score = clamp(Math.round(50 + 15 * z), 1, 99);
    zVec.push(z);
    dims[key] = {
      key,
      score,
      z: +z.toFixed(3),
      zQuestionnaire: +zq.toFixed(3),
      zSymbolic: +b.toFixed(3),
      symbolicShare: +(Math.abs(lb * b) / (Math.abs(lq * zq) + Math.abs(lb * b) + 1e-9)).toFixed(3),
      ci95: [
        clamp(Math.round(50 + 15 * (z - 1.96 * qs.perDim[key].se / NORMS[key].sigma * 0.5)), 1, 99),
        clamp(Math.round(50 + 15 * (z + 1.96 * qs.perDim[key].se / NORMS[key].sigma * 0.5)), 1, 99),
      ],
      meta: DIMENSIONS.find((d) => d.key === key),
    };
  });
  return { dims, zVec, lambdaB: lb };
}

// ————————————————————————— 五、OML 代码 —————————————————————————
/**
 * 生成 OML 人格代码，形如  ROFPWM-3A
 *   6 字母 = 6 条轴的显性极（自轴 0 至轴 5）
 *   数字   = 五行主导（1木 2火 3土 4金 5水）
 *   后缀   = A 协 / T 荡（内部张力与情绪稳态的合成）
 */
export function omlCode(dims, chart, opts = {}) {
  const score = (k) => dims[k].score;
  const zOf = (k) => dims[k].z;

  const letters = [];
  const axisDetail = [];
  for (const ax of AXES) {
    const [a, b] = ax.poles;
    const diff = zOf(a) - zOf(b);
    const pick = diff >= 0 ? a : b;
    letters.push(pick);
    axisDetail.push({
      axis: ax,
      pick,
      other: pick === a ? b : a,
      margin: +Math.abs(diff).toFixed(3),
      clarity: clamp(Math.abs(diff) / 2, 0, 1),
      tension: Math.max(0, Math.min(zOf(a), zOf(b))), // 双极同高 = 内部张力
      scores: { [a]: score(a), [b]: score(b) },
    });
  }
  const core = letters.join('');

  // —— 六爻：轴 0 为初爻，轴 5 为上爻；首极为阳 ——
  const lines = AXES.map((ax, i) => (letters[i] === ax.poles[0] ? 1 : 0));
  const hexagram = hexagramFromLines(lines);

  // —— 五行代号 ——
  const element = dominantElement(dims, chart, opts.lambdaB ?? 0.15);

  // —— 调性后缀 ——
  const tension = mean(axisDetail.map((a) => a.tension));
  const coherence = 0.40 * zOf('S') - 0.35 * zOf('P') + 0.15 * zOf('B')
    + 0.10 * zOf('G') - 0.55 * tension + 0.15 * ((opts.consistency ?? 0.7) - 0.7) * 2;
  const temper = coherence >= 0 ? 'A' : 'T';

  const prefix = PREFIX_NAMES[core.slice(0, 3)];
  const suffix = SUFFIX_NAMES[core.slice(3, 6)];

  return {
    code: `${core}-${element.digit}${temper}`,
    core,
    element,
    temper,
    temperMeta: TEMPER[temper],
    coherence: +coherence.toFixed(3),
    tension: +tension.toFixed(3),
    axisDetail,
    hexagram,
    changing: { reverse: reverseHexagram(lines), inverse: inverseHexagram(lines) },
    name: { zh: `${prefix.zh}·${suffix.zh}`, en: `${prefix.en} ${suffix.en}` },
    prefix,
    suffix,
    typeIndex: lines.reduce((s, x, i) => s + x * 2 ** i, 0), // 0..63
  };
}

/** 五行主导：八字五行 + 十二维元素亲和 的加权合成 */
export function dominantElement(dims, chart, lambdaB = 0.15) {
  const fromDims = [0, 0, 0, 0, 0];
  for (const d of DIMENSIONS) fromDims[d.element] += dims[d.key].z;
  const maxAbs = Math.max(...fromDims.map(Math.abs)) || 1;
  const dimNorm = fromDims.map((x) => x / maxAbs);

  const baziRatio = chart ? chart.chinese.elements.ratio : [0.2, 0.2, 0.2, 0.2, 0.2];
  const baziNorm = baziRatio.map((r) => (r - 0.2) * 5);

  const wBazi = 0.35 + lambdaB; // λb 越高，八字权重越大
  const blend = dimNorm.map((x, i) => (1 - wBazi) * x + wBazi * baziNorm[i]);
  const idx = blend.indexOf(Math.max(...blend));
  return {
    index: idx,
    digit: String(idx + 1),
    zh: ELEMENT_LABEL[idx].zh,
    en: ELEMENT_LABEL[idx].en,
    keyword: ELEMENT_LABEL[idx].keyword,
    blend: blend.map((x) => +x.toFixed(3)),
    byName: Object.fromEntries(ELEMENT_KEY.map((k, i) => [k, +blend[i].toFixed(3)])),
  };
}

// ————————————————————————— 六、完整档案 —————————————————————————
/**
 * @param {object} input {birth, responses, context}
 */
export function buildProfile(input) {
  const { birth, responses = {}, context = {} } = input;
  const chart = birth ? buildBirthChart(birth) : null;
  const qs = scoreQuestionnaire(responses);
  const prior = chart ? symbolicPrior(chart, context) : null;
  const lambdaB = chart ? clamp(Number(context.symbolWeight ?? 0.15), 0, 0.4) : 0;
  const comp = composite(qs, prior, lambdaB);
  const code = omlCode(comp.dims, chart, { lambdaB, consistency: qs.validity.consistency });
  const cross = crossSystemProfile(comp.zVec);

  return {
    version: 'OML-1.0',
    generatedAt: new Date().toISOString(),
    chart,
    questionnaire: qs,
    prior,
    lambdaB,
    dims: comp.dims,
    zVec: comp.zVec,
    code,
    cross,
    context: sanitizeContext(context),
    narrative: narrate(comp.dims, code, cross),
  };
}

/** 身份字段仅保留匹配所需，且不进入任何特质推断 */
export function sanitizeContext(ctx) {
  return {
    gender: ctx.gender || 'undisclosed',
    pronouns: ctx.pronouns || '',
    orientation: ctx.orientation || 'undisclosed',
    attractedTo: Array.isArray(ctx.attractedTo) ? ctx.attractedTo : (ctx.attractedTo ? [ctx.attractedTo] : []),
    relStyle: ctx.relStyle || 'undecided',
    intimacyPace: ctx.intimacyPace || 'medium',
    symbolWeight: ctx.symbolWeight ?? 0.15,
  };
}

/** 生成结构化叙述（不做命定论断言） */
export function narrate(dims, code, cross) {
  const sorted = DIM_KEYS.map((k) => dims[k]).sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const bottom = sorted.slice(-2);
  const strengths = top.map((d) => `${d.meta.name}${d.meta.en}（${d.score}）：${d.meta.high}`);
  const growth = bottom.map((d) => `${d.meta.name}${d.meta.en}（${d.score}）：${d.meta.low}`);
  const tensionAxes = code.axisDetail
    .filter((a) => a.tension > 0.3)
    .map((a) => `${a.axis.zh}（${a.axis.poles.join('/')}）两极同时偏高，${a.axis.question}这个问题在你身上尚未定论。`);

  return {
    headline: `${code.name.zh} · ${code.code}`,
    subtitle: `${code.hexagram.composed}｜${code.element.zh}${code.element.keyword}｜${code.temperMeta.zh}${code.temperMeta.en}`,
    strengths,
    growth,
    tensions: tensionAxes,
    crossSummary: `在其他体系里，你大致对应 MBTI ${cross.mbti.code}、九型 ${cross.enneagram.label}、依恋${cross.attachment.zh}、`
      + `主导脉轮${cross.chakra.dominant}、体质倾向${cross.dosha.dominantZh}。`,
    disclaimer: '以上为基于自陈问卷与符号先验的结构化描述，不构成命运预测、医疗、心理或法律建议。',
  };
}
