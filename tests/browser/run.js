#!/usr/bin/env node
/**
 * 浏览器端到端测试：启动静态服务器 + Chromium，逐页验证渲染与交互。
 * 任何页面的 console error / pageerror 都会导致失败。
 * 运行：npm run test:browser
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SHOTS = join(HERE, 'screenshots');
const PORT = Number(process.env.OML_TEST_PORT || 8137);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed += 1; console.log(`  ✓ ${name}`); } else { failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
};

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const run = async () => {
  await mkdir(SHOTS, { recursive: true });
  const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.js'), String(PORT), ROOT], { stdio: 'ignore' });
  const stop = () => { try { server.kill(); } catch { /* ignore */ } };
  process.on('exit', stop);

  if (!await waitForServer(`${BASE}/index.html`)) {
    console.error('静态服务器启动失败');
    stop();
    process.exit(1);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

  // ————————————————— 首页 —————————————————
  console.log('\n▸ index.html');
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  check('标题正确', (await page.title()).includes('OML'));
  check('导航渲染', await page.locator('header.top nav.main a').count() === 6);
  check('十二维卡片渲染 6 条轴', await page.locator('#dims .card').count() === 6);
  check('影响力前十表格', await page.locator('#top10 tbody tr').count() === 10);
  check('代码示例出现', (await page.locator('.codeplate').first().textContent()).includes('R'));
  await page.screenshot({ path: join(SHOTS, '01-index.png'), fullPage: true });

  // ————————————————— 体系普查 —————————————————
  console.log('\n▸ systems.html');
  await page.goto(`${BASE}/systems.html`, { waitUntil: 'networkidle' });
  const total = await page.locator('#tbl tbody tr').count();
  check('47 个体系全部列出', total === 47, `实得 ${total}`);
  check('第 1 名影响指数最高', Number(await page.locator('#tbl tbody tr').first().locator('td').nth(10).innerText()) > 70);
  await page.locator('#filters button').nth(1).click();
  const filtered = await page.locator('#tbl tbody tr').count();
  check('类别筛选生效', filtered > 0 && filtered < 47, `筛选后 ${filtered}`);
  await page.locator('#filters button').first().click();
  await page.locator('#tbl thead th').nth(5).click();
  check('点表头可重排', await page.locator('#tbl tbody tr').count() === 47);
  await page.screenshot({ path: join(SHOTS, '02-systems.png'), fullPage: true });

  // ————————————————— 64 型图谱 —————————————————
  console.log('\n▸ codex.html');
  await page.goto(`${BASE}/codex.html`, { waitUntil: 'networkidle' });
  check('64 型全部生成', await page.locator('#grid .card').count() === 64);
  await page.locator('#axisfilters button').first().click();
  check('按轴筛选后剩 32 型', await page.locator('#grid .card').count() === 32);
  await page.locator('#search').fill('家人');
  const searched = await page.locator('#grid .card').count();
  check('搜索卦名可定位', searched >= 1 && searched <= 4, `命中 ${searched}`);
  await page.locator('#search').fill('');
  await page.locator('#axisfilters button').first().click();
  await page.screenshot({ path: join(SHOTS, '03-codex.png'), fullPage: false });

  // ————————————————— 测评全流程 —————————————————
  console.log('\n▸ assess.html（完整流程）');
  await page.goto(`${BASE}/assess.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  check('步骤 1 出生信息表单', await page.locator('input[type="number"]').count() >= 5);
  await page.locator('input[type="number"]').nth(0).fill('1988');
  await page.locator('input[type="number"]').nth(1).fill('7');
  await page.locator('input[type="number"]').nth(2).fill('1');
  await page.locator('input[type="number"]').nth(3).fill('8');
  await page.locator('input[type="number"]').nth(4).fill('0');

  // ——— 城市选择器：搜索 → 选中 → 自动解析时区与真太阳时 ———
  await page.locator('#city-search').fill('北京');
  await page.waitForSelector('#city-results button.cityhit', { timeout: 8000 });
  const firstHit = await page.locator('#city-results button.cityhit').first().innerText();
  check('中文搜索命中北京', /北京/.test(firstHit), firstHit);
  await page.locator('#city-results button.cityhit').first().click();
  await page.waitForSelector('#geo-summary', { timeout: 5000 });

  const offset = await page.locator('#geo-offset').innerText();
  check('1988 年的北京自动解析为 UTC+09:00（当年实行夏令时）', offset === 'UTC+09:00', offset);
  const solar = await page.locator('#geo-solar').innerText();
  check('真太阳时校正已计算并显示', /-7[0-9](\.\d)? 分钟/.test(solar), solar);
  check('经度已回填', Math.abs(Number(await page.locator('#lon').inputValue()) - 116.397) < 0.01);
  check('纬度已回填', Math.abs(Number(await page.locator('#lat').inputValue()) - 39.908) < 0.01);

  // 英文检索同样可用
  await page.locator('#city-search').fill('new york');
  await page.waitForSelector('#city-results button.cityhit', { timeout: 8000 });
  const nyHit = await page.locator('#city-results button.cityhit').first().innerText();
  check('英文搜索命中纽约', /纽约|New York/.test(nyHit), nyHit);
  await page.locator('#city-search').fill('');
  await page.getByRole('button', { name: /下一步：情境题/ }).click();

  check('步骤 2 情境题', await page.locator('select').count() >= 4);
  await page.locator('select').first().selectOption('nonbinary');
  await page.getByRole('button', { name: '不限 Any' }).click();
  await page.locator('input[type="range"]').fill('0.2');
  check('λb 滑杆更新显示', (await page.locator('#lb').innerText()) === '0.2');
  await page.getByRole('button', { name: /下一步：144 题/ }).click();

  check('步骤 3 首页显示 18 题', await page.locator('.q').count() === 18);
  // 手动作答第一页前 3 题，验证交互
  for (let i = 0; i < 3; i += 1) {
    await page.locator('.q').nth(i).locator('.likert button').nth(5).click();
  }
  check('作答后移除未答标记', await page.locator('.q').nth(0).getAttribute('class') === 'q');
  check('计数器更新', (await page.locator('#counter').innerText()).includes('已答 3 / 144'));
  const barW = await page.locator('.stepbar .bar > i').evaluate((e) => e.style.width);
  check('进度条推进', parseFloat(barW) > 0, barW);

  await page.getByRole('button', { name: '演示填充' }).click();
  await page.waitForTimeout(150);
  check('演示填充完成 144 题', (await page.locator('#counter').innerText()).includes('144 / 144'));

  // 翻到最后一页并提交
  for (let i = 0; i < 8; i += 1) {
    const next = page.getByRole('button', { name: /下一页/ });
    if (await next.count() === 0) break;
    await next.click();
  }
  await page.getByRole('button', { name: /生成我的 OML 代码/ }).click();
  await page.waitForSelector('#oml-code', { timeout: 5000 });

  const code = (await page.locator('#oml-code').innerText()).replace(/\s+/g, '');
  check('OML 代码格式合法', /^[RD][LO][FC][PS][WB][MG]-[1-5][AT]$/.test(code), code);
  console.log(`    → 生成代码 ${code}`);
  check('雷达图渲染', await page.locator('svg.radar').count() >= 1);
  check('雷达图有 12 条轴', await page.locator('svg.radar line.axis').count() === 12);
  check('六轴条渲染', await page.locator('.axisrow').count() === 6);
  check('十二维卡片渲染', (await page.locator('h2:has-text("维度明细")').count()) === 1);
  const bodyText = await page.locator('body').innerText();
  check('八字四柱显示', /日柱（日主）/.test(bodyText));
  check('跨体系映射显示 MBTI', /MBTI 四轴/.test(bodyText));
  check('九型人格显示', /九型人格/.test(bodyText));
  check('依恋类型显示', /(安全型|焦虑-投入型|疏离-回避型|恐惧-回避型)/.test(bodyText));
  check('象征先验逐项贡献表', /象征先验的逐项贡献/.test(bodyText));
  check('结果页显示出生地时区', /出生地时区/.test(bodyText) && /Asia\/Shanghai/.test(bodyText));
  check('结果页显示真太阳时校正', /真太阳时校正/.test(bodyText));
  check('效度指标显示', /总体置信度/.test(bodyText));
  check('免责声明显示', /不构成命运预测/.test(bodyText));
  // 条件渲染片段若返回 null/undefined，原生 append 会把它渲染成字面文本
  check('页面无 null / undefined 泄漏', !/^\s*(null|undefined)\s*$/m.test(bodyText),
    (bodyText.match(/^\s*(null|undefined)\s*$/m) || [''])[0]);
  const profileOk = await page.evaluate(() => {
    const p = window.__omlState?.profile;
    return !!(p && p.dims && Object.keys(p.dims).length === 12 && p.chart && p.cross && p.code.hexagram.number >= 1);
  });
  check('结果对象结构完整', profileOk);
  await page.screenshot({ path: join(SHOTS, '04-result.png'), fullPage: true });

  // 保存档案（覆盖 prompt/alert）
  page.on('dialog', (d) => d.accept('测试档案 A'));
  await page.getByRole('button', { name: '保存档案到本机' }).click();
  await page.waitForTimeout(200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oml.profiles.v1') || '[]').length);
  check('档案保存到 localStorage', saved === 1, `saved=${saved}`);

  // ————————————————— 关系相性 —————————————————
  console.log('\n▸ pair.html');
  await page.goto(`${BASE}/pair.html`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '生成两份演示档案' }).click();
  await page.waitForSelector('#total-score', { timeout: 5000 });
  const score = Number(await page.locator('#total-score').innerText());
  check('总分在 0–100', Number.isFinite(score) && score >= 0 && score <= 100, String(score));
  console.log(`    → 相性总分 ${score}`);
  const pairText = await page.locator('body').innerText();
  check('配对代码渲染', /[A-Za-z]{6}-[SABCD]/.test(pairText));
  check('五项子分渲染', /共鸣 Resonance/.test(pairText) && /张力 Friction/.test(pairText));
  check('十二维相性表 12 行', await page.locator('table tbody tr').count() === 12);
  check('符号层明细渲染', /八字合婚（对称化）/.test(pairText) && /卦象关系/.test(pairText));
  check('依恋组合渲染', /依恋组合/.test(pairText));
  check('建议与风险渲染', /建议/.test(pairText) && /风险点/.test(pairText));
  check('雷达叠加两条曲线', await page.locator('svg.radar path.poly2').count() === 1);
  const matchOk = await page.evaluate(() => {
    const m = window.__omlMatch;
    return !!(m && m.dimRows.length === 12 && m.symbolParts.length === 5 && m.total >= 0);
  });
  check('匹配对象结构完整', matchOk);
  await page.screenshot({ path: join(SHOTS, '05-pair.png'), fullPage: true });

  // ————————————————— 方法页 —————————————————
  console.log('\n▸ method.html');
  await page.goto(`${BASE}/method.html`, { waitUntil: 'networkidle' });
  check('常模表 12 行', await page.locator('#normtable tbody tr').count() === 12);
  check('权重表渲染', await page.locator('#weighttable tbody tr').count() === 14);
  const methodText = await page.locator('body').innerText();
  check('伦理声明包含身份不参与推断', /身份 ≠ 人格/.test(methodText));
  check('已知局限章节存在', /已知局限/.test(methodText));
  await page.screenshot({ path: join(SHOTS, '06-method.png'), fullPage: true });

  // ————————————————— 移动端视口 —————————————————
  console.log('\n▸ 移动端视口 390×844');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mobile.newPage();
  mp.on('pageerror', (e) => errors.push(`[mobile pageerror] ${e.message}`));
  await mp.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('移动端无横向溢出', overflow <= 1, `溢出 ${overflow}px`);
  await mp.screenshot({ path: join(SHOTS, '07-mobile.png'), fullPage: false });
  await mobile.close();

  check('全程无 JS 错误', errors.length === 0, errors.join(' | '));

  await browser.close();
  stop();

  console.log(`\n${'─'.repeat(52)}`);
  if (failures.length) {
    console.log(`浏览器测试失败：${failures.length} 项（通过 ${passed} 项）`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log(`浏览器测试全部通过：${passed} 项断言　截图见 tests/browser/screenshots/`);
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
