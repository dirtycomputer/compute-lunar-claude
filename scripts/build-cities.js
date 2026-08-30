#!/usr/bin/env node
/**
 * build-cities.js — 从 GeoNames 构建城市数据集
 *
 * 用法：node scripts/build-cities.js
 * 产物：
 *   src/data/cities.txt        主库：人口 ≥ 15000 的城市（约 34k），首屏加载
 *   src/data/cities-extra.txt  补充库：人口 5000–15000 的城市（约 35k），按需加载
 *   src/data/countries.txt     国家/地区代码 → 中英文名
 *
 * 数据来源：GeoNames（https://www.geonames.org/），CC BY 4.0。
 * 每座城市保留 IANA 时区名而非固定 UTC 偏移——偏移在运行时按出生时刻用 Intl 解析，
 * 这样夏令时与历史时区变更（如中国 1986–1991 年夏令时）都能自动正确处理。
 *
 * 行格式（| 分隔）：name|ascii|zh|aliases|admin1|lat×1000|lon×1000|tzIndex|popBucket
 *   - name 为 UTF-8 原名（Ürümqi），ascii 为拉丁转写（UEruemqi），相同则留空
 *   - zh 为「可信的中文显示名」，来源见 pickDisplayZh()；不可信时留空，界面只显示拉丁名
 *   - aliases 为全部汉字候选（/ 分隔），仅用于搜索，不用于显示
 *   - popBucket = round(log2(pop+1)*4) 的 base36，仅用于结果排序
 * 文件头 `#TZ a,b,c` 为时区名表，`#CC` 为国家分组标记。
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const execFileP = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data');
const TMP = join(ROOT, '.geonames-tmp');
const BASE = 'https://download.geonames.org/export/dump';

/** 纯汉字别名：排除假名、谚文与含拉丁字母者 */
const isHan = (s) => /^[㐀-䶿一-鿿·]+$/.test(s) && s.length <= 10;

/**
 * 高频城市的简体补充名。
 * GeoNames 的 alternatenames 对部分城市只收录繁体（如「紐約」而无「纽约」），
 * 而本项目 UI 为简体中文。此表为人工补充，仅作搜索别名，不覆盖已有名称。
 */
const ZH_SUPPLEMENT = {
  // 汉字圈主要城市：启发式在这里不够稳（深圳的别名里混有下辖区名「宝安」），
  // 而这些恰是使用者最常选的出生地，故一并人工校订。
  'CN:Shanghai': '上海', 'CN:Beijing': '北京', 'CN:Tianjin': '天津', 'CN:Chongqing': '重庆',
  'CN:Shenzhen': '深圳', 'CN:Guangzhou': '广州', 'CN:Chengdu': '成都', 'CN:Hangzhou': '杭州',
  'CN:Wuhan': '武汉', 'CN:Xi’an': '西安', 'CN:Nanjing': '南京', 'CN:Suzhou': '苏州',
  'CN:Shenyang': '沈阳', 'CN:Harbin': '哈尔滨', 'CN:Changchun': '长春', 'CN:Dalian': '大连',
  'CN:Jinan': '济南', 'CN:Qingdao': '青岛', 'CN:Zhengzhou': '郑州', 'CN:Changsha': '长沙',
  'CN:Kunming': '昆明', 'CN:Guiyang': '贵阳', 'CN:Nanning': '南宁', 'CN:Fuzhou': '福州',
  'CN:Xiamen': '厦门', 'CN:Hefei': '合肥', 'CN:Nanchang': '南昌', 'CN:Taiyuan': '太原',
  'CN:Shijiazhuang': '石家庄', 'CN:Lanzhou': '兰州', 'CN:Xining': '西宁', 'CN:Yinchuan': '银川',
  'CN:Hohhot': '呼和浩特', 'CN:Ürümqi': '乌鲁木齐', 'CN:Lhasa': '拉萨', 'CN:Haikou': '海口',
  'CN:Ningbo': '宁波', 'CN:Wuxi': '无锡', 'CN:Foshan': '佛山', 'CN:Dongguan': '东莞',
  'CN:Wenzhou': '温州', 'CN:Tangshan': '唐山', 'CN:Xuzhou': '徐州', 'CN:Luoyang': '洛阳',
  'CN:Kashgar': '喀什', 'CN:Sanya': '三亚', 'CN:Guilin': '桂林', 'CN:Zhuhai': '珠海',
  'HK:Hong Kong': '香港', 'MO:Macau': '澳门',
  'TW:Taipei': '台北', 'TW:Kaohsiung': '高雄', 'TW:Taichung': '台中', 'TW:Tainan': '台南',
  'JP:Tokyo': '东京', 'JP:Osaka': '大阪', 'JP:Kyoto': '京都', 'JP:Yokohama': '横滨',
  'JP:Nagoya': '名古屋', 'JP:Sapporo': '札幌', 'JP:Fukuoka': '福冈', 'JP:Kobe': '神户',
  'KR:Seoul': '首尔', 'KR:Busan': '釜山', 'KR:Incheon': '仁川', 'KR:Daegu': '大邱',
  'VN:Hanoi': '河内', 'VN:Ho Chi Minh City': '胡志明市', 'VN:Da Nang': '岘港',
  'SG:Singapore': '新加坡',
  'US:New York City': '纽约', 'US:Los Angeles': '洛杉矶', 'US:San Francisco': '旧金山',
  'US:Chicago': '芝加哥', 'US:Seattle': '西雅图', 'US:Boston': '波士顿', 'US:Houston': '休斯敦',
  'US:Philadelphia': '费城', 'US:Atlanta': '亚特兰大', 'US:Dallas': '达拉斯', 'US:Denver': '丹佛',
  'US:Miami': '迈阿密', 'US:Portland': '波特兰', 'US:Las Vegas': '拉斯维加斯', 'US:San Diego': '圣迭戈',
  'US:Washington': '华盛顿', 'US:Detroit': '底特律', 'US:Phoenix': '凤凰城', 'US:New Orleans': '新奥尔良',
  'US:Honolulu': '檀香山', 'US:Austin': '奥斯汀', 'US:San Jose': '圣何塞', 'US:Baltimore': '巴尔的摩',
  'US:Pittsburgh': '匹兹堡', 'US:Minneapolis': '明尼阿波利斯', 'US:St. Louis': '圣路易斯',
  'GB:London': '伦敦', 'GB:Manchester': '曼彻斯特', 'GB:Birmingham': '伯明翰',
  'GB:Liverpool': '利物浦', 'GB:Edinburgh': '爱丁堡', 'GB:Glasgow': '格拉斯哥',
  'GB:Oxford': '牛津', 'GB:Cambridge': '剑桥', 'GB:Bristol': '布里斯托尔', 'GB:Leeds': '利兹',
  'FR:Paris': '巴黎', 'FR:Lyon': '里昂', 'FR:Marseille': '马赛', 'FR:Toulouse': '图卢兹',
  'FR:Nice': '尼斯', 'FR:Bordeaux': '波尔多', 'FR:Strasbourg': '斯特拉斯堡',
  'DE:Berlin': '柏林', 'DE:Munich': '慕尼黑', 'DE:Köln': '科隆', 'DE:Hamburg': '汉堡',
  'DE:Frankfurt am Main': '法兰克福', 'DE:Stuttgart': '斯图加特', 'DE:Düsseldorf': '杜塞尔多夫',
  'DE:Dresden': '德累斯顿', 'DE:Leipzig': '莱比锡', 'DE:Nuremberg': '纽伦堡', 'DE:Bremen': '不来梅',
  'IT:Rome': '罗马', 'IT:Milan': '米兰', 'IT:Naples': '那不勒斯', 'IT:Turin': '都灵',
  'IT:Florence': '佛罗伦萨', 'IT:Venice': '威尼斯', 'IT:Bologna': '博洛尼亚',
  'ES:Madrid': '马德里', 'ES:Barcelona': '巴塞罗那', 'ES:Valencia': '巴伦西亚',
  'ES:Sevilla': '塞维利亚', 'ES:Bilbao': '毕尔巴鄂',
  'PT:Lisbon': '里斯本', 'PT:Porto': '波尔图',
  'NL:Amsterdam': '阿姆斯特丹', 'NL:Rotterdam': '鹿特丹', 'NL:The Hague': '海牙', 'NL:Utrecht': '乌得勒支',
  'BE:Brussels': '布鲁塞尔', 'BE:Antwerp': '安特卫普',
  'CH:Zürich': '苏黎世', 'CH:Geneva': '日内瓦', 'CH:Bern': '伯尔尼', 'CH:Basel': '巴塞尔',
  'AT:Vienna': '维也纳', 'AT:Salzburg': '萨尔茨堡',
  'DK:Copenhagen': '哥本哈根', 'SE:Stockholm': '斯德哥尔摩', 'SE:Gothenburg': '哥德堡',
  'NO:Oslo': '奥斯陆', 'FI:Helsinki': '赫尔辛基', 'IS:Reykjavík': '雷克雅未克',
  'IE:Dublin': '都柏林', 'PL:Warsaw': '华沙', 'PL:Kraków': '克拉科夫',
  'CZ:Prague': '布拉格', 'HU:Budapest': '布达佩斯', 'RO:Bucharest': '布加勒斯特',
  'GR:Athens': '雅典', 'HR:Zagreb': '萨格勒布', 'RS:Belgrade': '贝尔格莱德',
  'RU:Moscow': '莫斯科', 'RU:Saint Petersburg': '圣彼得堡', 'RU:Novosibirsk': '新西伯利亚',
  'RU:Vladivostok': '符拉迪沃斯托克', 'RU:Yekaterinburg': '叶卡捷琳堡',
  'UA:Kyiv': '基辅', 'UA:Odesa': '敖德萨', 'BY:Minsk': '明斯克',
  'TR:Istanbul': '伊斯坦布尔', 'TR:Ankara': '安卡拉',
  'KZ:Almaty': '阿拉木图', 'UZ:Tashkent': '塔什干',
  'IN:Delhi': '德里', 'IN:New Delhi': '新德里', 'IN:Mumbai': '孟买', 'IN:Bengaluru': '班加罗尔',
  'IN:Chennai': '金奈', 'IN:Kolkata': '加尔各答', 'IN:Hyderabad': '海得拉巴',
  'PK:Karachi': '卡拉奇', 'PK:Lahore': '拉合尔', 'PK:Islamabad': '伊斯兰堡',
  'BD:Dhaka': '达卡', 'NP:Kathmandu': '加德满都', 'LK:Colombo': '科伦坡',
  'TH:Bangkok': '曼谷', 'TH:Chiang Mai': '清迈', 'TH:Phuket': '普吉',
  'MY:Kuala Lumpur': '吉隆坡', 'MY:George Town': '槟城', 'ID:Jakarta': '雅加达',
  'ID:Bandung': '万隆', 'ID:Surabaya': '泗水', 'PH:Manila': '马尼拉', 'PH:Cebu City': '宿务',
  'MM:Yangon': '仰光', 'KH:Phnom Penh': '金边', 'LA:Vientiane': '万象',
  'AE:Dubai': '迪拜', 'AE:Abu Dhabi': '阿布扎比', 'SA:Riyadh': '利雅得', 'SA:Jeddah': '吉达',
  'QA:Doha': '多哈', 'KW:Kuwait City': '科威特城', 'IL:Jerusalem': '耶路撒冷', 'IL:Tel Aviv': '特拉维夫',
  'IR:Tehran': '德黑兰', 'IQ:Baghdad': '巴格达', 'LB:Beirut': '贝鲁特',
  'EG:Cairo': '开罗', 'EG:Alexandria': '亚历山大', 'MA:Casablanca': '卡萨布兰卡',
  'NG:Lagos': '拉各斯', 'KE:Nairobi': '内罗毕', 'ET:Addis Ababa': '亚的斯亚贝巴',
  'ZA:Cape Town': '开普敦', 'ZA:Johannesburg': '约翰内斯堡', 'ZA:Pretoria': '比勒陀利亚',
  'TZ:Dar es Salaam': '达累斯萨拉姆', 'GH:Accra': '阿克拉', 'SN:Dakar': '达喀尔',
  'AU:Sydney': '悉尼', 'AU:Melbourne': '墨尔本', 'AU:Brisbane': '布里斯班',
  'AU:Perth': '珀斯', 'AU:Adelaide': '阿德莱德', 'AU:Canberra': '堪培拉',
  'NZ:Auckland': '奥克兰', 'NZ:Wellington': '惠灵顿', 'NZ:Christchurch': '基督城',
  'CA:Toronto': '多伦多', 'CA:Montréal': '蒙特利尔', 'CA:Vancouver': '温哥华',
  'CA:Calgary': '卡尔加里', 'CA:Ottawa': '渥太华', 'CA:Edmonton': '埃德蒙顿',
  'MX:Mexico City': '墨西哥城', 'MX:Guadalajara': '瓜达拉哈拉', 'MX:Tijuana': '蒂华纳',
  'BR:São Paulo': '圣保罗', 'BR:Rio de Janeiro': '里约热内卢', 'BR:Brasília': '巴西利亚',
  'AR:Buenos Aires': '布宜诺斯艾利斯', 'CL:Santiago': '圣地亚哥', 'PE:Lima': '利马',
  'CO:Bogotá': '波哥大', 'VE:Caracas': '加拉加斯', 'CU:Havana': '哈瓦那',
};

/** 汉字文化圈：这些国家/地区的 GeoNames 汉字别名即当地实名，可直接信任 */
const SINOSPHERE = new Set(['CN', 'TW', 'HK', 'MO', 'JP', 'KR', 'KP', 'SG', 'VN']);

/**
 * 选出「可信的中文显示名」。
 * GeoNames 的 alternatenames 顺序无意义且混有其他城市的名字
 * （Zürich 的别名里有「日内瓦」，Köln 的别名里有「古龍」），
 * 因此不能盲目取第一个。规则：
 *   1. 人工校订表命中 → 用它；
 *   2. 汉字文化圈国家 → 用最短的汉字候选（去掉「市」等后缀更接近通称）；
 *   3. 其他 → 返回空，界面只显示拉丁名。宁可不显示，也不显示错的。
 * 无论哪种情况，全部汉字候选都会保留为搜索键。
 */
function pickDisplayZh(r) {
  const curated = ZH_SUPPLEMENT[`${r.cc}:${r.name}`];
  if (curated) return curated;
  if (SINOSPHERE.has(r.cc) && r.han.length) {
    // 取最短候选以去掉「市/县」等后缀，但排除单字简称（上海的别名里有「沪」）
    const usable = r.han.filter((h) => h.length >= 2);
    return (usable.length ? usable : r.han).sort((a, b) => a.length - b.length)[0];
  }
  return '';
}


async function download(name) {
  const dest = join(TMP, name);
  try {
    const s = await stat(dest);
    if (s.size > 0) { console.log(`  ↺ ${name}（已存在，跳过下载）`); return dest; }
  } catch { /* 需要下载 */ }
  console.log(`  ↓ ${name}`);
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`下载 ${name} 失败：HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  return dest;
}

async function unzipTo(zipPath) {
  await execFileP('unzip', ['-oq', zipPath, '-d', TMP]);
}

/** 解析 GeoNames 城市文件为记录数组 */
async function parseCities(txtPath) {
  const raw = await readFile(txtPath, 'utf8');
  const rows = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const [id, name, ascii, alts, lat, lon, , , cc, , admin1] = f;
    const pop = Number(f[14]) || 0;
    const tz = f[17];
    if (!cc || !tz || !(name || ascii)) continue;
    const han = [...new Set((alts || '').split(',').filter(isHan))];
    // 中国全境的官方时间、出生证明与户籍记录一律为北京时间。
    // GeoNames 按 IANA 给新疆标 Asia/Urumqi(UTC+6)、给部分西部地区标其他区，
    // 那反映的是民间习惯而非记录口径；使用者报出的出生时刻几乎必然是北京时间，
    // 若按 UTC+6 计算会整体错两小时。需要新疆时间的人可在界面「高级」中手动覆盖。
    const tzOfficial = cc === 'CN' ? 'Asia/Shanghai' : tz;
    rows.push({
      id: Number(id),
      // 原名用于显示与检索（Ürümqi 归一化后即 urumqi）；ascii 仅在不同时额外保留为检索键
      name: name || ascii,
      ascii: ascii && ascii !== name ? ascii : '',
      han: han.slice(0, 4),
      cc,
      admin1: admin1 || '',
      lat: Math.round(Number(lat) * 1000),
      lon: Math.round(Number(lon) * 1000),
      tz: tzOfficial,
      pop,
    });
  }
  return rows;
}

function encode(rows) {
  const tzList = [...new Set(rows.map((r) => r.tz))].sort();
  const tzIdx = Object.fromEntries(tzList.map((t, i) => [t, i]));
  const byCC = {};
  for (const r of rows) (byCC[r.cc] ||= []).push(r);
  const out = [`#TZ ${tzList.join(',')}`];
  for (const cc of Object.keys(byCC).sort()) {
    out.push(`#${cc}`);
    // 同一国家内按人口降序，使搜索结果天然按重要性排列
    byCC[cc].sort((a, b) => b.pop - a.pop);
    for (const r of byCC[cc]) {
      const bucket = Math.round(Math.log2(r.pop + 1) * 4).toString(36);
      const zh = pickDisplayZh(r);
      const aliases = r.han.filter((h) => h !== zh);
      out.push([r.name, r.ascii, zh, aliases.join('/'), r.admin1, r.lat, r.lon, tzIdx[r.tz], bucket].join('|'));
    }
  }
  return out.join('\n');
}

/** 国家/地区中文名。GeoNames 的 countryInfo 只有英文名，中文为人工补充。 */
const ZH_COUNTRIES = {
  CN: '中国', HK: '中国香港', MO: '中国澳门', TW: '中国台湾', JP: '日本', KR: '韩国', KP: '朝鲜',
  MN: '蒙古', SG: '新加坡', MY: '马来西亚', TH: '泰国', VN: '越南', PH: '菲律宾', ID: '印度尼西亚',
  MM: '缅甸', KH: '柬埔寨', LA: '老挝', BN: '文莱', TL: '东帝汶',
  IN: '印度', PK: '巴基斯坦', BD: '孟加拉国', LK: '斯里兰卡', NP: '尼泊尔', BT: '不丹', MV: '马尔代夫', AF: '阿富汗',
  US: '美国', CA: '加拿大', MX: '墨西哥', BR: '巴西', AR: '阿根廷', CL: '智利', PE: '秘鲁',
  CO: '哥伦比亚', VE: '委内瑞拉', EC: '厄瓜多尔', BO: '玻利维亚', PY: '巴拉圭', UY: '乌拉圭',
  CU: '古巴', JM: '牙买加', HT: '海地', DO: '多米尼加', PA: '巴拿马', CR: '哥斯达黎加',
  GT: '危地马拉', HN: '洪都拉斯', NI: '尼加拉瓜', SV: '萨尔瓦多', BS: '巴哈马', TT: '特立尼达和多巴哥',
  GB: '英国', IE: '爱尔兰', FR: '法国', DE: '德国', IT: '意大利', ES: '西班牙', PT: '葡萄牙',
  NL: '荷兰', BE: '比利时', LU: '卢森堡', CH: '瑞士', AT: '奥地利', DK: '丹麦', SE: '瑞典',
  NO: '挪威', FI: '芬兰', IS: '冰岛', PL: '波兰', CZ: '捷克', SK: '斯洛伐克', HU: '匈牙利',
  RO: '罗马尼亚', BG: '保加利亚', GR: '希腊', HR: '克罗地亚', SI: '斯洛文尼亚', RS: '塞尔维亚',
  BA: '波黑', ME: '黑山', MK: '北马其顿', AL: '阿尔巴尼亚', XK: '科索沃', MT: '马耳他', CY: '塞浦路斯',
  RU: '俄罗斯', UA: '乌克兰', BY: '白俄罗斯', MD: '摩尔多瓦', LT: '立陶宛', LV: '拉脱维亚', EE: '爱沙尼亚',
  GE: '格鲁吉亚', AM: '亚美尼亚', AZ: '阿塞拜疆', KZ: '哈萨克斯坦', UZ: '乌兹别克斯坦',
  TM: '土库曼斯坦', KG: '吉尔吉斯斯坦', TJ: '塔吉克斯坦',
  TR: '土耳其', IR: '伊朗', IQ: '伊拉克', SY: '叙利亚', LB: '黎巴嫩', JO: '约旦', IL: '以色列',
  PS: '巴勒斯坦', SA: '沙特阿拉伯', AE: '阿联酋', QA: '卡塔尔', KW: '科威特', BH: '巴林', OM: '阿曼', YE: '也门',
  EG: '埃及', LY: '利比亚', TN: '突尼斯', DZ: '阿尔及利亚', MA: '摩洛哥', SD: '苏丹', SS: '南苏丹',
  ET: '埃塞俄比亚', ER: '厄立特里亚', SO: '索马里', DJ: '吉布提', KE: '肯尼亚', UG: '乌干达',
  TZ: '坦桑尼亚', RW: '卢旺达', BI: '布隆迪', NG: '尼日利亚', GH: '加纳', CI: '科特迪瓦',
  SN: '塞内加尔', ML: '马里', BF: '布基纳法索', NE: '尼日尔', TD: '乍得', CM: '喀麦隆',
  CF: '中非', GA: '加蓬', CG: '刚果（布）', CD: '刚果（金）', AO: '安哥拉', ZM: '赞比亚',
  ZW: '津巴布韦', MW: '马拉维', MZ: '莫桑比克', BW: '博茨瓦纳', NA: '纳米比亚', ZA: '南非',
  LS: '莱索托', SZ: '埃斯瓦蒂尼', MG: '马达加斯加', MU: '毛里求斯', GN: '几内亚', LR: '利比里亚',
  SL: '塞拉利昂', TG: '多哥', BJ: '贝宁', MR: '毛里塔尼亚', GM: '冈比亚', GW: '几内亚比绍',
  AU: '澳大利亚', NZ: '新西兰', PG: '巴布亚新几内亚', FJ: '斐济', SB: '所罗门群岛',
  VU: '瓦努阿图', NC: '新喀里多尼亚', PF: '法属波利尼西亚', WS: '萨摩亚', TO: '汤加',
  GU: '关岛', MP: '北马里亚纳群岛', PW: '帕劳', FM: '密克罗尼西亚', MH: '马绍尔群岛',
  KI: '基里巴斯', NR: '瑙鲁', TV: '图瓦卢', CK: '库克群岛', AS: '美属萨摩亚',
  GL: '格陵兰', FO: '法罗群岛', PR: '波多黎各', VI: '美属维尔京群岛', BM: '百慕大',
  AD: '安道尔', MC: '摩纳哥', SM: '圣马力诺', VA: '梵蒂冈', LI: '列支敦士登', GI: '直布罗陀',
};

async function buildCountries(infoPath) {
  const raw = await readFile(infoPath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    const cc = f[0];
    const en = f[4];
    if (!cc || !en) continue;
    out.push([cc, ZH_COUNTRIES[cc] || en, en].join('|'));
  }
  return out.sort().join('\n');
}

async function main() {
  await mkdir(TMP, { recursive: true });
  await mkdir(OUT, { recursive: true });

  console.log('下载 GeoNames 数据…');
  const z15 = await download('cities15000.zip');
  const z5 = await download('cities5000.zip');
  const info = await download('countryInfo.txt');
  await unzipTo(z15);
  await unzipTo(z5);

  console.log('解析…');
  const main15 = await parseCities(join(TMP, 'cities15000.txt'));
  const all5 = await parseCities(join(TMP, 'cities5000.txt'));
  const mainIds = new Set(main15.map((r) => r.id));
  const extra = all5.filter((r) => !mainIds.has(r.id));


  const countries = new Set(main15.map((r) => r.cc));
  console.log(`  主库 ${main15.length} 座 / ${countries.size} 个国家与地区`);
  console.log(`  补充库 ${extra.length} 座（人口 5000–15000）`);

  // 人工表的键是「国家:名称」，若 GeoNames 改名会静默失配，故显式报出
  const present = new Set([...main15, ...extra].map((r) => `${r.cc}:${r.name}`));
  const missed = Object.keys(ZH_SUPPLEMENT).filter((k) => !present.has(k));
  if (missed.length) {
    console.warn(`  ⚠ 人工中文名表有 ${missed.length} 条未匹配到城市（将被忽略）：`);
    console.warn(`    ${missed.join('、')}`);
  } else {
    console.log(`  ✓ 人工中文名表 ${Object.keys(ZH_SUPPLEMENT).length} 条全部匹配`);
  }

  await writeFile(join(OUT, 'cities.txt'), encode(main15));
  await writeFile(join(OUT, 'cities-extra.txt'), encode(extra));
  await writeFile(join(OUT, 'countries.txt'), await buildCountries(info));

  for (const f of ['cities.txt', 'cities-extra.txt', 'countries.txt']) {
    const s = await stat(join(OUT, f));
    console.log(`  ✓ src/data/${f}  ${(s.size / 1024).toFixed(0)} KB`);
  }

  if (!process.env.KEEP_GEONAMES_TMP) await rm(TMP, { recursive: true, force: true });
  console.log('完成。数据来源 GeoNames（CC BY 4.0）。');
}

main().catch((e) => { console.error(e); process.exit(1); });
