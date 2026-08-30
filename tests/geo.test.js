import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  parseCityData, parseCountryData, buildIndex, searchCities, nearestCity,
  offsetAtInstant, offsetForLocalTime, formatOffset, resolveBirthLocation, cityLabel,
} from '../src/core/geo.js';
import { buildBirthChart } from '../src/core/scoring.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cities = parseCityData(readFileSync(join(ROOT, 'src/data/cities.txt'), 'utf8'));
const countries = parseCountryData(readFileSync(join(ROOT, 'src/data/countries.txt'), 'utf8'));
const index = buildIndex(cities);
const byName = (n, cc) => cities.find((c) => c.name === n && (!cc || c.cc === cc));

// ————————————————————— 数据集完整性 —————————————————————
test('主库规模与国家覆盖', () => {
  assert.ok(cities.length > 30000, `仅 ${cities.length} 座城市`);
  const ccs = new Set(cities.map((c) => c.cc));
  assert.ok(ccs.size >= 240, `仅覆盖 ${ccs.size} 个国家与地区`);
  // 主要国家都应有相当数量的城市
  for (const [cc, min] of [['CN', 800], ['US', 2000], ['IN', 1000], ['JP', 400], ['BR', 500], ['DE', 400]]) {
    assert.ok(cities.filter((c) => c.cc === cc).length >= min, `${cc} 城市过少`);
  }
});

test('每条记录的字段都合法', () => {
  for (const c of cities) {
    assert.ok(c.name && c.name.length > 0, '城市名为空');
    assert.ok(Number.isFinite(c.lat) && c.lat >= -90 && c.lat <= 90, `${c.name} 纬度 ${c.lat}`);
    assert.ok(Number.isFinite(c.lon) && c.lon >= -180 && c.lon <= 180, `${c.name} 经度 ${c.lon}`);
    assert.ok(c.tz && c.tz.includes('/'), `${c.name} 时区 ${c.tz}`);
    assert.ok(c.cc && c.cc.length === 2, `${c.name} 国家码 ${c.cc}`);
  }
});

test('数据集里的每个时区名都能被 Intl 接受', () => {
  // 一个拼错的时区会在运行时抛异常，且只有该城市的用户会遇到——必须整体校验
  const tzs = [...new Set(cities.map((c) => c.tz))];
  assert.ok(tzs.length > 300, `时区种类仅 ${tzs.length}`);
  for (const tz of tzs) {
    assert.doesNotThrow(
      () => new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date()),
      `无效时区 ${tz}`,
    );
  }
});

test('国家表覆盖数据集中出现的所有国家码', () => {
  const ccs = new Set(cities.map((c) => c.cc));
  for (const cc of ccs) assert.ok(countries[cc], `国家表缺少 ${cc}`);
  assert.equal(countries.CN.zh, '中国');
  assert.equal(countries.JP.zh, '日本');
  assert.equal(countries.US.zh, '美国');
});

test('已知城市的坐标与时区正确', () => {
  const cases = [
    ['Beijing', 'CN', 39.9, 116.4, 'Asia/Shanghai'],
    ['Shanghai', 'CN', 31.2, 121.5, 'Asia/Shanghai'],
    ['Ürümqi', 'CN', 43.8, 87.6, 'Asia/Shanghai'],  // 见下方「中国统一按北京时间」用例
    ['New York City', 'US', 40.7, -74.0, 'America/New_York'],
    ['London', 'GB', 51.5, -0.1, 'Europe/London'],
    ['Sydney', 'AU', -33.9, 151.2, 'Australia/Sydney'],
    ['Kathmandu', 'NP', 27.7, 85.3, 'Asia/Kathmandu'],
    ['São Paulo', 'BR', -23.5, -46.6, 'America/Sao_Paulo'],
  ];
  for (const [name, cc, lat, lon, tz] of cases) {
    const c = byName(name, cc);
    assert.ok(c, `${name} 不在库中`);
    assert.ok(Math.abs(c.lat - lat) < 0.6, `${name} 纬度 ${c.lat} ≠ ${lat}`);
    assert.ok(Math.abs(c.lon - lon) < 0.6, `${name} 经度 ${c.lon} ≠ ${lon}`);
    assert.equal(c.tz, tz, `${name} 时区`);
  }
});

// ————————————————————— 时区解析 —————————————————————
test('基本偏移：整点、半点、三刻', () => {
  const at = (tz, y, m, d, h) => offsetForLocalTime(tz, y, m, d, h).hours;
  assert.equal(at('Asia/Shanghai', 2000, 6, 15, 12), 8);
  assert.equal(at('Asia/Kolkata', 2000, 6, 15, 12), 5.5);
  assert.equal(at('Asia/Kathmandu', 2000, 6, 15, 12), 5.75);
  assert.equal(at('America/St_Johns', 2000, 1, 15, 12), -3.5);
  assert.equal(at('UTC', 2000, 6, 15, 12), 0);
});

test('夏令时：北半球', () => {
  assert.equal(offsetForLocalTime('America/New_York', 1990, 7, 1, 8).hours, -4);
  assert.equal(offsetForLocalTime('America/New_York', 1990, 1, 1, 8).hours, -5);
  assert.equal(offsetForLocalTime('Europe/London', 2015, 7, 1, 8).hours, 1);
  assert.equal(offsetForLocalTime('Europe/London', 2015, 1, 1, 8).hours, 0);
});

test('夏令时：南半球（与北半球季节相反）', () => {
  assert.equal(offsetForLocalTime('Australia/Sydney', 2015, 1, 15, 12).hours, 11);
  assert.equal(offsetForLocalTime('Australia/Sydney', 2015, 7, 15, 12).hours, 10);
});

test('历史时区变更：中国 1986–1991 年夏令时', () => {
  // 这是手填 UTC 最容易错、且足以改变时柱的情形
  assert.equal(offsetForLocalTime('Asia/Shanghai', 1985, 7, 1, 8).hours, 8, '1985 尚未实行');
  assert.equal(offsetForLocalTime('Asia/Shanghai', 1986, 7, 1, 8).hours, 9, '1986 实行');
  assert.equal(offsetForLocalTime('Asia/Shanghai', 1990, 7, 1, 8).hours, 9, '1990 实行');
  assert.equal(offsetForLocalTime('Asia/Shanghai', 1992, 7, 1, 8).hours, 8, '1992 已废止');
  assert.equal(offsetForLocalTime('Asia/Shanghai', 1988, 1, 1, 8).hours, 8, '冬季不实行');
});

test('标准时之前使用地方平太阳时', () => {
  const off = offsetForLocalTime('Asia/Shanghai', 1890, 5, 5, 12);
  assert.ok(off.minutes > 480 && off.minutes < 495, `1890 上海偏移 ${off.minutes} 分`);
});

test('夏令时切换：不存在与重复的本地时间会被标记', () => {
  // 美国 2015-03-08 02:30 不存在（前拨）
  const gap = offsetForLocalTime('America/New_York', 2015, 3, 8, 2, 30);
  assert.equal(gap.nonexistent, true, '应识别为不存在的本地时间');
  // 美国 2015-11-01 01:30 出现两次（回拨）
  const dup = offsetForLocalTime('America/New_York', 2015, 11, 1, 1, 30);
  assert.equal(dup.nonexistent, false);
  assert.equal(dup.ambiguous, true, '应识别为歧义时间');
  // 正常时间两个标记都为假
  const normal = offsetForLocalTime('America/New_York', 2015, 6, 1, 12, 0);
  assert.equal(normal.ambiguous, false);
  assert.equal(normal.nonexistent, false);
});

test('offsetAtInstant 与 offsetForLocalTime 自洽', () => {
  for (const tz of ['Asia/Shanghai', 'America/New_York', 'Europe/Paris', 'Australia/Sydney', 'Asia/Kolkata']) {
    for (const [y, m, d, h] of [[2001, 3, 20, 9], [2010, 8, 8, 15], [1975, 12, 1, 6]]) {
      const r = offsetForLocalTime(tz, y, m, d, h);
      const instant = new Date(Date.UTC(y, m - 1, d, h) - r.minutes * 60000);
      assert.equal(offsetAtInstant(tz, instant), r.minutes, `${tz} ${y}-${m}-${d}`);
    }
  }
});

test('偏移格式化', () => {
  assert.equal(formatOffset(480), 'UTC+08:00');
  assert.equal(formatOffset(345), 'UTC+05:45');
  assert.equal(formatOffset(-300), 'UTC−05:00');
  assert.equal(formatOffset(-210), 'UTC−03:30');
  assert.equal(formatOffset(0), 'UTC+00:00');
});

// ————————————————————— 真太阳时 —————————————————————
test('真太阳时校正：符号与量级', () => {
  const beijing = byName('Beijing', 'CN');
  const r = resolveBirthLocation(beijing, { year: 2000, month: 6, day: 15, hour: 12 });
  // 北京在东经 116.4°，时区中央经线 120°，偏西 3.6° → 真太阳时比钟表慢约 14 分钟
  assert.equal(r.tzHours, 8);
  assert.ok(r.solarCorrectionMinutes < -13 && r.solarCorrectionMinutes > -16,
    `校正 ${r.solarCorrectionMinutes} 分`);
});

test('真太阳时校正：位于时区中央经线上时接近零', () => {
  // 找一座经度接近 120°E 且用 UTC+8 的城市
  const c = cities.find((x) => x.tz === 'Asia/Shanghai' && Math.abs(x.lon - 120) < 0.15);
  assert.ok(c, '未找到接近 120°E 的参照城市');
  const r = resolveBirthLocation(c, { year: 2000, month: 6, day: 15, hour: 12 });
  assert.ok(Math.abs(r.solarCorrectionMinutes) < 1, `校正 ${r.solarCorrectionMinutes} 分`);
});

test('真太阳时校正：夏令时会把校正量整体推移一小时', () => {
  const beijing = byName('Beijing', 'CN');
  const normal = resolveBirthLocation(beijing, { year: 1992, month: 7, day: 1, hour: 8 });
  const dst = resolveBirthLocation(beijing, { year: 1990, month: 7, day: 1, hour: 8 });
  assert.ok(Math.abs((normal.solarCorrectionMinutes - dst.solarCorrectionMinutes) - 60) < 0.1,
    `${normal.solarCorrectionMinutes} vs ${dst.solarCorrectionMinutes}`);
});

test('大幅真太阳时校正是真实存在的，且有理论上限', () => {
  // 理论上限：一个时区最宽跨 ±45° 经度（如中国全境单一时区），对应 ±180 分钟。
  // 超出该范围即说明经度或时区数据有误。
  let worst = null;
  let sum = 0;
  for (const c of cities) {
    const r = resolveBirthLocation(c, { year: 2000, month: 6, day: 15, hour: 12 });
    sum += Math.abs(r.solarCorrectionMinutes);
    if (!worst || Math.abs(r.solarCorrectionMinutes) > Math.abs(worst.v)) {
      worst = { name: c.name, cc: c.cc, v: r.solarCorrectionMinutes };
    }
  }
  assert.ok(Math.abs(worst.v) <= 180,
    `${worst.name}(${worst.cc}) 校正 ${worst.v} 分，超出理论上限`);
  // 绝大多数城市的校正应在半小时内——均值过大说明时区分配整体出错
  // 均值约 46 分：抽样日期取在北半球夏季，欧美各国处于夏令时，中央经线整体东移 15°，
  // 叠加中国、印度、西班牙、阿根廷等「时区与经度不匹配」的国家，这个量级是正常的。
  assert.ok(sum / cities.length < 60, `全库平均校正 ${(sum / cities.length).toFixed(1)} 分，偏大`);
});

test('中国单一时区导致西部出生者的校正超过一个时辰', () => {
  // 这不是 bug，而是必须被正确处理的现实：新疆、西藏使用北京时间，
  // 当地真太阳时比钟表时间慢两小时以上，足以把时柱推前一整个时辰。
  const kashgar = byName('Kashgar', 'CN');
  const r = resolveBirthLocation(kashgar, { year: 2000, month: 6, day: 15, hour: 12 });
  assert.equal(r.tzHours, 8, '喀什按北京时间计算');
  assert.ok(r.solarCorrectionMinutes < -120,
    `喀什校正应小于 −120 分，实得 ${r.solarCorrectionMinutes}`);

  // 同一钟表时间下，喀什与北京的时柱应当不同
  const mk = (c) => buildBirthChart({
    year: 2000, month: 6, day: 15, hour: 12, minute: 0,
    timezone: c.tz, lonEast: c.lon, latNorth: c.lat,
  });
  assert.notEqual(mk(kashgar).chinese.pillars.hour.name, mk(byName('Beijing', 'CN')).chinese.pillars.hour.name);
});

test('换日线附近的经度差被正确归一', () => {
  // 汤加位于西经 175° 却使用 UTC+13（中央经线 195°）。
  // 若不把经差归一到 ±180°，会得到 −370° 即 −24.7 小时的荒谬校正。
  const tonga = cities.find((c) => c.cc === 'TO');
  assert.ok(tonga, '库中应有汤加的城市');
  const r = resolveBirthLocation(tonga, { year: 2000, month: 6, day: 15, hour: 12 });
  assert.ok(Math.abs(r.solarCorrectionMinutes) < 90,
    `汤加校正 ${r.solarCorrectionMinutes} 分，说明经差未归一`);

  // 排盘层（bazi.js）用的是同一套校正，必须同样正确
  const chart = buildBirthChart({
    year: 2000, month: 6, day: 15, hour: 12, minute: 0,
    timezone: tonga.tz, lonEast: tonga.lon, latNorth: tonga.lat,
  });
  assert.ok(chart.chinese.solarHour >= 0 && chart.chinese.solarHour < 24,
    `真太阳时 ${chart.chinese.solarHour} 越界`);
  assert.ok(Math.abs(chart.chinese.solarHour - 12) < 2,
    `汤加正午的真太阳时应接近 12，实得 ${chart.chinese.solarHour}`);
});

test('中国城市统一按北京时间，因为出生记录用的是北京时间', () => {
  // GeoNames 依 IANA 给新疆标 Asia/Urumqi(UTC+6)，那是民间习惯用时；
  // 而出生证明、户籍与医院记录全国一律使用北京时间，使用者报出的时刻属于后者。
  // 按 UTC+6 计算会整体错两小时，足以错两个时辰。
  const cn = cities.filter((c) => c.cc === 'CN');
  assert.ok(cn.length > 800);
  for (const c of cn) assert.equal(c.tz, 'Asia/Shanghai', `${c.name} 时区应为北京时间`);
  // 邻国不受影响，仍用各自时区
  assert.equal(byName('Tokyo', 'JP').tz, 'Asia/Tokyo');
  assert.equal(byName('Seoul', 'KR').tz, 'Asia/Seoul');
  assert.equal(byName('Hong Kong', 'HK').tz, 'Asia/Hong_Kong');
});

// ————————————————————— 检索 —————————————————————
test('中英文与变音符号都能检索', () => {
  const hit = (q) => searchCities(index, q, { limit: 1 })[0];
  assert.equal(hit('北京').name, 'Beijing');
  assert.equal(hit('Beijing').name, 'Beijing');
  assert.equal(hit('上海').name, 'Shanghai');
  assert.equal(hit('乌鲁木齐').name, 'Ürümqi');
  assert.equal(hit('urumqi').name, 'Ürümqi', '去变音符号后应能匹配');
  assert.equal(hit('Ürümqi').name, 'Ürümqi');
  assert.equal(hit('纽约').name, 'New York City');
  assert.equal(hit('sao paulo').name, 'São Paulo');
  assert.equal(hit('苏黎世').name, 'Zürich', '繁简别名也应命中');
});

test('前缀匹配优先于包含匹配', () => {
  const r = searchCities(index, 'york', { limit: 20 });
  assert.ok(r.length > 1);
  // "York" 本体应排在 "New York" 之类的包含匹配之前
  assert.ok(r.findIndex((c) => c.name === 'York') < r.findIndex((c) => c.name === 'New York City'));
});

test('检索可限定国家并遵守 limit', () => {
  const all = searchCities(index, 'san', { limit: 50 });
  const us = searchCities(index, 'san', { limit: 50, cc: 'US' });
  assert.ok(us.length > 0 && us.length <= all.length);
  assert.ok(us.every((c) => c.cc === 'US'));
  assert.ok(searchCities(index, 'a', { limit: 7 }).length <= 7);
});

test('空查询返回空结果', () => {
  assert.deepEqual(searchCities(index, ''), []);
  assert.deepEqual(searchCities(index, '   '), []);
});

test('最近城市兜底', () => {
  const r = nearestCity(cities, 39.91, 116.40);
  assert.equal(r.city.name, 'Beijing');
  assert.ok(r.degrees < 0.2);
  const far = nearestCity(cities, 31.0, 121.0); // 上海附近的水域
  assert.ok(far.degrees < 3, '应能找到附近城市');
});

// ————————————————————— 中文显示名的正确性 —————————————————————
test('中文显示名正确（含此前出错的用例）', () => {
  const expect = [
    ['Beijing', 'CN', '北京'], ['Shanghai', 'CN', '上海'],
    ['Shenzhen', 'CN', '深圳'], ['Ürümqi', 'CN', '乌鲁木齐'],
    ['Lhasa', 'CN', '拉萨'], ['Kashgar', 'CN', '喀什'],
    ['Hong Kong', 'HK', '香港'], ['Macau', 'MO', '澳门'],
    ['Tokyo', 'JP', '东京'], ['Seoul', 'KR', '首尔'],
    ['New York City', 'US', '纽约'], ['London', 'GB', '伦敦'],
    ['Zürich', 'CH', '苏黎世'], ['Geneva', 'CH', '日内瓦'],
    ['Köln', 'DE', '科隆'], ['Munich', 'DE', '慕尼黑'],
  ];
  for (const [name, cc, zh] of expect) {
    const c = byName(name, cc);
    assert.ok(c, `${name} 不在库中`);
    assert.equal(c.zh, zh, `${name} 的中文名`);
  }
});

test('中文显示名不会是单字简称', () => {
  // 上海的别名里含「沪」，曾被最短规则误选
  const singles = cities.filter((c) => c.zh && [...c.zh].length === 1 && !['JP', 'KR', 'KP'].includes(c.cc));
  assert.equal(singles.length, 0, `出现单字中文名：${singles.slice(0, 5).map((c) => `${c.zh}/${c.name}`).join(' ')}`);
});

test('非汉字圈城市不显示未经校订的中文名', () => {
  // GeoNames 的 alternatenames 会混入别的城市的名字（Zürich 里有「日内瓦」、Köln 里有「古龍」），
  // 因此非汉字圈只信任人工校订表；宁可不显示，也不显示错的。
  const SINO = new Set(['CN', 'TW', 'HK', 'MO', 'JP', 'KR', 'KP', 'SG', 'VN']);
  const foreignWithZh = cities.filter((c) => c.zh && !SINO.has(c.cc));
  assert.ok(foreignWithZh.length > 0 && foreignWithZh.length < 300,
    `非汉字圈带中文名的城市有 ${foreignWithZh.length} 座，应为人工校订的有限集合`);
  // 抽查：这些名字都必须是我们主动校订过的常见城市，不能是启发式产物
  assert.equal(byName('Zürich', 'CH').han.includes('日内瓦'), false, '错误别名不应留在 Zürich 的搜索键里作为显示名');
});

test('cityLabel 在无中文名时只显示原名', () => {
  const withZh = byName('Beijing', 'CN');
  assert.equal(cityLabel(withZh), '北京（Beijing）');
  const noZh = cities.find((c) => !c.zh);
  assert.ok(noZh);
  assert.equal(cityLabel(noZh), noZh.name);
});

// ————————————————————— 与排盘的集成 —————————————————————
test('buildBirthChart 接受 IANA 时区并自动解析偏移', () => {
  const c = byName('Beijing', 'CN');
  const chart = buildBirthChart({
    year: 2000, month: 6, day: 15, hour: 8, minute: 30,
    timezone: c.tz, lonEast: c.lon, latNorth: c.lat,
  });
  assert.equal(chart.timezone.name, 'Asia/Shanghai');
  assert.equal(chart.timezone.offsetHours, 8);
  assert.ok(chart.timezone.solarCorrectionMinutes < 0);
  assert.equal(chart.input.tzHours, 8);
});

test('自动解析与手填相同偏移时结果完全一致', () => {
  const c = byName('Beijing', 'CN');
  const base = { year: 2000, month: 6, day: 15, hour: 8, minute: 30, lonEast: c.lon, latNorth: c.lat };
  const auto = buildBirthChart({ ...base, timezone: c.tz });
  const manual = buildBirthChart({ ...base, tzHours: 8 });
  for (const k of ['year', 'month', 'day', 'hour']) {
    assert.equal(auto.chinese.pillars[k].name, manual.chinese.pillars[k].name, `${k}柱`);
  }
  assert.equal(auto.western.ascendant.sign.zh, manual.western.ascendant.sign.zh);
});

test('历史夏令时会改变时柱——这正是自动解析的价值', () => {
  const c = byName('Beijing', 'CN');
  const base = { year: 1988, month: 7, day: 1, hour: 8, minute: 0, lonEast: c.lon, latNorth: c.lat };
  const auto = buildBirthChart({ ...base, timezone: c.tz });   // 自动得 UTC+9
  const naive = buildBirthChart({ ...base, tzHours: 8 });       // 使用者手填 +8（错误）
  assert.equal(auto.timezone.offsetHours, 9);
  assert.notEqual(auto.chinese.pillars.hour.name, naive.chinese.pillars.hour.name,
    '1988 年的北京若按 +8 计算，时柱应当不同');
  assert.equal(auto.chinese.pillars.hour.name, '癸卯');
  assert.equal(naive.chinese.pillars.hour.name, '甲辰');
});

test('未提供时区时退回默认值，不抛异常', () => {
  const chart = buildBirthChart({ year: 2000, month: 6, day: 15, hour: 8 });
  assert.equal(chart.timezone, null);
  assert.equal(chart.input.tzHours, 8);
  assert.ok(chart.chinese.pillars.day.name.length === 2);
});

test('跨时区抽样排盘均不产生异常值', () => {
  const sample = ['Beijing', 'New York City', 'London', 'Sydney', 'Kathmandu', 'São Paulo', 'Ürümqi', 'Reykjavík'];
  for (const n of sample) {
    const c = cities.find((x) => x.name === n);
    if (!c) continue;
    const chart = buildBirthChart({
      year: 1995, month: 3, day: 21, hour: 14, minute: 15,
      timezone: c.tz, lonEast: c.lon, latNorth: c.lat,
    });
    assert.ok(Number.isFinite(chart.jd), `${n} 儒略日`);
    assert.ok(chart.western.ascendant, `${n} 上升点缺失`);
    assert.match(chart.chinese.pillars.hour.name, /^.{2}$/, `${n} 时柱`);
    assert.ok(Math.abs(chart.timezone.solarCorrectionMinutes) < 150, `${n} 真太阳时校正异常`);
  }
});
