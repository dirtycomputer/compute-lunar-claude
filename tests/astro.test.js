import test from 'node:test';
import assert from 'node:assert/strict';
import {
  julianDay, fromJulianDay, sunLongitude, moonLongitude, ascendantMC,
  signOf, signIndex, norm360, tzolkin, lunarPhase, solarTermOf, solveSunLongitude,
  obliquity, gmst,
} from '../src/core/astro.js';

test('儒略日锚点', () => {
  assert.equal(julianDay(2000, 1, 1.5), 2451545.0); // J2000.0
  assert.equal(julianDay(1999, 1, 1), 2451179.5);
  assert.equal(julianDay(1987, 1, 27), 2446822.5); // Meeus 例 7.a
  assert.equal(julianDay(837, 4, 10.3), 2026871.8); // 儒略历分支
});

test('儒略日往返', () => {
  for (const [y, m, d] of [[2024, 2, 29], [1900, 3, 1], [1582, 10, 15], [2100, 12, 31]]) {
    const back = fromJulianDay(julianDay(y, m, d));
    assert.equal(back.year, y);
    assert.equal(back.month, m);
    assert.ok(Math.abs(back.day - d) < 1e-6, `${y}-${m}-${d}`);
  }
});

test('太阳黄经：春分点附近应接近 0°', () => {
  // 2024 春分 ≈ 3 月 20 日 03:06 UT
  const jd = julianDay(2024, 3, 20 + 3.1 / 24);
  const lon = sunLongitude(jd);
  assert.ok(Math.min(lon, 360 - lon) < 0.05, `春分黄经 ${lon}`);
});

test('太阳黄经：四季点落在正确星座', () => {
  assert.equal(signOf(sunLongitude(julianDay(2023, 6, 22))).en, 'Cancer');
  assert.equal(signOf(sunLongitude(julianDay(2023, 9, 25))).en, 'Libra');
  assert.equal(signOf(sunLongitude(julianDay(2023, 12, 25))).en, 'Capricorn');
  assert.equal(signOf(sunLongitude(julianDay(2023, 8, 10))).en, 'Leo');
});

test('太阳黄经每日推进约 1°', () => {
  const a = sunLongitude(julianDay(2020, 5, 1));
  const b = sunLongitude(julianDay(2020, 5, 2));
  const step = norm360(b - a);
  assert.ok(step > 0.94 && step < 1.03, `日行 ${step}`);
});

test('月亮黄经：朔望周期约 29.53 日', () => {
  const jd0 = julianDay(2024, 1, 11 + 11.6 / 24); // 2024-01-11 新月
  const p = lunarPhase(jd0);
  assert.ok(p.illumination < 0.02, `新月照度 ${p.illumination}`);
  const later = lunarPhase(jd0 + 29.5306);
  assert.ok(later.illumination < 0.05, `一个朔望月后照度 ${later.illumination}`);
  const full = lunarPhase(jd0 + 29.5306 / 2);
  assert.ok(full.illumination > 0.95, `望月照度 ${full.illumination}`);
});

test('月亮黄经每日推进约 13°', () => {
  const step = norm360(moonLongitude(julianDay(2021, 7, 6)) - moonLongitude(julianDay(2021, 7, 5)));
  assert.ok(step > 11.5 && step < 15.5, `月行 ${step}`);
});

test('黄赤交角在合理范围', () => {
  const eps = obliquity(julianDay(2020, 1, 1));
  assert.ok(eps > 23.4 && eps < 23.45, `ε=${eps}`);
});

test('恒星时在 0–360 且随时间推进', () => {
  const a = gmst(julianDay(2020, 1, 1));
  const b = gmst(julianDay(2020, 1, 1.25));
  assert.ok(a >= 0 && a < 360 && b >= 0 && b < 360);
  assert.ok(Math.abs(norm360(b - a) - 90.24) < 0.5);
});

test('上升点：始终有效，且一天内绕行黄道一周', () => {
  const seen = new Set();
  for (let h = 0; h < 24; h += 1) {
    const { asc, mc } = ascendantMC(julianDay(1990, 6, 15 + h / 24), 116.4, 39.9);
    assert.ok(asc >= 0 && asc < 360, `asc=${asc}`);
    assert.ok(mc >= 0 && mc < 360);
    seen.add(signIndex(asc));
  }
  assert.equal(seen.size, 12, '24 小时内上升点应扫过全部 12 星座');
});

test('上升点：极区不产生 NaN', () => {
  const { asc } = ascendantMC(julianDay(2000, 1, 1), 20, 78.2); // 斯瓦尔巴
  assert.ok(Number.isFinite(asc));
});

test('上升点与中天保持合理夹角（北半球中纬）', () => {
  const { asc, mc } = ascendantMC(julianDay(1995, 4, 20 + 9 / 24), 121.5, 31.2);
  const d = norm360(asc - mc);
  assert.ok(d > 30 && d < 200, `ASC−MC=${d}`);
});

test('卓尔金历：长纪元零点为 4 Ahau', () => {
  const t = tzolkin(584283);
  assert.equal(t.number, 4);
  assert.ok(t.name.startsWith('Ahau'));
});

test('卓尔金历 260 日循环', () => {
  const a = tzolkin(2451545);
  const b = tzolkin(2451545 + 260);
  assert.equal(a.name, b.name);
  assert.equal(a.number, b.number);
});

test('节气：冬至前后落在冬至段', () => {
  assert.equal(solarTermOf(julianDay(2023, 12, 25)).name, '冬至');
  assert.equal(solarTermOf(julianDay(2024, 2, 10)).name, '立春');
  assert.equal(solarTermOf(julianDay(2024, 6, 25)).name, '夏至');
});

test('节气求解：立春（315°）落在 2 月 3–5 日', () => {
  const jd = solveSunLongitude(315, julianDay(2024, 2, 4));
  const { month, day } = fromJulianDay(jd + 8 / 24);
  assert.equal(month, 2);
  assert.ok(day >= 3 && day < 6, `立春 ${month}-${day}`);
});
