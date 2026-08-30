/**
 * geo.js — 城市检索与时区解析 / City lookup & timezone resolution
 *
 * 目标：使用者只需要选出生城市，不必自己查 UTC 偏移。
 *
 * 关键设计：数据集里存的是 IANA 时区名（如 Asia/Shanghai），不是固定偏移。
 * 偏移在运行时按「出生的那一刻」用 Intl 解析，因此以下情形都会自动正确：
 *   · 夏令时          纽约 1990-07 是 −4、1990-01 是 −5
 *   · 历史时区变更     中国 1986–1991 年实行夏令时，1988-07 的北京是 +9 而不是 +8
 *   · 非整点时区       印度 +5:30、尼泊尔 +5:45、纽芬兰 −3:30
 *   · 标准时之前的地方平太阳时  1900 年前的上海是 +8:05:43（LMT）
 * 这些正是让使用者手填 UTC 时最容易错、且会直接串掉时柱的地方。
 *
 * 数据来源：GeoNames（https://www.geonames.org/），CC BY 4.0。
 */

import { wrapDeg180 } from './astro.js';

/** 解析 build-cities.js 生成的紧凑格式 */
export function parseCityData(text) {
  const lines = text.split('\n');
  let tzList = [];
  let cc = '';
  const cities = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#TZ ')) { tzList = line.slice(4).split(','); continue; }
    if (line.startsWith('#')) { cc = line.slice(1); continue; }
    const f = line.split('|');
    cities.push({
      name: f[0],
      ascii: f[1],
      /** 可信的中文显示名；为空表示 GeoNames 的汉字别名不可信，只显示拉丁名 */
      zh: f[2],
      /** 全部汉字候选，仅用于搜索 */
      han: f[3] ? f[3].split('/') : [],
      cc,
      admin1: f[4],
      lat: Number(f[5]) / 1000,
      lon: Number(f[6]) / 1000,
      tz: tzList[Number(f[7])],
      pop: Math.round(2 ** (parseInt(f[8], 36) / 4)),
    });
  }
  return cities;
}

export function parseCountryData(text) {
  const map = {};
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [cc, zh, en] = line.split('|');
    map[cc] = { cc, zh, en };
  }
  return map;
}

// ————————————————————— 时区解析 —————————————————————

const dtfCache = new Map();
function formatter(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

/** 某一瞬间在给定时区的 UTC 偏移（分钟，东为正） */
export function offsetAtInstant(tz, date) {
  const parts = formatter(tz).formatToParts(date);
  const m = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  const asIfUTC = Date.UTC(
    Number(m.year), Number(m.month) - 1, Number(m.day),
    Number(m.hour) % 24, Number(m.minute), Number(m.second),
  );
  return Math.round((asIfUTC - date.getTime()) / 60000);
}

/**
 * 由「当地墙上时间」求 UTC 偏移。
 *
 * 墙上时间 → 瞬间不是一一映射：夏令时前拨时某些本地时间不存在，回拨时某些出现两次。
 * 做法是分别用切换前、切换后的偏移各推一个候选瞬间，再回代验证：
 *   两个候选都成立且不同 → ambiguous（本地时间出现两次），取较早的一次
 *   两个候选都不成立     → nonexistent（本地时间不存在），取切换后的偏移
 * @returns {{minutes:number, hours:number, ambiguous:boolean, nonexistent:boolean, tz:string}}
 */
export function offsetForLocalTime(tz, year, month, day, hour = 12, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const DAY = 86400000;
  const offBefore = offsetAtInstant(tz, new Date(wall - DAY));
  const offAfter = offsetAtInstant(tz, new Date(wall + DAY));

  const cand1 = wall - offBefore * 60000;
  const cand2 = wall - offAfter * 60000;
  const valid1 = offsetAtInstant(tz, new Date(cand1)) === offBefore;
  const valid2 = offsetAtInstant(tz, new Date(cand2)) === offAfter;

  const ambiguous = valid1 && valid2 && cand1 !== cand2;
  const nonexistent = !valid1 && !valid2;
  // 歧义时取较早的一次（cand1 用的是切换前的偏移）；都不成立时取切换后的偏移
  const minutes = valid1 ? offBefore : offAfter;

  return { minutes, hours: minutes / 60, ambiguous, nonexistent, tz };
}

/** 把偏移分钟数格式化为 UTC+08:00 / UTC+05:45 / UTC−03:30 */
export function formatOffset(minutes) {
  const sign = minutes < 0 ? '−' : '+';
  const a = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/**
 * 城市 + 出生日期时间 → 可直接喂给 buildBirthChart 的参数。
 * 同时给出真太阳时校正量，便于在界面上向使用者解释「为什么时柱是这个」。
 */
export function resolveBirthLocation(city, { year, month, day, hour = 12, minute = 0 }) {
  const off = offsetForLocalTime(city.tz, year, month, day, hour, minute);
  const meridian = off.hours * 15;
  // 经差归一到 ±180°：汤加在西经 175° 却用 UTC+13，直接相减会得到 −370°
  const solarCorrectionMinutes = wrapDeg180(city.lon - meridian) * 4;
  return {
    tzHours: off.hours,
    lonEast: city.lon,
    latNorth: city.lat,
    timezone: city.tz,
    offsetMinutes: off.minutes,
    offsetLabel: formatOffset(off.minutes),
    ambiguous: off.ambiguous,
    nonexistent: off.nonexistent,
    /** 真太阳时相对钟表时间的偏差（分钟），正表示真太阳时更早（偏东） */
    solarCorrectionMinutes: +solarCorrectionMinutes.toFixed(1),
    meridian,
  };
}

// ————————————————————— 检索 —————————————————————

const normalize = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // 去掉变音符号，Ürümqi → urumqi
  .replace(/[^a-z0-9一-鿿]/g, '');

/** 为城市数组建立检索索引 */
export function buildIndex(cities) {
  return cities.map((c) => ({
    city: c,
    keys: [normalize(c.name), normalize(c.ascii || ''), normalize(c.zh || ''),
      ...c.han.map(normalize)].filter(Boolean),
  }));
}

/**
 * 检索。前缀匹配优先于包含匹配，其次按人口降序。
 * @param {Array} index buildIndex 的结果
 * @param {string} query 查询串（中英文皆可）
 * @param {object} opts {limit, cc 限定国家}
 */
export function searchCities(index, query, opts = {}) {
  const { limit = 40, cc = null } = opts;
  const q = normalize(query);
  if (!q) return [];
  const prefix = [];
  const contains = [];
  for (const entry of index) {
    if (cc && entry.city.cc !== cc) continue;
    let hit = 0;
    for (const k of entry.keys) {
      if (k.startsWith(q)) { hit = 2; break; }
      if (k.includes(q)) hit = 1;
    }
    if (hit === 2) prefix.push(entry.city);
    else if (hit === 1) contains.push(entry.city);
    if (prefix.length >= limit * 4) break;
  }
  const byPop = (a, b) => b.pop - a.pop;
  return [...prefix.sort(byPop), ...contains.sort(byPop)].slice(0, limit);
}

/** 按经纬度找最近的城市（用于「我的小镇不在列表里」的兜底） */
export function nearestCity(cities, lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (const c of cities) {
    const dLat = c.lat - lat;
    const dLon = (c.lon - lon) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? { city: best, degrees: Math.sqrt(bestD) } : null;
}

/**
 * 城市显示名：有可信中文名时显示「中文（原名）」，否则只显示原名。
 * 宁可不显示中文，也不显示可能错的中文——见 scripts/build-cities.js 的 pickDisplayZh()。
 */
export const cityLabel = (c) => (c.zh ? `${c.zh}（${c.name}）` : c.name);
