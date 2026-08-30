/**
 * matching.js — 关系相性算法 / Relational compatibility engine
 *
 * 四层结构：
 *   0. 准入层 Gate      —— 性别/取向/关系形态的相互意愿。身份不参与特质推断，只决定「是否愿意匹配」。
 *   1. 心理层 Psyche    —— 十二维的相似/互补/联合水平三类函数加权。
 *   2. 符号层 Symbol    —— 八字合婚（对称化，无男命女命之分）、星盘相位、MBTI、卦象、灵数。
 *   3. 合成层 Synthesis —— 总分、五项子分、关系原型、建议与风险、配对代码。
 *
 * 传统合婚规则中一切以性别决定吉凶的条目（如「男怕XX女怕XX」）均被替换为对称规则，
 * 使算法对同性、非二元与多元关系同等适用。详见 docs/04-matching-algorithm.md。
 */

import { DIM_KEYS, AXES } from './dimensions.js';
import { BRANCHES, STEMS, STEM_ELEMENT, ELEMENTS, branchRelation, generates, controls } from './bazi.js';
import { toAttachment, toLoveLanguages } from './mapping.js';
import { clamp } from './scoring.js';

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** 十二维匹配模式与权重 */
export const DIM_MATCH_CONFIG = {
  R: { mode: 'comp', w: 1.0, optimal: 0.9, note: '能量外放度' },
  D: { mode: 'comp', w: 0.8, optimal: 0.8, note: '独处需求' },
  L: { mode: 'sim', w: 1.0, note: '实证取向' },
  O: { mode: 'sim', w: 1.1, note: '象征取向（世界观核心）' },
  F: { mode: 'clash', w: 1.2, note: '掌控欲（双高易争主导权）' },
  C: { mode: 'sim', w: 0.8, note: '对不确定性的容忍' },
  P: { mode: 'volatility', w: 1.1, note: '情绪振幅（双高需稳态支撑）' },
  S: { mode: 'joint-high', w: 1.2, note: '情绪稳态（关系的地基）' },
  W: { mode: 'sim', w: 1.3, note: '亲密需求量（错配是分手主因之一）' },
  B: { mode: 'sim', w: 1.0, note: '边界观' },
  M: { mode: 'sim', w: 1.2, note: '变化速度（生活节奏）' },
  G: { mode: 'sim', w: 1.2, note: '承续观（家庭/传统/长期承诺）' },
};

/** 单维相性函数，输入两侧 z 分，输出 0–100 */
export function dimScore(mode, za, zb, cfg = {}, ctx = {}) {
  const diff = Math.abs(za - zb);
  const lo = Math.min(za, zb);
  const hi = Math.max(za, zb);
  switch (mode) {
    case 'sim':
      return clamp(100 - 22 * diff, 0, 100);
    case 'comp': {
      const opt = cfg.optimal ?? 0.9;
      return clamp(100 - 30 * Math.abs(diff - opt) - 6 * Math.max(0, diff - 2.2), 0, 100);
    }
    case 'clash':
      return clamp(100 - 16 * diff - 26 * Math.max(0, lo - 0.4), 0, 100);
    case 'volatility': {
      const stab = ctx.stability ?? 0; // 双方 S 的均值 z
      return clamp(100 - 18 * diff - 22 * Math.max(0, (za + zb) / 2 - 0.3) + 14 * stab, 0, 100);
    }
    case 'joint-high':
      return clamp(55 + 20 * ((za + zb) / 2) + 8 * (1 - Math.min(1, diff)) - 10 * Math.max(0, -hi), 0, 100);
    default:
      return 50;
  }
}

// ————————————————————————— 0. 准入层 —————————————————————————
const GENDER_BUCKET = {
  woman: 'woman', transfem: 'woman',
  man: 'man', transmasc: 'man',
  nonbinary: 'nonbinary', genderfluid: 'nonbinary', agender: 'nonbinary', intersex: 'nonbinary',
  questioning: 'nonbinary', undisclosed: 'unknown', self: 'nonbinary',
};

const REL_MATRIX = {
  mono: { mono: 1, open: 0.6, poly: 0.45, qpr: 0.8, undecided: 0.85 },
  open: { mono: 0.6, open: 1, poly: 0.9, qpr: 0.85, undecided: 0.85 },
  poly: { mono: 0.45, open: 0.9, poly: 1, qpr: 0.85, undecided: 0.85 },
  qpr: { mono: 0.8, open: 0.85, poly: 0.85, qpr: 1, undecided: 0.9 },
  undecided: { mono: 0.85, open: 0.85, poly: 0.85, qpr: 0.9, undecided: 0.9 },
};

/** 单向意愿：a 是否愿意匹配 b 的性别 */
function wants(a, b) {
  const list = a.attractedTo || [];
  if (list.includes('none')) return 0;
  if (list.length === 0 || list.includes('any')) return 1;
  const bucket = GENDER_BUCKET[b.gender] || 'unknown';
  if (bucket === 'unknown') return 0.8; // 未透露：不阻断，仅轻微折减
  return list.includes(bucket) ? 1 : 0;
}

export function gate(ctxA, ctxB) {
  const notes = [];
  const wa = wants(ctxA, ctxB);
  const wb = wants(ctxB, ctxA);
  if (wa === 0 || wb === 0) {
    notes.push('双方的性别匹配意愿不互相满足，算法不输出恋爱相性分（可改用「伙伴模式」查看合作相性）。');
  }
  const rel = REL_MATRIX[ctxA.relStyle || 'undecided']?.[ctxB.relStyle || 'undecided'] ?? 0.85;
  if (rel < 0.7) notes.push('关系形态偏好差异较大（单偶 ↔ 多元），需要在早期明确协商边界。');
  const paceOrder = { slow: 0, medium: 1, fast: 2 };
  const paceGap = Math.abs((paceOrder[ctxA.intimacyPace] ?? 1) - (paceOrder[ctxB.intimacyPace] ?? 1));
  if (paceGap === 2) notes.push('亲密推进节奏一快一慢，建议由较慢的一方定节奏。');
  const factor = Math.min(wa, wb) * rel * (1 - 0.06 * paceGap);
  return { factor: +factor.toFixed(3), mutualWilling: wa > 0 && wb > 0, relFactor: rel, notes };
}

// ————————————————————————— 2. 符号层 —————————————————————————
/** 八字对称合婚：日支与年支关系 + 日主五行关系 */
export function baziAffinity(chartA, chartB) {
  if (!chartA || !chartB) return { score: 50, items: [] };
  const items = [];
  const dayA = BRANCHES[chartA.chinese.pillars.day.branch];
  const dayB = BRANCHES[chartB.chinese.pillars.day.branch];
  const yrA = BRANCHES[chartA.chinese.pillars.year.branch];
  const yrB = BRANCHES[chartB.chinese.pillars.year.branch];

  const rDay = branchRelation(dayA, dayB);
  const rYear = branchRelation(yrA, yrB);
  items.push({ label: `日支 ${dayA}×${dayB}`, tags: rDay.tags, score: rDay.score, weight: 0.6 });
  items.push({ label: `年支 ${yrA}×${yrB}`, tags: rYear.tags, score: rYear.score, weight: 0.4 });

  // 日主五行关系（对称评估：任一方生对方皆记为「相生」）
  const ea = STEM_ELEMENT[chartA.chinese.dayMaster.index];
  const eb = STEM_ELEMENT[chartB.chinese.dayMaster.index];
  let stemScore = 0;
  let stemTag = '';
  if (ea === eb) { stemScore = 1.2; stemTag = '比和（同气相求，易懂但少张力）'; }
  else if (generates(ea, eb) || generates(eb, ea)) { stemScore = 2.5; stemTag = '相生（一方滋养另一方）'; }
  else if (controls(ea, eb) || controls(eb, ea)) { stemScore = -1.8; stemTag = '相克（需要明确的权力协商）'; }
  items.push({
    label: `日主 ${chartA.chinese.dayMaster.stem}(${ELEMENTS[ea]}) × ${chartB.chinese.dayMaster.stem}(${ELEMENTS[eb]})`,
    tags: [stemTag], score: stemScore, weight: 0.8,
  });

  // 喜用神互补：一方的喜用五行恰是另一方的旺气
  const favA = chartA.chinese.strength.favorable;
  const favB = chartB.chinese.strength.favorable;
  const domA = chartA.chinese.elements.dominant;
  const domB = chartB.chinese.elements.dominant;
  let comp = 0;
  const compTags = [];
  if (favA.includes(domB)) { comp += 1.5; compTags.push(`对方的${ELEMENTS[domB]}旺气补你所喜`); }
  if (favB.includes(domA)) { comp += 1.5; compTags.push(`你的${ELEMENTS[domA]}旺气补对方所喜`); }
  items.push({ label: '喜用互补', tags: compTags.length ? compTags : ['无明显互补'], score: comp, weight: 0.7 });

  const wsum = items.reduce((s, i) => s + i.weight, 0);
  const raw = items.reduce((s, i) => s + i.score * i.weight, 0) / wsum; // 约 [-3, 3]
  return { score: clamp(Math.round(50 + raw * 13), 0, 100), items, raw: +raw.toFixed(2) };
}

/** 星盘相性：太阳/月亮相位与元素关系 */
export function astroAffinity(chartA, chartB) {
  if (!chartA || !chartB) return { score: 50, items: [] };
  const items = [];
  const aspect = (la, lb, label) => {
    let d = Math.abs(la - lb) % 360;
    if (d > 180) d = 360 - d;
    const table = [
      [0, 12, '合相 Conjunction', 12],
      [60, 6, '六分相 Sextile', 10],
      [90, 7, '四分相 Square', -6],
      [120, 8, '三分相 Trine', 14],
      [180, 9, '对分相 Opposition', 4],
    ];
    for (const [ang, orb, name, sc] of table) {
      if (Math.abs(d - ang) <= orb) {
        items.push({ label: `${label}${name}`, score: sc, weight: 1, detail: `相距 ${d.toFixed(1)}°` });
        return;
      }
    }
    items.push({ label: `${label}无主要相位`, score: 0, weight: 0.6, detail: `相距 ${d.toFixed(1)}°` });
  };
  aspect(chartA.western.sun.lon, chartB.western.sun.lon, '日–日 ');
  aspect(chartA.western.moon.lon, chartB.western.moon.lon, '月–月 ');
  aspect(chartA.western.sun.lon, chartB.western.moon.lon, '日A–月B ');
  aspect(chartB.western.sun.lon, chartA.western.moon.lon, '日B–月A ');

  const ea = chartA.western.sun.sign.element;
  const eb = chartB.western.sun.sign.element;
  const friendly = { fire: 'air', air: 'fire', earth: 'water', water: 'earth' };
  let es = 0;
  let et = '';
  if (ea === eb) { es = 9; et = '同元素：默认理解成本低'; }
  else if (friendly[ea] === eb) { es = 11; et = '互助元素：节奏互相点燃'; }
  else { es = -4; et = '张力元素：需要翻译对方的语言'; }
  items.push({ label: `元素 ${ea}×${eb}`, score: es, weight: 1.2, detail: et });

  const wsum = items.reduce((s, i) => s + i.weight, 0);
  const raw = items.reduce((s, i) => s + i.score * i.weight, 0) / wsum;
  return { score: clamp(Math.round(58 + raw * 2.6), 0, 100), items, raw: +raw.toFixed(2) };
}

/** MBTI 轴向相性（同 N/S 与同 J/P 减少摩擦，E/I 与 T/F 适度互补） */
export function mbtiAffinity(a, b) {
  const A = a.code.split('');
  const B = b.code.split('');
  let s = 50;
  const items = [];
  const add = (label, val) => { s += val; items.push({ label, score: val }); };
  add(`E/I ${A[0]}×${B[0]}`, A[0] === B[0] ? 4 : 8);
  add(`N/S ${A[1]}×${B[1]}`, A[1] === B[1] ? 14 : -8);
  add(`T/F ${A[2]}×${B[2]}`, A[2] === B[2] ? 6 : 6);
  add(`J/P ${A[3]}×${B[3]}`, A[3] === B[3] ? 10 : -2);
  return { score: clamp(Math.round(s), 0, 100), items, codes: [a.code, b.code] };
}

/** 卦象关系：同卦 / 综卦（倒转）/ 错卦（阴阳全反）/ 无特殊关系 */
export function hexagramAffinity(codeA, codeB) {
  const a = codeA.hexagram;
  const b = codeB.hexagram;
  if (a.number === b.number) {
    return { score: 74, relation: '同卦', note: `同为${a.name}卦：镜像式的理解，也共享同一个盲区。` };
  }
  if (codeA.changing.reverse.number === b.number) {
    return { score: 88, relation: '综卦（倒转）', note: `${a.name} ↔ ${b.name} 互为综卦：同一件事的两端，天然互补视角。` };
  }
  if (codeA.changing.inverse.number === b.number) {
    return { score: 82, relation: '错卦（阴阳全反）', note: `${a.name} ↔ ${b.name} 互为错卦：六爻全异，吸引力强、磨合成本也高。` };
  }
  const shared = a.lines.filter((x, i) => x === b.lines[i]).length;
  return {
    score: clamp(40 + shared * 8, 0, 100),
    relation: `共 ${shared}/6 爻同`,
    note: `${a.name} × ${b.name}：六爻中有 ${shared} 爻同向。`,
  };
}

/** 生命灵数相性 */
const LP_AFFINITY = {
  1: [1, 5, 7], 2: [2, 4, 6, 8], 3: [3, 5, 6, 9], 4: [2, 4, 8], 5: [1, 3, 5, 7],
  6: [2, 3, 6, 9], 7: [1, 5, 7], 8: [2, 4, 8], 9: [3, 6, 9], 11: [2, 6, 11], 22: [4, 8, 22], 33: [6, 9, 33],
};
export function lifePathAffinity(a, b) {
  const list = LP_AFFINITY[a] || [];
  const hit = list.includes(b) || (LP_AFFINITY[b] || []).includes(a);
  return { score: hit ? 78 : 55, note: `生命灵数 ${a} × ${b}${hit ? '：同频组合' : '：需要主动翻译彼此的动机'}` };
}

// ————————————————————————— 3. 合成层 —————————————————————————
/**
 * @param {object} pA 完整档案 A（buildProfile 输出）
 * @param {object} pB 完整档案 B
 * @param {object} opts {mode: 'romantic'|'partner'}
 */
export function matchProfiles(pA, pB, opts = {}) {
  const mode = opts.mode || 'romantic';
  const g = gate(pA.context, pB.context);

  // —— 心理层 ——
  const zA = Object.fromEntries(DIM_KEYS.map((k) => [k, pA.dims[k].z]));
  const zB = Object.fromEntries(DIM_KEYS.map((k) => [k, pB.dims[k].z]));
  const stability = (zA.S + zB.S) / 2;
  const dimRows = DIM_KEYS.map((k) => {
    const cfg = DIM_MATCH_CONFIG[k];
    const s = dimScore(cfg.mode, zA[k], zB[k], cfg, { stability });
    return {
      key: k,
      name: pA.dims[k].meta.name,
      en: pA.dims[k].meta.en,
      mode: cfg.mode,
      weight: cfg.w,
      a: pA.dims[k].score,
      b: pB.dims[k].score,
      score: Math.round(s),
      note: cfg.note,
    };
  });
  const wsum = dimRows.reduce((s, r) => s + r.weight, 0);
  const psyche = dimRows.reduce((s, r) => s + r.score * r.weight, 0) / wsum;

  // —— 符号层 ——
  const bazi = baziAffinity(pA.chart, pB.chart);
  const astro = astroAffinity(pA.chart, pB.chart);
  const mbti = mbtiAffinity(pA.cross.mbti, pB.cross.mbti);
  const hexa = hexagramAffinity(pA.code, pB.code);
  const lp = pA.chart && pB.chart
    ? lifePathAffinity(pA.chart.numerology.lifePath, pB.chart.numerology.lifePath)
    : { score: 55, note: '缺少出生信息，灵数项按中性处理' };
  const symbolParts = [
    { key: 'bazi', label: '八字合婚（对称化）', ...bazi, weight: 1.2 },
    { key: 'astro', label: '星盘相位', ...astro, weight: 1.0 },
    { key: 'mbti', label: 'MBTI 轴向', ...mbti, weight: 0.8 },
    { key: 'hexagram', label: '卦象关系', ...hexa, weight: 0.9 },
    { key: 'lifePath', label: '生命灵数', ...lp, weight: 0.5 },
  ];
  const swsum = symbolParts.reduce((s, p) => s + p.weight, 0);
  const symbol = symbolParts.reduce((s, p) => s + p.score * p.weight, 0) / swsum;

  // —— 权重：符号层权重由双方 λb 的均值决定，λb=0 ⇒ 纯心理测量匹配 ——
  const lambda = ((pA.lambdaB ?? 0.15) + (pB.lambdaB ?? 0.15)) / 2;
  const wSym = clamp(lambda * 2, 0, 0.5);
  const wPsy = 1 - wSym;
  const base = wPsy * psyche + wSym * symbol;
  const gateFactor = mode === 'partner' ? Math.max(g.factor, 0.9) : g.factor;
  const total = clamp(Math.round(base * (0.55 + 0.45 * gateFactor)), 0, 100);

  // —— 五项子分 ——
  const pick = (keys) => Math.round(mean(dimRows.filter((r) => keys.includes(r.key)).map((r) => r.score)));
  const sub = {
    resonance: pick(['O', 'L', 'W', 'G']),
    complement: pick(['R', 'D', 'F', 'C']),
    stability: Math.round(0.6 * pick(['S', 'P']) + 0.4 * (50 + 15 * stability)),
    growth: Math.round(0.5 * pick(['M', 'O']) + 0.5 * clamp(50 + 26 * Math.abs(zA.M - zB.M) * (zA.M + zB.M > 0 ? 1 : -1), 0, 100)),
    friction: Math.round(clamp(100 - mean(dimRows.filter((r) => ['F', 'B', 'P'].includes(r.key)).map((r) => r.score)), 0, 100)),
  };

  const attA = toAttachment(pA.zVec);
  const attB = toAttachment(pB.zVec);
  const llA = toLoveLanguages(pA.zVec).slice(0, 2).map((x) => x.name);
  const llB = toLoveLanguages(pB.zVec).slice(0, 2).map((x) => x.name);

  const pairCode = buildPairCode(pA.code, pB.code, total);
  const archetype = relationArchetype(dimRows, pA.code, pB.code, sub);

  return {
    version: 'OML-MATCH-1.0',
    mode,
    total,
    grade: gradeOf(total),
    weights: { psyche: +wPsy.toFixed(2), symbol: +wSym.toFixed(2), lambdaB: +lambda.toFixed(2) },
    layers: { psyche: Math.round(psyche), symbol: Math.round(symbol), gate: g },
    dimRows,
    symbolParts,
    sub,
    pairCode,
    archetype,
    attachment: { a: attA, b: attB, note: attachmentNote(attA, attB) },
    loveLanguages: { a: llA, b: llB, overlap: llA.filter((x) => llB.includes(x)) },
    advice: advice(dimRows, sub, g, attA, attB),
    risks: risks(dimRows, sub, g),
    disclaimer: '相性分是沟通起点而非判决书；任何一段关系的结果由双方的具体行为决定。',
  };
}

export function gradeOf(total) {
  if (total >= 88) return 'S';
  if (total >= 78) return 'A';
  if (total >= 66) return 'B';
  if (total >= 52) return 'C';
  return 'D';
}

/** 配对代码：同极大写，异极小写（取 A 方字母），后缀为等级 */
export function buildPairCode(codeA, codeB, total) {
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    const a = codeA.core[i];
    const b = codeB.core[i];
    s += a === b ? a : a.toLowerCase();
  }
  return `${s}-${gradeOf(total)}`;
}

function relationArchetype(dimRows, codeA, codeB, sub) {
  const same = [...codeA.core].filter((c, i) => c === codeB.core[i]).length;
  if (same >= 5) return { zh: '同源镜像', en: 'Mirror Pair', note: '几乎共享同一套操作系统：理解成本极低，但盲区重叠，需要外部视角。' };
  if (same <= 1) return { zh: '两极互补', en: 'Polar Complement', note: '几乎处处相反：吸引力强、信息量大，日常翻译成本高。' };
  if (sub.complement >= 72 && sub.resonance >= 68) return { zh: '共振互补', en: 'Resonant Complement', note: '价值观同频、能量互补——长期关系最稳的结构之一。' };
  if (sub.resonance >= 75) return { zh: '同频共同体', en: 'Kindred Commune', note: '世界观高度一致，容易共同生活，注意避免共同停滞。' };
  if (sub.friction >= 55) return { zh: '张力锻造', en: 'Forged in Friction', note: '摩擦是这段关系的主要能量来源：处理得当是成长，处理不当是消耗。' };
  return { zh: '缓冲互织', en: 'Woven Buffer', note: '差异中等、缓冲充足，靠具体的相处习惯决定走向。' };
}

function attachmentNote(a, b) {
  const key = [a.key, b.key].sort().join('+');
  const table = {
    'secure+secure': '双安全型：冲突修复速度快，是最稳的组合。',
    'anxious+secure': '安全型可以稳定焦虑型的警报系统；关键在于安全型不要把安抚当成义务。',
    'dismissive+secure': '安全型能容忍回避型的撤离；回避型需要练习「说出撤离的原因」。',
    'fearful+secure': '安全型提供可预测性，恐惧回避型需要时间验证这份可预测性是真的。',
    'anxious+dismissive': '典型的「追–逃」循环：越追越逃，越逃越追。需要显式约定暂停与回归的规则。',
    'anxious+anxious': '双高警报：情绪共振强烈，容易互相放大，需要外部锚（作息、朋友、咨询）。',
    'dismissive+dismissive': '双回避：日常冲突少，但亲密度容易停在浅层，需要人为制造深谈。',
    'fearful+anxious': '强烈的靠近与推开交替，建议把「我现在需要距离」变成可以直接说出口的常规句式。',
    'dismissive+fearful': '两侧都会撤离，关系可能安静地淡掉；需要有人主动定期发起联结。',
    'fearful+fearful': '互相都想靠近又怕受伤，进展慢但一旦建立信任会非常深。',
  };
  return table[key] || '两种依恋风格的组合，关键在于把「需要距离」和「需要靠近」都说出口。';
}

function advice(dimRows, sub, g, attA, attB) {
  const out = [];
  const worst = [...dimRows].sort((a, b) => a.score - b.score)[0];
  const best = [...dimRows].sort((a, b) => b.score - a.score)[0];
  out.push(`把「${best.name}」当作关系的默认语言：这是你们最不费力的共同地带。`);
  out.push(`「${worst.name}」是最需要显式规则的地方（${worst.note}）：与其临时磨合，不如提前写下你们的约定。`);
  if (sub.stability < 55) out.push('稳态子分偏低：优先建立可预测的日常节律（固定的沟通时间、冲突暂停手势），而不是靠情绪自愈。');
  if (sub.growth > 75) out.push('成长子分很高：你们适合一起启动新项目、搬去新城市、学新东西——把变化变成共同任务。');
  if (attA.key !== 'secure' || attB.key !== 'secure') out.push('至少一方不是安全型依恋：约定一个「暂停 20 分钟后必须回来」的规则，能挡掉大部分升级性冲突。');
  for (const n of g.notes) out.push(n);
  return out;
}

function risks(dimRows, sub, g) {
  const out = [];
  for (const r of dimRows) {
    if (r.score < 45) out.push(`${r.name}（${r.en}）相性 ${r.score}：${r.note}——这是主要的结构性摩擦点。`);
  }
  if (sub.friction >= 60) out.push('张力指数偏高：主导权、边界与情绪强度三者叠加，建议明确分工而不是轮流让步。');
  if (!g.mutualWilling) out.push('准入层未互相满足：当前分数仅供参考，不代表恋爱可行性。');
  if (out.length === 0) out.push('未发现结构性高风险项；常规风险仍来自沟通频率与外部压力。');
  return out;
}

/** 轴向对照：给 UI 用的 6 轴并排 */
export function axisComparison(pA, pB) {
  return AXES.map((ax, i) => ({
    axis: ax,
    a: pA.code.core[i],
    b: pB.code.core[i],
    same: pA.code.core[i] === pB.code.core[i],
    aScores: ax.poles.map((p) => pA.dims[p].score),
    bScores: ax.poles.map((p) => pB.dims[p].score),
  }));
}

export { STEMS };
