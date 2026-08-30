/**
 * bazi.js — 四柱八字层 / Four-Pillars (BaZi) engine
 *
 * 以太阳黄经定年月（立春换年、节气换月），以儒略日定日柱，以真太阳时可选校正定时柱。
 * 输出：四柱干支、藏干、五行权重、十神、生肖、纳音。
 *
 * 说明：本引擎输出的是「符号特征向量」，供 OML 评分层作为先验使用；
 * 它不主张任何命定论结论。见 docs/05-ethics-inclusion.md。
 */

import {
  localToJD,
  sunLongitude,
  norm360,
  julianDay,
  solarTermOf,
} from './astro.js';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
export const ZODIAC_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

export const ELEMENTS = ['木', '火', '土', '金', '水'];
export const ELEMENTS_EN = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
export const ELEMENT_KEY = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 天干五行索引 & 阴阳（+1 阳 / -1 阴） */
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const STEM_YIN_YANG = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1];
/** 地支五行索引 */
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
export const BRANCH_YIN_YANG = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1];

/** 地支藏干（主气 / 中气 / 余气）与权重 */
export const HIDDEN_STEMS = {
  子: [['癸', 1.0]],
  丑: [['己', 0.6], ['癸', 0.25], ['辛', 0.15]],
  寅: [['甲', 0.6], ['丙', 0.25], ['戊', 0.15]],
  卯: [['乙', 1.0]],
  辰: [['戊', 0.6], ['乙', 0.25], ['癸', 0.15]],
  巳: [['丙', 0.6], ['庚', 0.25], ['戊', 0.15]],
  午: [['丁', 0.7], ['己', 0.3]],
  未: [['己', 0.6], ['丁', 0.25], ['乙', 0.15]],
  申: [['庚', 0.6], ['壬', 0.25], ['戊', 0.15]],
  酉: [['辛', 1.0]],
  戌: [['戊', 0.6], ['辛', 0.25], ['丁', 0.15]],
  亥: [['壬', 0.7], ['甲', 0.3]],
};

/** 五行生克：生 = (e+1)%5，克 = (e+2)%5 */
export const generates = (a, b) => (a + 1) % 5 === b;
export const controls = (a, b) => (a + 2) % 5 === b;

export const TEN_GODS = {
  比肩: '同我·同性', 劫财: '同我·异性',
  食神: '我生·同性', 伤官: '我生·异性',
  偏财: '我克·同性', 正财: '我克·异性',
  七杀: '克我·同性', 正官: '克我·异性',
  偏印: '生我·同性', 正印: '生我·异性',
};

/** 十神判定：以日主 dayStem 为我 */
export function tenGod(dayStemIdx, otherStemIdx) {
  const me = STEM_ELEMENT[dayStemIdx];
  const other = STEM_ELEMENT[otherStemIdx];
  const same = STEM_YIN_YANG[dayStemIdx] === STEM_YIN_YANG[otherStemIdx];
  if (me === other) return same ? '比肩' : '劫财';
  if (generates(me, other)) return same ? '食神' : '伤官';
  if (controls(me, other)) return same ? '偏财' : '正财';
  if (controls(other, me)) return same ? '七杀' : '正官';
  return same ? '偏印' : '正印';
}

/** 六十甲子纳音 */
const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
  '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
  '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木',
  '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];
export const nayinOf = (gzIndex) => NAYIN[Math.floor((((gzIndex % 60) + 60) % 60) / 2)];

export const gzName = (i) => STEMS[((i % 10) + 10) % 10] + BRANCHES[((i % 12) + 12) % 12];

/**
 * 计算四柱。
 * @param {object} birth {year, month, day, hour, minute, tzHours, lonEast}
 * @param {object} opts  {lateZiAsNextDay: 晚子时(23:00后)是否进位到次日日柱, trueSolarTime: 是否用经度校正真太阳时}
 */
export function fourPillars(birth, opts = {}) {
  const { lateZiAsNextDay = true, trueSolarTime = true } = opts;
  const {
    year, month, day, hour = 12, minute = 0, tzHours = 8, lonEast = 116.4,
  } = birth;

  // 真太阳时校正：每偏离时区中央经线 1° 约 4 分钟
  const meridian = tzHours * 15;
  const lstOffsetMin = trueSolarTime ? (lonEast - meridian) * 4 : 0;
  const totalMin = hour * 60 + minute + lstOffsetMin;
  const solarHour = ((totalMin / 60) % 24 + 24) % 24;
  const dayShift = Math.floor(totalMin / 60 / 24); // 校正可能跨日

  const jd = localToJD({ year, month, day, hour, minute, tzHours });
  const lon = sunLongitude(jd);

  // —— 年柱：立春（黄经 315°）换年 ——
  // 节气序号 0=立春 … 21=冬至 22=小寒 23=大寒；21~23 若落在 1~2 月即尚未过立春，仍属上一命理年。
  const term = solarTermOf(jd);
  const beforeLiChun = month <= 2 && term.index >= 21;
  const baziYear = beforeLiChun ? year - 1 : year;
  const yearGz = ((baziYear - 4) % 60 + 60) % 60;

  // —— 月柱：以节（每 30°）定月支，寅月起于黄经 315° ——
  const monthOrder = Math.floor(norm360(lon - 315) / 30); // 0 = 寅月
  const monthBranchIdx = (monthOrder + 2) % 12;
  const yearStemIdx = yearGz % 10;
  const monthStemIdx = ((yearStemIdx % 5) * 2 + 2 + monthOrder) % 10;

  // —— 日柱：儒略日序 ——
  // julianDay(y,m,d) 为该日 00:00 UT 的 JD（形如 X.5），其 JDN = X + 1。
  // 锚点校验：1949-10-01 -> 甲子日，2000-01-01 -> 戊午日（见 tests/bazi.test.js）。
  let jdn = Math.floor(julianDay(year, month, day)) + 1 + dayShift;
  if (lateZiAsNextDay && solarHour >= 23) jdn += 1;
  const dayGz = ((jdn + 49) % 60 + 60) % 60;

  // —— 时柱：五鼠遁 ——
  const hourBranchIdx = Math.floor(((solarHour + 1) % 24) / 2) % 12;
  const dayStemIdx = dayGz % 10;
  const hourStemIdx = ((dayStemIdx % 5) * 2 + hourBranchIdx) % 10;

  const pillars = {
    year: { stem: yearStemIdx, branch: yearGz % 12, gz: yearGz },
    month: { stem: monthStemIdx, branch: monthBranchIdx, gz: null },
    day: { stem: dayStemIdx, branch: dayGz % 12, gz: dayGz },
    hour: { stem: hourStemIdx, branch: hourBranchIdx, gz: null },
  };
  pillars.month.gz = gzIndexOf(monthStemIdx, monthBranchIdx);
  pillars.hour.gz = gzIndexOf(hourStemIdx, hourBranchIdx);

  const named = {};
  for (const k of ['year', 'month', 'day', 'hour']) {
    named[k] = {
      ...pillars[k],
      name: STEMS[pillars[k].stem] + BRANCHES[pillars[k].branch],
      nayin: nayinOf(pillars[k].gz),
      hidden: HIDDEN_STEMS[BRANCHES[pillars[k].branch]].map(([s, w]) => ({
        stem: s,
        weight: w,
        god: tenGod(dayStemIdx, STEMS.indexOf(s)),
      })),
      god: k === 'day' ? '日主' : tenGod(dayStemIdx, pillars[k].stem),
    };
  }

  return {
    baziYear,
    solarLongitude: lon,
    solarTerm: term.name,
    solarHour,
    pillars: named,
    dayMaster: {
      stem: STEMS[dayStemIdx],
      index: dayStemIdx,
      element: ELEMENTS[STEM_ELEMENT[dayStemIdx]],
      elementIndex: STEM_ELEMENT[dayStemIdx],
      yinYang: STEM_YIN_YANG[dayStemIdx] > 0 ? '阳' : '阴',
    },
    zodiac: ZODIAC[yearGz % 12],
    zodiacEn: ZODIAC_EN[yearGz % 12],
    elements: elementWeights(named, monthBranchIdx),
    tenGodProfile: tenGodProfile(named, dayStemIdx),
    strength: null, // 由 dayMasterStrength 填充
  };
}

/** (stem, branch) -> 六十甲子序号；不合法组合返回最接近的合法值 */
export function gzIndexOf(stemIdx, branchIdx) {
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  return 0;
}

/** 五行权重：天干各 1.0，地支藏干按藏干权重 ×1.2，月令主气再 ×1.5 */
export function elementWeights(named, monthBranchIdx) {
  const w = [0, 0, 0, 0, 0];
  for (const key of ['year', 'month', 'day', 'hour']) {
    const p = named[key];
    const stemW = key === 'day' ? 1.2 : 1.0;
    w[STEM_ELEMENT[p.stem]] += stemW;
    for (const h of p.hidden) {
      const e = STEM_ELEMENT[STEMS.indexOf(h.stem)];
      let bw = h.weight * 1.2;
      if (key === 'month' && h.weight >= 0.6) bw *= 1.5; // 月令司权
      w[e] += bw;
    }
  }
  void monthBranchIdx;
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const ratio = w.map((x) => x / total);
  const dominant = ratio.indexOf(Math.max(...ratio));
  const weakest = ratio.indexOf(Math.min(...ratio));
  return {
    raw: w,
    ratio,
    byName: Object.fromEntries(ELEMENT_KEY.map((k, i) => [k, ratio[i]])),
    dominant,
    dominantName: ELEMENTS[dominant],
    weakest,
    weakestName: ELEMENTS[weakest],
  };
}

/** 十神分布统计（含藏干） */
export function tenGodProfile(named, dayStemIdx) {
  const counts = {};
  for (const g of Object.keys(TEN_GODS)) counts[g] = 0;
  for (const key of ['year', 'month', 'hour']) {
    counts[tenGod(dayStemIdx, named[key].stem)] += 1;
  }
  for (const key of ['year', 'month', 'day', 'hour']) {
    for (const h of named[key].hidden) counts[h.god] += h.weight;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { counts, top: sorted.slice(0, 3).map(([k, v]) => ({ god: k, weight: +v.toFixed(2) })) };
}

/** 日主强弱：同党（比劫+印）vs 异党（食伤+财+官杀） */
export function dayMasterStrength(chart) {
  const me = chart.dayMaster.elementIndex;
  const r = chart.elements.ratio;
  const support = r[me] + r[(me + 4) % 5]; // 比劫 + 生我(印)
  const drain = r[(me + 1) % 5] + r[(me + 2) % 5] + r[(me + 3) % 5];
  const score = support - drain; // [-1, 1]
  let label = '中和';
  if (score > 0.22) label = '身强';
  else if (score > 0.08) label = '偏强';
  else if (score < -0.22) label = '身弱';
  else if (score < -0.08) label = '偏弱';
  // 喜用神粗判：身强宜泄耗克，身弱宜生扶
  const favorable = score > 0.08
    ? [(me + 1) % 5, (me + 2) % 5, (me + 3) % 5]
    : [me, (me + 4) % 5];
  return {
    score: +score.toFixed(3),
    label,
    favorable,
    favorableNames: favorable.map((i) => ELEMENTS[i]),
  };
}

/** 完整八字分析 */
export function analyzeBazi(birth, opts) {
  const chart = fourPillars(birth, opts);
  chart.strength = dayMasterStrength(chart);
  return chart;
}

// ——— 地支关系（合婚与相性用） ———
export const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
export const SAN_HE = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
export const LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
export const LIU_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
export const XIANG_XING = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']];

/** 两地支关系评分：正为和合，负为冲刑害 */
export function branchRelation(a, b) {
  const tags = [];
  let score = 0;
  if (LIU_HE[a] === b) { score += 3; tags.push('六合'); }
  for (const trio of SAN_HE) {
    if (trio.includes(a) && trio.includes(b) && a !== b) {
      const half = (trio[1] === a || trio[1] === b);
      score += half ? 2.5 : 1.5;
      tags.push(half ? '三合(带中神)' : '半合');
    }
  }
  if (a === b) { score += 1; tags.push('同支比和'); }
  if (LIU_CHONG[a] === b) { score -= 3; tags.push('六冲'); }
  if (LIU_HAI[a] === b) { score -= 1.5; tags.push('相害'); }
  for (const trio of XIANG_XING) {
    if (trio.includes(a) && trio.includes(b) && a !== b) { score -= 2; tags.push('相刑'); }
  }
  return { score, tags };
}
