/** result.js — 结果页渲染（供测评页与档案查看复用） */

import { el } from './common.js';
import { DIM_KEYS, DIMENSIONS, AXES } from '../core/dimensions.js';
import { ELEMENTS } from '../core/bazi.js';

const pct = (x) => `${Math.round(x * 100)}%`;

/** 小时偏移 → UTC+08:00 */
function fmtOffset(hours) {
  const m = Math.round(hours * 60);
  const sign = m < 0 ? '−' : '+';
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** 安全追加：跳过 null / undefined / false，避免被渲染成字面文本 */
const add = (parent, ...kids) => {
  for (const k of kids) if (k) parent.append(k);
  return parent;
};

export function renderResult(p, helpers) {
  const { radarChart, axisRow } = helpers;
  const box = el('div', {});
  const dimScores = Object.fromEntries(DIM_KEYS.map((k) => [k, p.dims[k].score]));

  // ——— 头部：代码 ———
  box.append(el('div', { class: 'card', id: 'result-head' },
    el('p', { class: 'eyebrow' }, 'Your OML Code'),
    el('div', { class: 'codeplate', id: 'oml-code' },
      ...[...p.code.core].map((c) => el('span', {}, c)),
      el('span', { class: 'dash' }, '-'),
      el('span', {}, p.code.element.digit),
      el('span', { style: 'color:var(--jade)' }, p.code.temper)),
    el('div', { class: 'typename' }, `${p.code.name.zh}　`, el('small', { style: 'font-size:15px' }, p.code.name.en)),
    el('p', { style: 'margin-top:10px' }, p.narrative.subtitle),
    el('div', { class: 'grid c3', style: 'margin-top:14px' },
      el('div', {}, el('p', { class: 'eyebrow' }, '对应卦象'),
        el('div', { class: 'hexline' }, p.code.hexagram.symbol, ' ', p.code.hexagram.composed),
        el('p', { class: 'hint' }, `第 ${p.code.hexagram.number} 卦　上${p.code.hexagram.upper.zh}(${p.code.hexagram.upper.nature}) 下${p.code.hexagram.lower.zh}(${p.code.hexagram.lower.nature})`)),
      el('div', {}, el('p', { class: 'eyebrow' }, '五行主导'),
        el('div', { class: 'hexline' }, `${p.code.element.digit} ${p.code.element.zh}·${p.code.element.keyword}`),
        el('p', { class: 'hint' }, ELEMENTS.map((e, i) => `${e}${p.code.element.blend[i].toFixed(2)}`).join('　'))),
      el('div', {}, el('p', { class: 'eyebrow' }, '调性'),
        el('div', { class: 'hexline' }, `${p.code.temper} ${p.code.temperMeta.zh} ${p.code.temperMeta.en}`),
        el('p', { class: 'hint' }, `${p.code.temperMeta.gloss}（内部张力 ${p.code.tension.toFixed(2)}，合成量 ${p.code.coherence.toFixed(2)}）`))),
    el('p', { class: 'hint', style: 'margin-top:12px' },
      `核心型 #${p.code.typeIndex + 1} / 64　·　完整代码空间 64 × 5 × 2 = 640　·　象征层权重 λb = ${p.lambdaB}`)));

  // ——— 雷达 + 轴 ———
  const axisBox = el('div', {}, AXES.map((ax, i) => axisRow(ax, p.dims, p.code.core[i])));
  box.append(el('h2', {}, '十二维剖面'),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' }, radarChart(dimScores, DIM_KEYS)),
      el('div', { class: 'card' },
        el('p', { class: 'eyebrow' }, '六条双极轴'),
        axisBox,
        el('p', { class: 'hint', style: 'margin-top:12px' },
          '条形位置表示两极的相对强度；金色一侧即代码中出现的字母。两极同时偏高会计入「内部张力」，并影响 A/T 后缀。'))));

  // ——— 十二维明细 ———
  const dimCards = DIMENSIONS.map((d) => {
    const dd = p.dims[d.key];
    return el('div', { class: 'card tight' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' },
        el('span', { style: 'font-family:var(--serif);font-size:17px' }, `${d.name} ${d.key}`),
        el('span', { class: 'mono', style: 'color:var(--gold);font-size:20px' }, String(dd.score))),
      el('p', { class: 'hint', style: 'margin:0 0 6px' }, `${d.en} · ${d.pinyin}`),
      el('div', { class: 'bar' }, el('i', { style: `width:${dd.score}%` })),
      el('p', { style: 'font-size:13px;margin:8px 0 4px' }, dd.score >= 55 ? d.high : (dd.score <= 45 ? d.low : d.gloss)),
      el('p', { class: 'hint' },
        `95% 区间 ${dd.ci95[0]}–${dd.ci95[1]}　·　问卷 z=${dd.zQuestionnaire}　象征 z=${dd.zSymbolic}　·　象征占比 ${pct(dd.symbolicShare)}`));
  });
  box.append(el('h2', {}, '维度明细'), el('div', { class: 'grid c3' }, dimCards));

  // ——— 叙述 ———
  // 原生 append 会把 null 渲染成字面文本，故条件片段统一经 add() 过滤
  add(box, el('h2', {}, '结构化解读'),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, '最突出的三维'),
        el('ul', { class: 'clean' }, p.narrative.strengths.map((s) => el('li', {}, s)))),
      el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, '最低的两维（不等于缺点）'),
        el('ul', { class: 'clean' }, p.narrative.growth.map((s) => el('li', {}, s))))),
    p.narrative.tensions.length
      ? el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, '未定论的轴（内部张力）'),
        el('ul', { class: 'clean' }, p.narrative.tensions.map((s) => el('li', {}, s))))
      : null,
    el('div', { class: 'notice' }, p.narrative.crossSummary));

  // ——— 跨体系映射 ———
  const c = p.cross;
  const b5 = c.bigFive;
  const b5rows = [
    ['开放性 Openness', b5.openness], ['尽责性 Conscientiousness', b5.conscientiousness],
    ['外向性 Extraversion', b5.extraversion], ['宜人性 Agreeableness', b5.agreeableness],
    ['神经质 Neuroticism', b5.neuroticism],
  ];
  box.append(el('h2', {}, '跨体系映射'),
    el('p', {}, '同一组十二维分数，用其他体系的语言重新表述。这些是',
      el('strong', { style: 'color:var(--fg)' }, '翻译'), '，不是独立的第二次测量。'),
    el('div', { class: 'grid c2' },
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, 'MBTI 四轴'),
        el('div', { class: 'codeplate', style: 'font-size:30px' }, c.mbti.code),
        el('div', { class: 'kv', style: 'margin-top:10px' },
          el('dt', {}, 'E ↔ I'), el('dd', {}, bar(c.mbti.axes.EI, `E ${c.mbti.axes.EI} / I ${100 - c.mbti.axes.EI}`)),
          el('dt', {}, 'N ↔ S'), el('dd', {}, bar(c.mbti.axes.NS, `N ${c.mbti.axes.NS} / S ${100 - c.mbti.axes.NS}`)),
          el('dt', {}, 'F ↔ T'), el('dd', {}, bar(c.mbti.axes.FT, `F ${c.mbti.axes.FT} / T ${100 - c.mbti.axes.FT}`)),
          el('dt', {}, 'P ↔ J'), el('dd', {}, bar(c.mbti.axes.PJ, `P ${c.mbti.axes.PJ} / J ${100 - c.mbti.axes.PJ}`))),
        el('p', { class: 'hint' }, `轴向清晰度 ${pct(c.mbti.confidence)}——低于 40% 时该字母不稳定。`)),
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '大五 OCEAN'),
        el('div', { class: 'kv' }, b5rows.flatMap(([n, v]) => [el('dt', {}, n.split(' ')[0]), el('dd', {}, bar(v, String(v)))])),
        el('p', { class: 'hint' }, '由十二维线性组合反算，非独立施测。')),
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '九型人格'),
        el('p', { style: 'font-size:22px;font-family:var(--mono);color:var(--gold);margin:0' }, c.enneagram.label),
        el('p', { class: 'hint' }, '前三候选：', c.enneagram.top3.map((t) => `${t.type} 号(${t.score.toFixed(2)})`).join('　')),
        el('h3', {}, '成人依恋'),
        el('p', { style: 'margin:0;color:var(--fg)' }, `${c.attachment.zh} ${c.attachment.en}`),
        el('p', { class: 'hint' }, `亲近取向 ${c.attachment.closeness}　情绪安全 ${c.attachment.security}`)),
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '体质 / 能量体系'),
        el('div', { class: 'kv' },
          el('dt', {}, '主导脉轮'), el('dd', {}, c.chakra.dominant, el('small', {}, `（最弱：${c.chakra.weakest}）`)),
          el('dt', {}, '阿育吠陀'), el('dd', {}, `${c.dosha.dominant} ${c.dosha.dominantZh}`),
          el('dt', {}, '中医体质'), el('dd', {}, c.tcm.dominant),
          el('dt', {}, '人类图（近似）'), el('dd', {}, c.humanDesign.type, el('br'), el('small', {}, c.humanDesign.strategy)),
          el('dt', {}, '塔罗原型'), el('dd', {}, c.tarot[0]),
          el('dt', {}, '卢恩'), el('dd', {}, c.rune[0]),
          el('dt', {}, '四元素亲和'), el('dd', {}, Object.entries(c.elementAffinity).map(([k, v]) => `${({ fire: '火', earth: '土', air: '风', water: '水' })[k]} ${v}%`).join('　')))),
      el('div', { class: 'card' },
        el('h3', { style: 'margin-top:0' }, '爱之语优先级'),
        el('ol', { style: 'padding-left:20px;color:var(--fg-dim)' },
          c.loveLanguages.map((l) => el('li', {}, l.name, el('small', {}, ` ${l.score}`)))))));

  // ——— 出生符号图 ———
  if (p.chart) box.append(renderChart(p));

  // ——— 效度 ———
  const val = p.questionnaire.validity;
  box.append(el('h2', {}, '作答效度'),
    el('div', { class: 'card' },
      el('div', { class: 'grid c4' },
        metric('完整度', pct(val.completeness)),
        metric('离散度', val.variability.toFixed(2)),
        metric('默认同意偏差', val.acquiescence.toFixed(2)),
        metric('正反一致性', pct(val.consistency))),
      el('div', { style: 'margin-top:14px' },
        el('p', { class: 'eyebrow' }, `总体置信度 ${pct(val.overall)}`),
        el('div', { class: 'bar jade' }, el('i', { style: `width:${val.overall * 100}%` }))),
      val.flags.length
        ? el('ul', { class: 'clean', style: 'margin-top:12px' }, val.flags.map((f) => el('li', {}, f)))
        : el('p', { class: 'hint', style: 'margin-top:12px' }, '未触发任何效度警示。')),
    el('div', { class: 'notice warn' }, p.narrative.disclaimer));

  return box;
}

function bar(v, label) {
  return el('div', {},
    el('div', { class: 'bar' }, el('i', { style: `width:${v}%` })),
    el('small', { class: 'mono' }, label));
}

function metric(name, value) {
  return el('div', {},
    el('p', { class: 'eyebrow' }, name),
    el('p', { class: 'mono', style: 'font-size:22px;color:var(--gold);margin:0' }, value));
}

function renderChart(p) {
  const ch = p.chart;
  const w = ch.western;
  const cn = ch.chinese;
  const box = el('div', {});
  box.append(el('h2', {}, '出生符号图'));

  const pillars = ['year', 'month', 'day', 'hour'];
  const pillarLabel = { year: '年柱', month: '月柱', day: '日柱（日主）', hour: '时柱' };
  const table = el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, ''), pillars.map((k) => el('th', {}, pillarLabel[k])))),
    el('tbody', {},
      el('tr', {}, el('td', {}, '干支'), pillars.map((k) => el('td', { class: 'mono', style: 'font-size:20px;color:var(--gold)' }, cn.pillars[k].name))),
      el('tr', {}, el('td', {}, '十神'), pillars.map((k) => el('td', {}, cn.pillars[k].god))),
      el('tr', {}, el('td', {}, '藏干'), pillars.map((k) => el('td', {}, el('small', {}, cn.pillars[k].hidden.map((h) => `${h.stem}·${h.god}`).join(' ')))))
      ,
      el('tr', {}, el('td', {}, '纳音'), pillars.map((k) => el('td', {}, el('small', {}, cn.pillars[k].nayin))))));

  box.append(el('div', { class: 'grid c2' },
    el('div', { class: 'card' },
      el('h3', { style: 'margin-top:0' }, '四柱八字'),
      el('div', { class: 'tablewrap' }, table),
      el('div', { class: 'kv', style: 'margin-top:12px' },
        el('dt', {}, '日主'), el('dd', {}, `${cn.dayMaster.stem}（${cn.dayMaster.yinYang}${cn.dayMaster.element}）　${cn.strength.label}`),
        el('dt', {}, '喜用五行'), el('dd', {}, cn.strength.favorableNames.join('、')),
        el('dt', {}, '节气'), el('dd', {}, cn.solarTerm),
        el('dt', {}, '生肖'), el('dd', {}, `${cn.zodiac} ${cn.zodiacEn}`),
        el('dt', {}, '五行结构'), el('dd', {}, ELEMENTS.map((e, i) => `${e} ${Math.round(cn.elements.ratio[i] * 100)}%`).join('　')),
        el('dt', {}, '十神主气'), el('dd', {}, cn.tenGodProfile.top.map((t) => `${t.god} ${t.weight}`).join('　')))),
    el('div', { class: 'card' },
      el('h3', { style: 'margin-top:0' }, '星盘与历法'),
      el('div', { class: 'kv' },
        el('dt', {}, '太阳'), el('dd', {}, `${w.sun.sign.glyph} ${w.sun.sign.zh}座 ${w.sun.deg}°（${w.sun.sign.element}/${w.sun.sign.modality}）`),
        el('dt', {}, '月亮'), el('dd', {}, `${w.moon.sign.glyph} ${w.moon.sign.zh}座 ${w.moon.deg}°`),
        el('dt', {}, '上升'), el('dd', {}, w.ascendant ? `${w.ascendant.sign.glyph} ${w.ascendant.sign.zh}座 ${w.ascendant.deg}°` : '未提供出生时间'),
        el('dt', {}, '天顶 MC'), el('dd', {}, w.midheaven ? `${w.midheaven.sign.zh}座` : '—'),
        el('dt', {}, '月相'), el('dd', {}, `${w.lunarPhase.zh}（照度 ${Math.round(w.lunarPhase.illumination * 100)}%）`),
        el('dt', {}, '吠陀恒星'), el('dd', {}, `太阳 ${ch.vedic.sun.sign.zh}座　月宿 ${ch.vedic.nakshatra} 第 ${ch.vedic.nakshatraPada} 足　（岁差 ${ch.vedic.ayanamsa}°）`),
        el('dt', {}, '生命灵数'), el('dd', {}, String(ch.numerology.lifePath)),
        el('dt', {}, '玛雅卓尔金'), el('dd', {}, `${ch.calendars.tzolkin.number} ${ch.calendars.tzolkin.name}（Kin ${ch.calendars.tzolkin.kin}）`),
        el('dt', {}, '人类图闸门'), el('dd', {}, `太阳 ${ch.calendars.humanDesignGate.gate}.${ch.calendars.humanDesignGate.line}（近似）`),
        el('dt', {}, '生日卢恩'), el('dd', {}, ch.calendars.rune),
        el('dt', {}, '凯尔特树'), el('dd', {}, ch.calendars.celticTree),
        el('dt', {}, '儒略日'), el('dd', { class: 'mono' }, ch.jd.toFixed(4)),
        ...(ch.timezone
          ? [
            el('dt', {}, '出生地时区'), el('dd', { class: 'mono' },
              `${ch.timezone.name}　${fmtOffset(ch.timezone.offsetHours)}`),
            el('dt', {}, '真太阳时校正'), el('dd', { class: 'mono' },
              `${ch.timezone.solarCorrectionMinutes > 0 ? '+' : ''}${ch.timezone.solarCorrectionMinutes} 分钟`),
          ]
          : [])))));

  // 象征先验贡献
  if (p.prior) {
    const rows = p.prior.contributions.map((c) => {
      const top = c.vector
        .map((x, i) => ({ k: DIM_KEYS[i], x }))
        .filter((o) => Math.abs(o.x) > 0.05)
        .sort((a, b) => Math.abs(b.x) - Math.abs(a.x))
        .slice(0, 4)
        .map((o) => `${o.k}${o.x > 0 ? '+' : ''}${o.x.toFixed(2)}`)
        .join('  ');
      return el('tr', {},
        el('td', {}, c.label),
        el('td', { class: 'mono' }, c.weight.toFixed(2)),
        el('td', {}, el('small', {}, c.detail || '')),
        el('td', { class: 'mono' }, el('small', {}, top || '（近似中性）')));
    });
    box.append(el('h3', {}, '象征先验的逐项贡献'),
      el('p', { class: 'hint' }, `共 ${p.prior.contributions.length} 个来源，权重合计 ${p.prior.weightSum.toFixed(2)}；合成后按 λb = ${p.lambdaB} 注入最终分数。λb 设为 0 时本层完全不生效。`),
      el('div', { class: 'tablewrap' },
        el('table', {},
          el('thead', {}, el('tr', {}, el('th', {}, '来源'), el('th', {}, '权重'), el('th', {}, '取值'), el('th', {}, '主要维度偏移'))),
          el('tbody', {}, rows))));
  }
  return box;
}
