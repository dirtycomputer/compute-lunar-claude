#!/usr/bin/env node
/**
 * 由 src/data/systems.js 生成 docs/01 中的排名表，避免手工誊写产生偏差。
 * 用法：node scripts/gen-ranking.js
 * 表格会被写入 docs/01-world-systems-ranking.md 中的
 *   <!-- BEGIN:RANKING --> … <!-- END:RANKING --> 标记之间。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { rankedSystems, FAMILY_LABELS, WEIGHTS } from '../src/data/systems.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs/01-world-systems-ranking.md');

const esc = (s) => String(s).replace(/\|/g, '\\|');

const rows = rankedSystems().map((s) => `| ${s.rank} | **${esc(s.zh)}**<br>${esc(s.en)} | ${esc(s.region)} | ${esc(s.era)} | ${FAMILY_LABELS[s.family].zh} | ${s.reach} | ${s.active} | ${s.commerce} | ${s.institution} | ${s.academia} | **${s.influence.toFixed(1)}** | ${esc(s.mechanism)} | ${esc(s.omlUse)} |`);

const table = [
  `> 影响指数 I = ${Object.entries(WEIGHTS).map(([k, w]) => `${w}·${({ reach: '认知人口', active: '活跃使用', commerce: '商业规模', institution: '制度嵌入', academia: '学术支持' })[k]}`).join(' + ')}`,
  '',
  '| # | 体系 | 区域 | 年代 | 类别 | 认知 | 活跃 | 商业 | 制度 | 学术 | 影响指数 | 输入 → 输出 | 在 OML 中的角色 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
].join('\n');

const src = await readFile(DOC, 'utf8');
const out = src.replace(
  /<!-- BEGIN:RANKING -->[\s\S]*?<!-- END:RANKING -->/,
  `<!-- BEGIN:RANKING -->\n<!-- 本表由 scripts/gen-ranking.js 自动生成，请勿手工编辑 -->\n\n${table}\n\n<!-- END:RANKING -->`,
);
await writeFile(DOC, out);
console.log(`已写入 ${rows.length} 行排名表 → docs/01-world-systems-ranking.md`);
