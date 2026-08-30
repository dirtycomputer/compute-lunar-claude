/**
 * numerology.js — 数字与符号历层 / Numerology & symbolic-calendar layer
 * 生命灵数（毕达哥拉斯派）、表达数、玛雅卓尔金、人类图闸门轮（近似）、卢恩生日符。
 */

import { tzolkin, norm360 } from './astro.js';

/** 数字根，保留大师数 11/22/33 */
export function digitalRoot(n, keepMaster = true) {
  let x = Math.abs(Math.trunc(n));
  while (x > 9) {
    if (keepMaster && (x === 11 || x === 22 || x === 33)) return x;
    x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

/** 生命灵数：出生年月日全部数字相加后取数字根 */
export function lifePath(year, month, day) {
  const sum = String(year).split('').reduce((s, d) => s + Number(d), 0)
    + digitalRootPlain(month) + digitalRootPlain(day);
  return digitalRoot(sum);
}
const digitalRootPlain = (n) => String(n).split('').reduce((s, d) => s + Number(d), 0);

/** 生日数（day 的数字根）与个人年数 */
export const birthdayNumber = (day) => digitalRoot(day);
export function personalYear(year, month, day, targetYear) {
  return digitalRoot(digitalRootPlain(month) + digitalRootPlain(day) + digitalRootPlain(targetYear));
}
void 0;

const PYTHAGOREAN = {
  A: 1, J: 1, S: 1, B: 2, K: 2, T: 2, C: 3, L: 3, U: 3, D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5, F: 6, O: 6, X: 6, G: 7, P: 7, Y: 7, H: 8, Q: 8, Z: 8,
  I: 9, R: 9,
};
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * 表达数 / 灵魂数 / 人格数（仅支持拉丁字母拼写）。
 * 中文姓名的「三才五格」需要康熙笔画字典，本仓库未内置，故返回 null 并注明。
 */
export function nameNumbers(name = '') {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return { supported: false, note: '中文姓名的三才五格需康熙笔画字典，未内置；请填写拉丁拼写以启用。' };
  let expr = 0; let soul = 0; let pers = 0;
  for (const ch of letters) {
    const val = PYTHAGOREAN[ch] || 0;
    expr += val;
    if (VOWELS.has(ch)) soul += val; else pers += val;
  }
  return {
    supported: true,
    expression: digitalRoot(expr),
    soulUrge: digitalRoot(soul),
    personality: digitalRoot(pers),
  };
}

/** 人类图 / 基因钥匙闸门轮（近似）：Gate 41 起于黄经 302°，每闸 5.625° */
export const HD_GATE_WHEEL = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
];

export function hdGate(longitude) {
  const off = norm360(longitude - 302);
  const idx = Math.floor(off / 5.625);
  const within = off - idx * 5.625;
  return {
    gate: HD_GATE_WHEEL[idx],
    line: Math.min(6, Math.floor(within / (5.625 / 6)) + 1),
    approximate: true,
  };
}

/** 生日卢恩（Elder Futhark 24 符，按年内日序整除） */
export const ELDER_FUTHARK = [
  'ᚠ Fehu', 'ᚢ Uruz', 'ᚦ Thurisaz', 'ᚨ Ansuz', 'ᚱ Raidho', 'ᚲ Kenaz',
  'ᚷ Gebo', 'ᚹ Wunjo', 'ᚺ Hagalaz', 'ᚾ Nauthiz', 'ᛁ Isa', 'ᛃ Jera',
  'ᛇ Eihwaz', 'ᛈ Perthro', 'ᛉ Algiz', 'ᛋ Sowilo', 'ᛏ Tiwaz', 'ᛒ Berkano',
  'ᛖ Ehwaz', 'ᛗ Mannaz', 'ᛚ Laguz', 'ᛜ Ingwaz', 'ᛞ Dagaz', 'ᛟ Othala',
];
export const birthRune = (jdn) => ELDER_FUTHARK[((Math.round(jdn) % 24) + 24) % 24];

/** 凯尔特树历（13 月，近似按公历日期段） */
const CELTIC_TREES = [
  [12, 24, '桦 Birch'], [1, 21, '花楸 Rowan'], [2, 18, '梣 Ash'], [3, 18, '桤 Alder'],
  [4, 15, '柳 Willow'], [5, 13, '山楂 Hawthorn'], [6, 10, '橡 Oak'], [7, 8, '冬青 Holly'],
  [8, 5, '榛 Hazel'], [9, 2, '葡萄 Vine'], [9, 30, '常春藤 Ivy'], [10, 28, '芦苇 Reed'],
  [11, 25, '接骨木 Elder'],
];
export function celticTree(month, day) {
  let pick = CELTIC_TREES[0];
  for (const t of CELTIC_TREES) {
    if (month > t[0] || (month === t[0] && day >= t[1])) pick = t;
  }
  if (month === 12 && day >= 24) pick = CELTIC_TREES[0];
  return pick[2];
}

export { tzolkin };
