/**
 * mapping.js — 统一映射表 / The Unified Correspondence Table
 *
 * 正向映射（符号 → 十二维）：各体系的离散符号被翻译成十二维上的 z 分偏移向量，
 *   作为评分层的「象征先验」B_d，权重由 λb 控制（用户可调 0–0.40，可归零）。
 * 反向映射（十二维 → 符号）：把 OML 结果翻译回 MBTI / 大五 / 九型 / 依恋 /
 *   脉轮 / 阿育吠陀 / 中医体质 / 塔罗 / 卢恩 / 人类图 等，用于跨体系对话。
 *
 * 所有向量单位为 z（标准差）。数值来自体系语义的结构化对齐，属于「设计参数」，
 * 不是实证回归系数；替换为真实样本拟合值的接口见 docs/02-oml-spec.md §7。
 */

import { DIM_KEYS } from './dimensions.js';

/** 稀疏字面量 -> 12 维稠密向量 */
export function v(obj = {}) {
  return DIM_KEYS.map((k) => obj[k] ?? 0);
}
export const addVec = (a, b, s = 1) => a.map((x, i) => x + b[i] * s);
export const scaleVec = (a, s) => a.map((x) => x * s);
export const zeroVec = () => DIM_KEYS.map(() => 0);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a)) || 1e-9;
export const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));

// ———————————————————————————— 正向：西洋占星 ————————————————————————————
/** 12 星座 → 十二维（太阳位；月亮/上升复用同表并另行缩放） */
export const SIGN_VECTORS = [
  v({ R: 0.35, F: 0.45, M: 0.30, P: 0.15, C: -0.25, B: 0.25, G: -0.20 }), // 白羊
  v({ G: 0.45, S: 0.35, D: 0.15, L: 0.20, M: -0.40, C: 0.10, W: 0.15 }), // 金牛
  v({ R: 0.35, M: 0.40, L: 0.15, O: 0.20, G: -0.30, S: -0.10, B: 0.10 }), // 双子
  v({ W: 0.45, P: 0.40, G: 0.30, D: 0.20, B: -0.25 }), // 巨蟹
  v({ R: 0.50, F: 0.35, S: 0.15, G: 0.10, D: -0.30, M: 0.05 }), // 狮子
  v({ L: 0.50, B: 0.15, G: 0.25, S: 0.05, O: -0.30, C: -0.25 }), // 处女
  v({ W: 0.40, R: 0.25, C: 0.20, B: -0.30, P: 0.10 }), // 天秤
  v({ D: 0.45, P: 0.40, F: 0.30, B: 0.30, O: 0.25, R: -0.25, M: 0.15 }), // 天蝎
  v({ M: 0.45, C: 0.35, R: 0.30, O: 0.20, G: -0.35, B: 0.20 }), // 射手
  v({ F: 0.40, G: 0.45, S: 0.30, L: 0.30, C: -0.35, P: -0.20 }), // 摩羯
  v({ M: 0.40, B: 0.40, O: 0.25, L: 0.20, W: -0.25, P: -0.20, G: -0.25 }), // 水瓶
  v({ O: 0.50, P: 0.45, C: 0.40, W: 0.25, L: -0.35, B: -0.30 }), // 双鱼
];

/** 四元素亲和（供反向映射用） */
export const ELEMENT_AFFINITY_VECTORS = {
  fire: v({ R: 0.6, F: 0.5, M: 0.4, C: -0.2 }),
  earth: v({ G: 0.6, S: 0.5, L: 0.4, M: -0.3 }),
  air: v({ L: 0.4, M: 0.5, R: 0.35, B: 0.3, P: -0.25 }),
  water: v({ P: 0.6, O: 0.5, D: 0.4, W: 0.35 }),
};

/** 月相 8 态 */
export const LUNAR_PHASE_VECTORS = [
  v({ D: 0.30, M: 0.25 }), v({ M: 0.30, R: 0.15 }),
  v({ F: 0.35, B: 0.20 }), v({ L: 0.25, F: 0.20 }),
  v({ R: 0.35, P: 0.35 }), v({ W: 0.30, O: 0.20 }),
  v({ B: 0.30, L: 0.20 }), v({ D: 0.35, O: 0.30, C: 0.25 }),
];

// ———————————————————————————— 正向：中式命理 ————————————————————————————
/** 五行 → 十二维（以 ratio − 0.2 的偏离量线性加权） */
export const ELEMENT_VECTORS = [
  v({ M: 0.90, F: 0.50, R: 0.35, G: -0.20 }), // 木
  v({ R: 0.90, P: 0.60, M: 0.30, D: -0.40, S: -0.20 }), // 火
  v({ S: 0.80, G: 0.80, W: 0.40, M: -0.50 }), // 土
  v({ L: 0.80, B: 0.70, F: 0.40, P: -0.30, C: -0.30 }), // 金
  v({ D: 0.90, O: 0.70, C: 0.50, R: -0.30 }), // 水
];

/** 日主十天干 */
export const DAY_MASTER_VECTORS = {
  甲: v({ F: 0.30, G: 0.25, M: 0.15 }),
  乙: v({ C: 0.30, W: 0.25, M: 0.20, B: -0.15 }),
  丙: v({ R: 0.50, F: 0.25, P: 0.15, D: -0.25 }),
  丁: v({ O: 0.35, P: 0.30, D: 0.20 }),
  戊: v({ S: 0.45, G: 0.35, B: 0.20, M: -0.25 }),
  己: v({ W: 0.35, S: 0.25, G: 0.25, B: -0.20 }),
  庚: v({ F: 0.40, B: 0.35, L: 0.20, P: -0.20 }),
  辛: v({ L: 0.30, B: 0.25, D: 0.20, P: 0.15 }),
  壬: v({ M: 0.35, C: 0.30, R: 0.20, O: 0.20 }),
  癸: v({ O: 0.40, D: 0.35, P: 0.30, R: -0.20 }),
};

/** 十神 */
export const TEN_GOD_VECTORS = {
  比肩: v({ B: 0.30, F: 0.20 }),
  劫财: v({ F: 0.35, M: 0.20, B: 0.20 }),
  食神: v({ C: 0.30, P: 0.25, W: 0.20 }),
  伤官: v({ M: 0.40, R: 0.30, B: 0.25, G: -0.25 }),
  偏财: v({ R: 0.30, M: 0.30, C: 0.20 }),
  正财: v({ L: 0.35, G: 0.30, S: 0.20 }),
  七杀: v({ F: 0.45, B: 0.30, P: 0.20, S: -0.15 }),
  正官: v({ L: 0.35, G: 0.35, S: 0.25, M: -0.20 }),
  偏印: v({ O: 0.40, D: 0.35, B: 0.20 }),
  正印: v({ W: 0.30, S: 0.30, G: 0.30, D: 0.20 }),
};

/** 生肖（文化符号层，低权重） */
export const ZODIAC_VECTORS = [
  v({ L: 0.20, M: 0.25, R: 0.15 }), // 鼠
  v({ G: 0.40, S: 0.35, M: -0.20 }), // 牛
  v({ F: 0.40, M: 0.25, R: 0.20 }), // 虎
  v({ W: 0.30, P: 0.25, B: -0.15 }), // 兔
  v({ R: 0.40, F: 0.30, M: 0.20 }), // 龙
  v({ D: 0.35, O: 0.30, B: 0.20 }), // 蛇
  v({ M: 0.35, R: 0.30, C: 0.25, G: -0.20 }), // 马
  v({ P: 0.30, W: 0.30, O: 0.20 }), // 羊
  v({ M: 0.35, L: 0.20, R: 0.25 }), // 猴
  v({ L: 0.40, B: 0.25, G: 0.20 }), // 鸡
  v({ G: 0.35, W: 0.30, S: 0.25 }), // 狗
  v({ C: 0.35, W: 0.25, P: 0.20 }), // 猪
];

// ———————————————————————————— 正向：数字与历法 ————————————————————————————
export const LIFE_PATH_VECTORS = {
  1: v({ F: 0.50, B: 0.35, R: 0.20 }),
  2: v({ W: 0.45, P: 0.30, B: -0.25 }),
  3: v({ R: 0.50, M: 0.25, P: 0.20 }),
  4: v({ G: 0.50, L: 0.40, S: 0.30, M: -0.30 }),
  5: v({ M: 0.55, C: 0.35, G: -0.35 }),
  6: v({ W: 0.50, G: 0.35, P: 0.25 }),
  7: v({ D: 0.55, O: 0.40, L: 0.20, R: -0.30 }),
  8: v({ F: 0.50, L: 0.30, S: 0.25 }),
  9: v({ O: 0.40, W: 0.35, P: 0.30 }),
  11: v({ O: 0.55, P: 0.40, D: 0.30 }),
  22: v({ F: 0.40, L: 0.40, G: 0.40, S: 0.30 }),
  33: v({ W: 0.55, P: 0.40, O: 0.30 }),
};

/** 玛雅卓尔金 20 日号（低权重文化层） */
export const TZOLKIN_VECTORS = [
  v({ W: 0.3, G: 0.2 }), v({ R: 0.3, M: 0.2 }), v({ D: 0.35, O: 0.25 }), v({ G: 0.3, L: 0.2 }),
  v({ M: 0.3, O: 0.25 }), v({ D: 0.3, S: 0.2 }), v({ C: 0.3, W: 0.2 }), v({ R: 0.3, P: 0.25 }),
  v({ P: 0.35, C: 0.25 }), v({ W: 0.35, G: 0.2 }), v({ M: 0.35, R: 0.2 }), v({ L: 0.3, G: 0.25 }),
  v({ M: 0.3, F: 0.2 }), v({ D: 0.3, O: 0.3 }), v({ O: 0.35, R: 0.2 }), v({ L: 0.3, B: 0.25 }),
  v({ L: 0.3, S: 0.25 }), v({ B: 0.35, L: 0.2 }), v({ P: 0.35, M: 0.25 }), v({ O: 0.3, R: 0.3 }),
];

// ———————————————————————————— 正向：现代人格量表自陈 ————————————————————————————
export const MBTI_AXIS_VECTORS = {
  E: v({ R: 0.80, D: -0.60 }), I: v({ R: -0.80, D: 0.60 }),
  S: v({ L: 0.70, O: -0.50, G: 0.30 }), N: v({ O: 0.80, M: 0.40, L: -0.40 }),
  T: v({ L: 0.50, B: 0.40, P: -0.40 }), F: v({ W: 0.60, P: 0.50, B: -0.30 }),
  J: v({ G: 0.50, L: 0.40, C: -0.50 }), P: v({ C: 0.60, M: 0.50, G: -0.40 }),
};

export const ENNEAGRAM_VECTORS = {
  1: v({ L: 0.50, B: 0.35, G: 0.40, S: 0.10 }),
  2: v({ W: 0.60, P: 0.40, B: -0.40 }),
  3: v({ F: 0.55, R: 0.45, M: 0.20 }),
  4: v({ P: 0.60, O: 0.45, D: 0.40, S: -0.30 }),
  5: v({ D: 0.70, L: 0.40, R: -0.50, B: 0.30 }),
  6: v({ G: 0.40, W: 0.30, L: 0.30, S: -0.25 }),
  7: v({ M: 0.60, R: 0.45, C: 0.40, G: -0.35 }),
  8: v({ F: 0.70, B: 0.55, S: 0.30 }),
  9: v({ C: 0.55, S: 0.35, W: 0.30, F: -0.40 }),
};

/** 血型：东亚流行文化符号，权重设计上限极低（0.10），可关闭 */
export const BLOOD_TYPE_VECTORS = {
  A: v({ L: 0.30, G: 0.30, S: -0.10 }),
  B: v({ M: 0.35, C: 0.30, B: 0.25 }),
  O: v({ F: 0.35, R: 0.30, S: 0.25 }),
  AB: v({ O: 0.30, D: 0.25, L: 0.20 }),
};

/** 各来源的默认权重 w_s（进入 B_d 前的相对权重） */
export const SOURCE_WEIGHTS = {
  sunSign: 1.00,
  moonSign: 0.70,
  ascSign: 0.50,
  fiveElements: 1.00,
  dayMaster: 0.80,
  strength: 0.60,
  tenGod: 0.60,
  chineseZodiac: 0.35,
  lunarPhase: 0.30,
  lifePath: 0.40,
  tzolkin: 0.25,
  mbtiSelf: 0.90,
  enneagramSelf: 0.70,
  bloodType: 0.10,
};

// ———————————————————————————— 反向：十二维 → 各体系 ————————————————————————————

/** z 分（12 维，均值 0 / 标准差 1）→ MBTI 四轴 */
export function toMBTI(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const ei = 0.7 * g.R - 0.5 * g.D;
  const sn = 0.65 * g.O - 0.55 * g.L + 0.2 * g.M;
  const tf = 0.55 * g.W + 0.45 * g.P - 0.4 * g.L - 0.35 * g.B;
  const jp = 0.55 * g.C + 0.4 * g.M - 0.45 * g.G - 0.3 * g.L;
  const code = (ei >= 0 ? 'E' : 'I') + (sn >= 0 ? 'N' : 'S') + (tf >= 0 ? 'F' : 'T') + (jp >= 0 ? 'P' : 'J');
  const pct = (x) => Math.round(Math.min(99, Math.max(1, 50 + 22 * x)));
  return {
    code,
    axes: { EI: pct(ei), NS: pct(sn), FT: pct(tf), PJ: pct(jp) },
    raw: { ei, sn, tf, jp },
    confidence: Math.min(1, (Math.abs(ei) + Math.abs(sn) + Math.abs(tf) + Math.abs(jp)) / 4),
  };
}

/** → 大五 / OCEAN（0–100） */
export function toBigFive(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const s = (x) => Math.round(Math.min(99, Math.max(1, 50 + 15 * x)));
  return {
    openness: s(0.5 * g.O + 0.45 * g.M - 0.25 * g.G),
    conscientiousness: s(0.45 * g.L + 0.4 * g.G + 0.25 * g.F - 0.35 * g.C),
    extraversion: s(0.7 * g.R - 0.35 * g.D + 0.2 * g.W),
    agreeableness: s(0.5 * g.W + 0.3 * g.P - 0.3 * g.F - 0.25 * g.B),
    neuroticism: s(0.55 * g.P - 0.6 * g.S),
  };
}

/** → 九型人格（取余弦相似度最高者，附前三） */
export function toEnneagram(z) {
  const ranked = Object.entries(ENNEAGRAM_VECTORS)
    .map(([n, vec]) => ({ type: Number(n), score: cosine(z, vec) }))
    .sort((a, b) => b.score - a.score);
  const wing = [ranked[0].type - 1 || 9, (ranked[0].type % 9) + 1];
  const wingPick = ranked.find((r) => wing.includes(r.type));
  return {
    type: ranked[0].type,
    wing: wingPick ? wingPick.type : null,
    label: wingPick ? `${ranked[0].type}w${wingPick.type}` : String(ranked[0].type),
    top3: ranked.slice(0, 3).map((r) => ({ type: r.type, score: +r.score.toFixed(3) })),
  };
}

/** → 成人依恋类型（Weave/Bastion × Stone/Pulse 四象限） */
export function toAttachment(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const closeness = 0.6 * g.W - 0.4 * g.B; // 亲近取向
  const security = 0.6 * g.S - 0.5 * g.P; // 情绪安全
  let type;
  if (closeness >= 0 && security >= 0) type = { key: 'secure', zh: '安全型', en: 'Secure' };
  else if (closeness >= 0 && security < 0) type = { key: 'anxious', zh: '焦虑-投入型', en: 'Anxious-preoccupied' };
  else if (closeness < 0 && security >= 0) type = { key: 'dismissive', zh: '疏离-回避型', en: 'Dismissive-avoidant' };
  else type = { key: 'fearful', zh: '恐惧-回避型', en: 'Fearful-avoidant' };
  return { ...type, closeness: +closeness.toFixed(2), security: +security.toFixed(2) };
}

/** → 脉轮主导 */
export const CHAKRAS = ['海底轮', '骶轮', '太阳轮', '心轮', '喉轮', '眉心轮', '顶轮'];
export function toChakra(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const scores = {
    海底轮: 0.6 * g.S + 0.5 * g.G,
    骶轮: 0.6 * g.C + 0.3 * g.P,
    太阳轮: 0.6 * g.F + 0.4 * g.R,
    心轮: 0.6 * g.W + 0.4 * g.P,
    喉轮: 0.5 * g.L + 0.45 * g.B,
    眉心轮: 0.6 * g.D + 0.3 * g.O,
    顶轮: 0.6 * g.O + 0.4 * g.M,
  };
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { dominant: sorted[0][0], weakest: sorted[sorted.length - 1][0], scores };
}

/** → 阿育吠陀三体质 */
export function toDosha(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const vata = 0.4 * g.M + 0.35 * g.O + 0.3 * g.D - 0.3 * g.S;
  const pitta = 0.45 * g.F + 0.35 * g.R + 0.25 * g.P;
  const kapha = 0.45 * g.G + 0.35 * g.S + 0.3 * g.W - 0.25 * g.M;
  const arr = [['vata', '风型', vata], ['pitta', '火型', pitta], ['kapha', '土型', kapha]]
    .sort((a, b) => b[2] - a[2]);
  return { dominant: arr[0][0], dominantZh: arr[0][1], scores: { vata, pitta, kapha } };
}

/** → 中医体质倾向（简化九分类的子集） */
export function toTCMType(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const cands = [
    ['平和质', 0.6 * g.S + 0.3 * g.G + 0.2 * g.C],
    ['气虚质', -0.5 * g.R - 0.4 * g.F + 0.3 * g.D],
    ['阳盛/湿热质', 0.5 * g.F + 0.4 * g.R + 0.3 * g.P],
    ['气郁质', 0.5 * g.D + 0.45 * g.P - 0.4 * g.R],
    ['阴虚质', 0.45 * g.P + 0.35 * g.M - 0.4 * g.S],
    ['痰湿质', 0.5 * g.G + 0.35 * g.W - 0.35 * g.M],
    ['特禀/敏感质', 0.5 * g.O + 0.4 * g.P - 0.3 * g.L],
  ].sort((a, b) => b[1] - a[1]);
  return { dominant: cands[0][0], ranked: cands.map(([k, s]) => ({ type: k, score: +s.toFixed(2) })) };
}

/** → 塔罗大阿卡纳原型（每维一张主牌，取最高维；含元素修正牌） */
export const DIM_TAROT = {
  R: ['XIX 太阳', 'The Sun'], D: ['IX 隐者', 'The Hermit'],
  L: ['V 教皇', 'The Hierophant'], O: ['II 女祭司', 'The High Priestess'],
  F: ['VII 战车', 'The Chariot'], C: ['XII 倒吊人', 'The Hanged Man'],
  P: ['XVIII 月亮', 'The Moon'], S: ['XI 力量', 'Strength'],
  W: ['VI 恋人', 'The Lovers'], B: ['IV 皇帝', 'The Emperor'],
  M: ['XIII 死神（转化）', 'Death / Transformation'], G: ['XXI 世界', 'The World'],
};

/** → 长枝卢恩（Elder Futhark）对应 */
export const DIM_RUNE = {
  R: ['ᛋ Sowilo 日', 'Sowilo'], D: ['ᛚ Laguz 水', 'Laguz'],
  L: ['ᚨ Ansuz 言', 'Ansuz'], O: ['ᛈ Perthro 签', 'Perthro'],
  F: ['ᛏ Tiwaz 战', 'Tiwaz'], C: ['ᛃ Jera 年轮', 'Jera'],
  P: ['ᛇ Eihwaz 紫杉', 'Eihwaz'], S: ['ᚢ Uruz 原牛', 'Uruz'],
  W: ['ᚷ Gebo 赠', 'Gebo'], B: ['ᛉ Algiz 护', 'Algiz'],
  M: ['ᛞ Dagaz 破晓', 'Dagaz'], G: ['ᛟ Othala 祖业', 'Othala'],
};

/** → 人类图近似类型（声明为「近似」，非官方算法） */
export function toHumanDesignApprox(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const initiate = 0.6 * g.F + 0.3 * g.B - 0.3 * g.C;
  const respond = 0.5 * g.C + 0.3 * g.S + 0.2 * g.W;
  const sense = 0.5 * g.O + 0.4 * g.P - 0.3 * g.F;
  if (initiate > 0.35 && initiate > respond) return { type: '显示者 Manifestor（近似）', strategy: '先告知，再启动' };
  if (sense > 0.45 && respond < 0) return { type: '反映者/投射者 Reflector–Projector（近似）', strategy: '等待邀请与月周期' };
  if (respond >= 0) return { type: '生产者 Generator（近似）', strategy: '等待回应，跟随满足感' };
  return { type: '投射者 Projector（近似）', strategy: '等待认可与邀请' };
}

/** → 爱之语（Five Love Languages）排序 */
export function toLoveLanguages(z) {
  const g = Object.fromEntries(DIM_KEYS.map((k, i) => [k, z[i]]));
  const scores = [
    ['肯定的言语 Words of Affirmation', 0.5 * g.R + 0.35 * g.P],
    ['精心的时刻 Quality Time', 0.5 * g.W + 0.35 * g.D],
    ['服务的行动 Acts of Service', 0.5 * g.L + 0.35 * g.G],
    ['身体的接触 Physical Touch', 0.5 * g.P + 0.3 * g.C],
    ['礼物 Receiving Gifts', 0.35 * g.O + 0.3 * g.G + 0.2 * g.M],
  ].sort((a, b) => b[1] - a[1]);
  return scores.map(([name, s], i) => ({ rank: i + 1, name, score: +s.toFixed(2) }));
}

/** → 星座元素亲和（四元素百分比） */
export function toElementAffinity(z) {
  const out = {};
  let sum = 0;
  for (const [k, vec] of Object.entries(ELEMENT_AFFINITY_VECTORS)) {
    const s = Math.exp(dot(z, vec) / 2);
    out[k] = s;
    sum += s;
  }
  for (const k of Object.keys(out)) out[k] = Math.round((out[k] / sum) * 100);
  return out;
}

/** 一次性生成全部反向映射 */
export function crossSystemProfile(z) {
  return {
    mbti: toMBTI(z),
    bigFive: toBigFive(z),
    enneagram: toEnneagram(z),
    attachment: toAttachment(z),
    chakra: toChakra(z),
    dosha: toDosha(z),
    tcm: toTCMType(z),
    humanDesign: toHumanDesignApprox(z),
    loveLanguages: toLoveLanguages(z),
    elementAffinity: toElementAffinity(z),
    tarot: DIM_TAROT[DIM_KEYS[z.indexOf(Math.max(...z))]],
    rune: DIM_RUNE[DIM_KEYS[z.indexOf(Math.max(...z))]],
  };
}
