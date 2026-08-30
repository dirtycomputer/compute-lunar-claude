import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBazi, fourPillars, STEMS, BRANCHES, HIDDEN_STEMS, tenGod,
  branchRelation, gzIndexOf, nayinOf, ELEMENTS, STEM_ELEMENT,
} from '../src/core/bazi.js';

const at = (y, m, d, h = 12) => analyzeBazi({ year: y, month: m, day: d, hour: h, tzHours: 8, lonEast: 120 });

test('日柱锚点：1949-10-01 为甲子日', () => {
  assert.equal(at(1949, 10, 1).pillars.day.name, '甲子');
});

test('日柱锚点：2000-01-01 为戊午日', () => {
  assert.equal(at(2000, 1, 1).pillars.day.name, '戊午');
});

test('日柱连续推进：相邻两日干支序 +1', () => {
  const a = at(2021, 5, 10).pillars.day;
  const b = at(2021, 5, 11).pillars.day;
  assert.equal((a.gz + 1) % 60, b.gz);
});

test('日柱跨月跨年连续', () => {
  assert.equal((at(2023, 12, 31).pillars.day.gz + 1) % 60, at(2024, 1, 1).pillars.day.gz);
  assert.equal((at(2024, 2, 28).pillars.day.gz + 1) % 60, at(2024, 2, 29).pillars.day.gz);
});

test('年柱以立春换年，不以正月初一', () => {
  // 2024 立春在 2 月 4 日；春节在 2 月 10 日
  assert.equal(at(2024, 2, 3).pillars.year.name, '癸卯');
  assert.equal(at(2024, 2, 6).pillars.year.name, '甲辰');
  assert.equal(at(2024, 2, 10).pillars.year.name, '甲辰'); // 春节当日已是甲辰
  // 1 月 1 日仍属上一命理年
  assert.equal(at(2000, 1, 1).pillars.year.name, '己卯');
  assert.equal(at(1984, 6, 1).pillars.year.name, '甲子');
});

test('生肖跟随立春换年', () => {
  assert.equal(at(2024, 2, 3).zodiac, '兔');
  assert.equal(at(2024, 2, 6).zodiac, '龙');
});

test('月柱五虎遁：甲己之年丙作首', () => {
  // 甲年（1984）寅月应为丙寅
  const c = at(1984, 2, 20);
  assert.equal(c.pillars.month.name, '丙寅');
  // 己年（2019）寅月亦为丙寅
  assert.equal(at(2019, 2, 20).pillars.month.name, '丙寅');
  // 乙年（1985）寅月为戊寅
  assert.equal(at(1985, 2, 20).pillars.month.name, '戊寅');
});

test('月支由节气而非公历月决定', () => {
  // 清明（4/5 前后）前后由卯月转辰月
  assert.equal(BRANCHES[at(2023, 4, 3).pillars.month.branch], '卯');
  assert.equal(BRANCHES[at(2023, 4, 8).pillars.month.branch], '辰');
});

test('时柱五鼠遁：甲日起甲子时', () => {
  const day = at(1949, 10, 1, 0); // 甲子日 子时
  assert.equal(day.pillars.day.name, '甲子');
  assert.equal(day.pillars.hour.name, '甲子');
  assert.equal(at(1949, 10, 1, 12).pillars.hour.name, '庚午');
});

test('晚子时进位到次日日柱', () => {
  const before = analyzeBazi({ year: 2000, month: 1, day: 1, hour: 22, tzHours: 8, lonEast: 120 });
  const after = analyzeBazi({ year: 2000, month: 1, day: 1, hour: 23, minute: 30, tzHours: 8, lonEast: 120 });
  assert.equal(before.pillars.day.name, '戊午');
  assert.equal(after.pillars.day.name, '己未');
});

test('真太阳时校正影响时柱', () => {
  const base = { year: 1990, month: 6, day: 15, hour: 12, minute: 55, tzHours: 8 };
  const east = fourPillars({ ...base, lonEast: 130 }, { trueSolarTime: true });
  const west = fourPillars({ ...base, lonEast: 100 }, { trueSolarTime: true });
  assert.notEqual(east.pillars.hour.name, west.pillars.hour.name);
});

test('五行权重归一且非负', () => {
  const c = at(1993, 8, 21, 6);
  const sum = c.elements.ratio.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `sum=${sum}`);
  assert.ok(c.elements.ratio.every((r) => r >= 0));
  assert.ok(ELEMENTS.includes(c.elements.dominantName));
});

test('藏干表完备：12 地支均有主气且权重合计为 1', () => {
  for (const b of BRANCHES) {
    const hs = HIDDEN_STEMS[b];
    assert.ok(hs && hs.length >= 1, b);
    const w = hs.reduce((s, [, x]) => s + x, 0);
    assert.ok(Math.abs(w - 1) < 1e-9, `${b} 权重合计 ${w}`);
    for (const [s] of hs) assert.ok(STEMS.includes(s), `${b} 藏干 ${s}`);
  }
});

test('十神判定正确', () => {
  const jia = STEMS.indexOf('甲');
  assert.equal(tenGod(jia, STEMS.indexOf('甲')), '比肩');
  assert.equal(tenGod(jia, STEMS.indexOf('乙')), '劫财');
  assert.equal(tenGod(jia, STEMS.indexOf('丙')), '食神'); // 木生火，同为阳
  assert.equal(tenGod(jia, STEMS.indexOf('丁')), '伤官');
  assert.equal(tenGod(jia, STEMS.indexOf('戊')), '偏财'); // 木克土，同阳
  assert.equal(tenGod(jia, STEMS.indexOf('己')), '正财');
  assert.equal(tenGod(jia, STEMS.indexOf('庚')), '七杀'); // 金克木，同阳
  assert.equal(tenGod(jia, STEMS.indexOf('辛')), '正官');
  assert.equal(tenGod(jia, STEMS.indexOf('壬')), '偏印'); // 水生木，同阳
  assert.equal(tenGod(jia, STEMS.indexOf('癸')), '正印');
});

test('干支组合合法：阴阳同性', () => {
  for (let i = 0; i < 60; i += 1) {
    assert.equal(i % 2, (i % 10) % 2);
    assert.equal(gzIndexOf(i % 10, i % 12), i);
  }
});

test('纳音：甲子乙丑海中金', () => {
  assert.equal(nayinOf(0), '海中金');
  assert.equal(nayinOf(1), '海中金');
  assert.equal(nayinOf(2), '炉中火');
});

test('地支关系：六合、六冲、三合、相刑', () => {
  assert.ok(branchRelation('子', '丑').tags.includes('六合'));
  assert.ok(branchRelation('子', '午').tags.includes('六冲'));
  assert.ok(branchRelation('申', '子').score > 0);
  assert.ok(branchRelation('寅', '巳').tags.includes('相刑'));
  // 对称性
  for (const a of BRANCHES) {
    for (const b of BRANCHES) {
      assert.equal(branchRelation(a, b).score, branchRelation(b, a).score, `${a}${b}`);
    }
  }
});

test('日主强弱标签在有限集合内', () => {
  const labels = new Set(['身强', '偏强', '中和', '偏弱', '身弱']);
  for (let y = 1970; y < 2020; y += 7) {
    const c = at(y, (y % 12) + 1, (y % 27) + 1, y % 24);
    assert.ok(labels.has(c.strength.label));
    assert.ok(c.strength.favorable.length > 0);
    assert.ok(STEM_ELEMENT[c.dayMaster.index] === c.dayMaster.elementIndex);
  }
});

test('六十甲子在长期序列中均匀出现', () => {
  const seen = new Set();
  for (let d = 0; d < 60; d += 1) {
    seen.add(analyzeBazi({ year: 2020, month: 1, day: 1 + d, hour: 12, tzHours: 8 }).pillars.day.gz);
  }
  assert.equal(seen.size, 60);
});
