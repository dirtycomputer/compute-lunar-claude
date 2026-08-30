/**
 * dimensions.js — OML 十二维本体 / The Twelve Dimensions of the Omni-Mantic Lattice
 *
 * 十二维两两成轴，构成 6 条双极轴；6 条轴的极性一次性生成 2^6 = 64 种核心型，
 * 与《易经》六十四卦、人类图 64 闸门天然同构（每条轴 = 一爻，自下而上）。
 *
 * 每个维度是独立计分的连续量（1–99），不是「非此即彼」：
 * 一个人可以同时高「曜」与高「渊」（能量丰沛型），也可以同时低（低唤起型）。
 * 轴向字母只表示该轴上哪一极更突出。
 */

/** 五行索引：0木 1火 2土 3金 4水 */
export const DIMENSIONS = [
  {
    key: 'R', axis: 0, pole: 0, name: '曜', en: 'Radiance', pinyin: 'Yào',
    gloss: '向外辐射的能量：表达欲、社交驱力、被看见的意愿。',
    glossEn: 'Outward-radiating energy: expressiveness, social drive, willingness to be seen.',
    high: '在人群中充电，先开口再思考，把内心状态直接投射到世界上。',
    low: '不主动占据舞台，能量向内保存，表达前先经过筛选。',
    element: 1, chakra: '太阳轮', dosha: 'pitta',
  },
  {
    key: 'D', axis: 0, pole: 1, name: '渊', en: 'Depth', pinyin: 'Yuān',
    gloss: '向内沉降的能量：独处需求、内省深度、私密领地。',
    glossEn: 'Inward-settling energy: need for solitude, introspective depth, private territory.',
    high: '独处是必需品而非奖赏，深潜一件事可以忘记时间。',
    low: '长时间独处会失去参照，需要外部刺激维持状态。',
    element: 4, chakra: '眉心轮', dosha: 'vata',
  },
  {
    key: 'L', axis: 1, pole: 0, name: '衡', en: 'Ledger', pinyin: 'Héng',
    gloss: '实证认知：重证据、重结构、要求可验证与可复现。',
    glossEn: 'Empirical cognition: evidence-first, structural, demands verifiability.',
    high: '先问「数据呢」，喜欢把模糊的东西拆成可测量的部分。',
    low: '对精确度不敏感，容忍未定义的中间态。',
    element: 3, chakra: '喉轮', dosha: 'vata',
  },
  {
    key: 'O', axis: 1, pole: 1, name: '兆', en: 'Omen', pinyin: 'Zhào',
    gloss: '象征认知：直觉、隐喻、模式跳跃、对意义的敏感。',
    glossEn: 'Symbolic cognition: intuition, metaphor, pattern-leaping, sensitivity to meaning.',
    high: '结论先于推理到达，重视巧合、梦与征兆携带的信息。',
    low: '不相信「感觉」，象征对你只是修辞而非线索。',
    element: 4, chakra: '顶轮', dosha: 'vata',
  },
  {
    key: 'F', axis: 2, pole: 0, name: '锻', en: 'Forge', pinyin: 'Duàn',
    gloss: '意志与掌控：主动塑形现实，目标性、支配性、竞争性。',
    glossEn: 'Will and control: actively shaping reality — goal-drive, dominance, competitiveness.',
    high: '不接受默认设置，认为环境是可以被改写的。',
    low: '不争夺方向盘，让事情按自己的节奏发生。',
    element: 0, chakra: '太阳轮', dosha: 'pitta',
  },
  {
    key: 'C', axis: 2, pole: 1, name: '流', en: 'Current', pinyin: 'Liú',
    gloss: '顺势与接纳：与不确定性共处，信任过程，随机应变。',
    glossEn: 'Flow and acceptance: coexisting with uncertainty, trusting process, improvising.',
    high: '计划被打断也不焦虑，相信绕路本身有意义。',
    low: '失控感令人难受，必须先看到路径才能出发。',
    element: 4, chakra: '骶轮', dosha: 'kapha',
  },
  {
    key: 'P', axis: 3, pole: 0, name: '汐', en: 'Pulse', pinyin: 'Xī',
    gloss: '情绪振幅：感受强度、共情深度、情绪波动的幅度与频率。',
    glossEn: 'Affective amplitude: intensity of feeling, empathic depth, emotional variability.',
    high: '感受来得快而强，别人的情绪会直接进入你的身体。',
    low: '情绪信号微弱，需要事后才知道自己刚才不开心。',
    element: 4, chakra: '心轮', dosha: 'pitta',
  },
  {
    key: 'S', axis: 3, pole: 1, name: '磐', en: 'Stone', pinyin: 'Pán',
    gloss: '情绪稳态：抗压、复原力、在混乱中保持地基的能力。',
    glossEn: 'Affective stability: stress tolerance, resilience, holding ground amid chaos.',
    high: '危机中反而更清醒，情绪起伏不影响判断与行动。',
    low: '外界扰动容易掀翻内部秩序，需要更长的恢复期。',
    element: 2, chakra: '海底轮', dosha: 'kapha',
  },
  {
    key: 'W', axis: 4, pole: 0, name: '织', en: 'Weave', pinyin: 'Zhī',
    gloss: '联结取向：亲密需求、群体归属、把「我们」置于「我」之前。',
    glossEn: 'Bonding orientation: need for intimacy, communal belonging, "we" before "I".',
    high: '关系是意义的主要来源，愿意为共同体让渡个人边界。',
    low: '关系是生活的一部分而非全部，不靠联结定义自己。',
    element: 2, chakra: '心轮', dosha: 'kapha',
  },
  {
    key: 'B', axis: 4, pole: 1, name: '垣', en: 'Bastion', pinyin: 'Yuán',
    gloss: '边界与自主：主权意识、拒绝能力、独立决策的必要性。',
    glossEn: 'Boundary and autonomy: sovereignty, capacity to refuse, need for independent agency.',
    high: '「不」说得干脆，别人的期待无法改变你的核心决定。',
    low: '边界容易被推移，常在事后才发现自己被越界。',
    element: 3, chakra: '喉轮', dosha: 'vata',
  },
  {
    key: 'M', axis: 5, pole: 0, name: '化', en: 'Meta', pinyin: 'Huà',
    gloss: '变易取向：求新、可塑、主动寻找断裂与重构。',
    glossEn: 'Transformative orientation: novelty-seeking, plasticity, actively courting rupture.',
    high: '重复会杀死你，愿意为新版本的自己拆掉旧的。',
    low: '变化需要理由，稳定不是保守而是效率。',
    element: 1, chakra: '顶轮', dosha: 'vata',
  },
  {
    key: 'G', axis: 5, pole: 1, name: '根', en: 'Ground', pinyin: 'Gēn',
    gloss: '承续取向：传统、长期承诺、来处与谱系的重量。',
    glossEn: 'Continuity orientation: tradition, long commitment, the weight of lineage and origin.',
    high: '记得来处，愿意守住一件事很多年。',
    low: '过去没有约束力，血缘与传统不构成理由。',
    element: 0, chakra: '海底轮', dosha: 'kapha',
  },
];

export const DIM_KEYS = DIMENSIONS.map((d) => d.key);
export const DIM_BY_KEY = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));

/** 6 条双极轴 */
export const AXES = [
  { id: 0, zh: '能量轴', en: 'Energy Current', poles: ['R', 'D'], question: '能量朝哪个方向流？' },
  { id: 1, zh: '认知轴', en: 'Cognition Mode', poles: ['L', 'O'], question: '真相通过什么通道到达？' },
  { id: 2, zh: '意志轴', en: 'Volition Stance', poles: ['F', 'C'], question: '面对现实是塑形还是顺流？' },
  { id: 3, zh: '情感轴', en: 'Affective Field', poles: ['P', 'S'], question: '感受是浪还是地基？' },
  { id: 4, zh: '联结轴', en: 'Bond Geometry', poles: ['W', 'B'], question: '「我们」与「我」谁在前？' },
  { id: 5, zh: '生成轴', en: 'Becoming Vector', poles: ['M', 'G'], question: '时间指向未来还是来处？' },
];

/** 轴向前缀名（轴 0/1/2 组合，8 种） */
export const PREFIX_NAMES = {
  RLF: { zh: '明锻', en: 'Forgelight' },
  RLC: { zh: '朗流', en: 'Clearstream' },
  ROF: { zh: '曜启', en: 'Sunherald' },
  ROC: { zh: '焰漂', en: 'Emberdrift' },
  DLF: { zh: '深锻', en: 'Deepforge' },
  DLC: { zh: '静衡', en: 'Stillscale' },
  DOF: { zh: '玄锻', en: 'Veilforge' },
  DOC: { zh: '幽流', en: 'Mistflow' },
};

/** 轴向后缀名（轴 3/4/5 组合，8 种） */
export const SUFFIX_NAMES = {
  PWM: { zh: '潮织者', en: 'Tideweaver' },
  PWG: { zh: '潮守者', en: 'Tidekeeper' },
  PBM: { zh: '潮行者', en: 'Tidewalker' },
  PBG: { zh: '潮岸者', en: 'Tideshore' },
  SWM: { zh: '磐织者', en: 'Stoneweaver' },
  SWG: { zh: '磐守者', en: 'Stonekeeper' },
  SBM: { zh: '磐行者', en: 'Stonewalker' },
  SBG: { zh: '磐岸者', en: 'Stoneshore' },
};

/** 五行代号：1木 2火 3土 4金 5水 */
export const ELEMENT_DIGITS = ['1', '2', '3', '4', '5'];
export const ELEMENT_LABEL = [
  { zh: '木', en: 'Wood', keyword: '生发' },
  { zh: '火', en: 'Fire', keyword: '炽照' },
  { zh: '土', en: 'Earth', keyword: '承载' },
  { zh: '金', en: 'Metal', keyword: '肃裁' },
  { zh: '水', en: 'Water', keyword: '润通' },
];

/** 后缀调性：A = 协（Attuned），T = 荡（Turbulent） */
export const TEMPER = {
  A: { zh: '协', en: 'Attuned', gloss: '内部张力低，自我一致，压力下先稳后动。' },
  T: { zh: '荡', en: 'Turbulent', gloss: '内部张力高，自我审视强烈，压力下先动后稳；张力也是引擎。' },
};

// —— 八卦与六十四卦 ——
export const TRIGRAMS = [
  { bits: [1, 1, 1], zh: '乾', en: 'Qian', symbol: '☰', nature: '天' },
  { bits: [1, 1, 0], zh: '兑', en: 'Dui', symbol: '☱', nature: '泽' },
  { bits: [1, 0, 1], zh: '离', en: 'Li', symbol: '☲', nature: '火' },
  { bits: [1, 0, 0], zh: '震', en: 'Zhen', symbol: '☳', nature: '雷' },
  { bits: [0, 1, 1], zh: '巽', en: 'Xun', symbol: '☴', nature: '风' },
  { bits: [0, 1, 0], zh: '坎', en: 'Kan', symbol: '☵', nature: '水' },
  { bits: [0, 0, 1], zh: '艮', en: 'Gen', symbol: '☶', nature: '山' },
  { bits: [0, 0, 0], zh: '坤', en: 'Kun', symbol: '☷', nature: '地' },
];

/**
 * 文王六十四卦序表。
 * 行 = 下卦，列 = 上卦，顺序均为 乾兑离震巽坎艮坤。
 */
export const KING_WEN = [
  [1, 43, 14, 34, 9, 5, 26, 11],
  [10, 58, 38, 54, 61, 60, 41, 19],
  [13, 49, 30, 55, 37, 63, 22, 36],
  [25, 17, 21, 51, 42, 3, 27, 24],
  [44, 28, 50, 32, 57, 48, 18, 46],
  [6, 47, 64, 40, 59, 29, 4, 7],
  [33, 31, 56, 62, 53, 39, 52, 15],
  [12, 45, 35, 16, 20, 8, 23, 2],
];

export const HEXAGRAM_NAMES = [
  '乾', '坤', '屯', '蒙', '需', '讼', '师', '比',
  '小畜', '履', '泰', '否', '同人', '大有', '谦', '豫',
  '随', '蛊', '临', '观', '噬嗑', '贲', '剥', '复',
  '无妄', '大畜', '颐', '大过', '坎', '离', '咸', '恒',
  '遁', '大壮', '晋', '明夷', '家人', '睽', '蹇', '解',
  '损', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '渐', '归妹', '丰', '旅',
  '巽', '兑', '涣', '节', '中孚', '小过', '既济', '未济',
];

/** 六爻（自下而上）-> 文王卦序号；爻值 1 为阳、0 为阴 */
export function hexagramFromLines(lines) {
  const tri = (b) => 7 - (b[0] * 4 + b[1] * 2 + b[2]);
  const lower = tri(lines.slice(0, 3));
  const upper = tri(lines.slice(3, 6));
  const number = KING_WEN[lower][upper];
  return {
    number,
    name: HEXAGRAM_NAMES[number - 1],
    lower: TRIGRAMS[lower],
    upper: TRIGRAMS[upper],
    symbol: `${TRIGRAMS[upper].symbol}${TRIGRAMS[lower].symbol}`,
    composed: `${TRIGRAMS[upper].nature}${TRIGRAMS[lower].nature}${HEXAGRAM_NAMES[number - 1]}`,
    lines,
  };
}

/** 综卦（倒转）与错卦（阴阳全反） */
export const reverseHexagram = (lines) => hexagramFromLines([...lines].reverse());
export const inverseHexagram = (lines) => hexagramFromLines(lines.map((x) => 1 - x));
