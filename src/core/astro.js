/**
 * astro.js — 天文与历法基础层 / Astronomical & calendrical primitives
 *
 * 所有算法均为解析式低精度实现（Meeus 简化级数），不依赖星历文件。
 * 精度目标：太阳黄经 ±0.01°，月亮黄经 ±0.3°，上升点 ±0.5°（时间准确的前提下）。
 * 该精度足以支撑星座 / 节气 / 宫位 / 纳沙特拉一级的符号推演。
 *
 * All algorithms are closed-form low-precision (truncated Meeus series);
 * no ephemeris files required. Accuracy: Sun ±0.01°, Moon ±0.3°, ASC ±0.5°.
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const norm360 = (x) => ((x % 360) + 360) % 360;
export const sinD = (x) => Math.sin(x * DEG);
export const cosD = (x) => Math.cos(x * DEG);
export const tanD = (x) => Math.tan(x * DEG);

/** 儒略日（UT）。month 1-12，day 可含小数。 */
export function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  // 1582-10-15 起用格里历
  const gregorian =
    year > 1582 ||
    (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  let b = 0;
  if (gregorian) {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
}

/** 儒略日 -> 公历 {year, month, day(含小数)} */
export function fromJulianDay(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

/** 本地民用时 -> 儒略日（UT）。tzHours 为时区偏移（东经为正，如北京 +8）。 */
export function localToJD({ year, month, day, hour = 12, minute = 0, tzHours = 8 }) {
  const dayFrac = day + (hour - tzHours) / 24 + minute / 1440;
  return julianDay(year, month, dayFrac);
}

/** 儒略世纪数（J2000 起算） */
export const centuriesJ2000 = (jd) => (jd - 2451545.0) / 36525.0;

/** 黄赤交角（度），IAU 1980 平黄赤交角 */
export function obliquity(jd) {
  const t = centuriesJ2000(jd);
  return (
    23.439291 - 0.0130042 * t - 1.64e-7 * t * t + 5.036e-7 * t * t * t
  );
}

/** 太阳视黄经（度），Meeus ch.25 低精度 */
export function sunLongitude(jd) {
  const t = centuriesJ2000(jd);
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sinD(m) +
    (0.019993 - 0.000101 * t) * sinD(2 * m) +
    0.000289 * sinD(3 * m);
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  return norm360(trueLong - 0.00569 - 0.00478 * sinD(omega));
}

/** 月亮黄经（度），Meeus ch.47 主要项截断 */
export function moonLongitude(jd) {
  const t = centuriesJ2000(jd);
  const lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t;
  const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t;
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t;
  const mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t;
  const f = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t;
  const terms = [
    [6.288774, mp],
    [1.274027, 2 * d - mp],
    [0.658314, 2 * d],
    [0.213618, 2 * mp],
    [-0.185116, m],
    [-0.114332, 2 * f],
    [0.058793, 2 * d - 2 * mp],
    [0.057066, 2 * d - m - mp],
    [0.05332, 2 * d + mp],
    [0.045758, 2 * d - m],
    [-0.040923, m - mp],
    [-0.034720, d],
    [-0.030383, m + mp],
    [0.015327, 2 * d - 2 * f],
    [-0.012528, mp + 2 * f],
    [0.010980, mp - 2 * f],
    [0.010675, 4 * d - mp],
    [0.010034, 3 * mp],
    [0.008548, 4 * d - 2 * mp],
  ];
  let sum = 0;
  for (const [coef, ang] of terms) sum += coef * sinD(ang);
  return norm360(lp + sum);
}

/** 月相角（0=朔，180=望）与相位名 */
export function lunarPhase(jd) {
  const angle = norm360(moonLongitude(jd) - sunLongitude(jd));
  const idx = Math.floor(norm360(angle + 22.5) / 45) % 8;
  const names = [
    ['朔·新月', 'New Moon'],
    ['蛾眉月', 'Waxing Crescent'],
    ['上弦月', 'First Quarter'],
    ['盈凸月', 'Waxing Gibbous'],
    ['望·满月', 'Full Moon'],
    ['亏凸月', 'Waning Gibbous'],
    ['下弦月', 'Last Quarter'],
    ['残月', 'Waning Crescent'],
  ];
  return {
    angle,
    illumination: (1 - cosD(angle)) / 2,
    index: idx,
    zh: names[idx][0],
    en: names[idx][1],
  };
}

/** 格林尼治平恒星时（度），Meeus 12.4 */
export function gmst(jd) {
  const t = centuriesJ2000(jd);
  return norm360(
    280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
  );
}

/** 本地恒星时（度）。lonEast 东经为正。 */
export const lst = (jd, lonEast) => norm360(gmst(jd) + lonEast);

/**
 * 上升点（Ascendant）与中天（MC）黄经。
 * latitude 北纬为正。极区（|lat| > 66.5）退化处理为 MC + 90°。
 */
export function ascendantMC(jd, lonEast, latitude) {
  const eps = obliquity(jd);
  const ramc = lst(jd, lonEast);
  const mc = norm360(Math.atan2(sinD(ramc), cosD(ramc) * cosD(eps)) * RAD);
  const lat = Math.max(-66.4, Math.min(66.4, latitude));
  const y = -cosD(ramc);
  const x = sinD(ramc) * cosD(eps) + tanD(lat) * sinD(eps);
  let asc = norm360(Math.atan2(y, x) * RAD + 180);
  if (Math.abs(latitude) > 66.4) asc = norm360(mc + 90);
  return { asc, mc, ramc, obliquity: eps };
}

export const SIGNS = [
  { zh: '白羊', en: 'Aries', glyph: '♈', element: 'fire', modality: 'cardinal', ruler: '火星' },
  { zh: '金牛', en: 'Taurus', glyph: '♉', element: 'earth', modality: 'fixed', ruler: '金星' },
  { zh: '双子', en: 'Gemini', glyph: '♊', element: 'air', modality: 'mutable', ruler: '水星' },
  { zh: '巨蟹', en: 'Cancer', glyph: '♋', element: 'water', modality: 'cardinal', ruler: '月亮' },
  { zh: '狮子', en: 'Leo', glyph: '♌', element: 'fire', modality: 'fixed', ruler: '太阳' },
  { zh: '处女', en: 'Virgo', glyph: '♍', element: 'earth', modality: 'mutable', ruler: '水星' },
  { zh: '天秤', en: 'Libra', glyph: '♎', element: 'air', modality: 'cardinal', ruler: '金星' },
  { zh: '天蝎', en: 'Scorpio', glyph: '♏', element: 'water', modality: 'fixed', ruler: '冥王星' },
  { zh: '射手', en: 'Sagittarius', glyph: '♐', element: 'fire', modality: 'mutable', ruler: '木星' },
  { zh: '摩羯', en: 'Capricorn', glyph: '♑', element: 'earth', modality: 'cardinal', ruler: '土星' },
  { zh: '水瓶', en: 'Aquarius', glyph: '♒', element: 'air', modality: 'fixed', ruler: '天王星' },
  { zh: '双鱼', en: 'Pisces', glyph: '♓', element: 'water', modality: 'mutable', ruler: '海王星' },
];

export const signOf = (lon) => SIGNS[Math.floor(norm360(lon) / 30)];
export const signIndex = (lon) => Math.floor(norm360(lon) / 30);
export const degreeInSign = (lon) => norm360(lon) % 30;

/** Lahiri 岁差（度），用于印度吠陀占星的恒星黄道换算 */
export function ayanamsaLahiri(jd) {
  const t = centuriesJ2000(jd);
  return 23.85 + 1.3972 * t; // ≈ 每年 50.29″
}

export const NAKSHATRAS = [
  'Ashwini 娄宿', 'Bharani 胃宿', 'Krittika 昴宿', 'Rohini 毕宿',
  'Mrigashira 觜宿', 'Ardra 参宿', 'Punarvasu 井宿', 'Pushya 鬼宿',
  'Ashlesha 柳宿', 'Magha 星宿', 'P.Phalguni 张宿', 'U.Phalguni 翼宿',
  'Hasta 轸宿', 'Chitra 角宿', 'Swati 亢宿', 'Vishakha 氐宿',
  'Anuradha 房宿', 'Jyeshtha 心宿', 'Mula 尾宿', 'P.Ashadha 箕宿',
  'U.Ashadha 斗宿', 'Shravana 牛宿', 'Dhanishta 女宿', 'Shatabhisha 虚宿',
  'P.Bhadrapada 危宿', 'U.Bhadrapada 室宿', 'Revati 壁宿',
];

/** 玛雅卓尔金历 260 日轮（GMT 584283 correlation） */
export const TZOLKIN_NAMES = [
  'Imix 鳄', 'Ik 风', 'Akbal 夜', 'Kan 种', 'Chicchan 蛇', 'Cimi 亡',
  'Manik 鹿', 'Lamat 星', 'Muluc 水', 'Oc 犬', 'Chuen 猴', 'Eb 路',
  'Ben 苇', 'Ix 豹', 'Men 鹰', 'Cib 战士', 'Caban 地', 'Etznab 镜',
  'Cauac 风暴', 'Ahau 日',
];

export function tzolkin(jdn) {
  const lc = Math.round(jdn) - 584283;
  const number = (((lc + 3) % 13) + 13) % 13 + 1;
  const nameIdx = (((lc + 19) % 20) + 20) % 20;
  return { number, nameIdx, name: TZOLKIN_NAMES[nameIdx], kin: ((lc % 260) + 260) % 260 + 1 };
}

/** 求解太阳黄经等于目标值的时刻（儒略日），二分逼近，用于节气/立春定位 */
export function solveSunLongitude(targetLon, jdGuess) {
  let lo = jdGuess - 20;
  let hi = jdGuess + 20;
  const delta = (jd) => {
    let d = sunLongitude(jd) - targetLon;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };
  if (delta(lo) > 0) lo -= 20;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (delta(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 二十四节气名（自立春起，每 15°） */
export const SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
];

/** 给定儒略日，返回其所处节气（以立春 315° 为序号 0） */
export function solarTermOf(jd) {
  const lon = sunLongitude(jd);
  const idx = Math.floor(norm360(lon - 315) / 15);
  return { index: idx, name: SOLAR_TERMS[idx], longitude: lon };
}
