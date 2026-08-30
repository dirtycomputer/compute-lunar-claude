/**
 * systems.js — 全球命理学与人格分类体系普查数据集
 * A census of the world's divinatory and personality-typing systems.
 *
 * 影响指数 Influence Index（0–100，透明可复算）：
 *   I = 0.40·认知人口 + 0.25·活跃使用 + 0.15·商业规模 + 0.10·制度嵌入 + 0.10·学术支持
 *
 * 五项子分均为 0–100 的量级估计（order-of-magnitude judgement），依据包括：
 * 各体系的从业者/应用规模公开报道、搜索与应用商店可见度、在婚配与人事制度中的使用、
 * 以及同行评议文献的存在量。它们是「可辩论的估计」而非精确统计，用于排序与比较，
 * 任何单项都可以被更好的数据替换（数据结构即接口）。
 *
 * family: divination 传统命理 | psychometric 现代心理测量 | popculture 流行文化分类 |
 *         identity 身份自述框架 | somatic 体质/医学传统
 */

export const WEIGHTS = { reach: 0.40, active: 0.25, commerce: 0.15, institution: 0.10, academia: 0.10 };

const S = (id, zh, en, region, era, family, [reach, active, commerce, institution, academia], mechanism, omlUse) =>
  ({ id, zh, en, region, era, family, reach, active, commerce, institution, academia, mechanism, omlUse });

export const SYSTEMS = [
  S('western-astrology', '西洋占星（星座/本命盘）', 'Western Astrology', '全球（源自两河—希腊）', '公元前 2 千纪—', 'divination',
    [95, 80, 85, 25, 12], '出生时间 + 地点 → 黄道十二宫、行星、宫位、相位',
    '核心正向映射：太阳/月亮/上升 → 十二维（权重 1.00 / 0.70 / 0.50）'),
  S('mbti', 'MBTI 十六型人格', 'Myers-Briggs Type Indicator', '全球（美国）', '1943—', 'psychometric',
    [88, 78, 90, 62, 28], '自陈问卷 → 四轴二分类',
    '双向映射：可作自陈先验（权重 0.90），并由十二维反算 MBTI 代码'),
  S('chinese-zodiac', '十二生肖', 'Chinese Zodiac (Sheng Xiao)', '东亚 / 东南亚 / 全球华人', '汉代—', 'popculture',
    [92, 70, 60, 45, 8], '出生年（立春换年）→ 十二地支动物',
    '正向映射，文化符号层，低权重 0.35'),
  S('bazi', '四柱八字 / 子平命理', 'BaZi — Four Pillars of Destiny', '华语圈 / 韩日越', '唐宋—', 'divination',
    [62, 62, 78, 28, 8], '年月日时 → 八个干支 + 五行 + 十神',
    '核心引擎：五行结构 1.00、日主 0.80、身强弱 0.60、十神 0.60'),
  S('vedic', '吠陀占星 / 九曜术', 'Jyotisha (Vedic Astrology)', '南亚 + 全球侨民', '公元前 1 千纪—', 'divination',
    [58, 68, 72, 72, 10], '恒星黄道 + 月宿 + 大运（Dasha）',
    '正向：Lahiri 岁差换算恒星星座与二十七宿，用于跨体系对照'),
  S('tarot', '塔罗牌', 'Tarot', '欧美 + 全球', '15 世纪—', 'divination',
    [72, 58, 72, 8, 8], '随机抽牌 + 牌阵解读（非出生信息）',
    '反向映射：十二维最高维 → 大阿卡纳原型牌'),
  S('fengshui', '风水 / 堪舆', 'Feng Shui', '东亚 + 全球华人', '汉晋—', 'divination',
    [72, 52, 82, 38, 8], '空间朝向 + 时间盘（玄空飞星等）',
    '未纳入个体评分（对象是空间而非人格），仅在文献层对照'),
  S('numerology', '西方数字命理 / 生命灵数', 'Pythagorean Numerology', '全球', '古希腊—近代复兴', 'divination',
    [66, 46, 52, 8, 5], '出生日期与姓名字母 → 数字根',
    '正向映射：生命灵数 → 十二维（权重 0.40）'),
  S('bigfive', '大五人格 OCEAN', 'Big Five / Five-Factor Model', '全球学术界', '1980s—', 'psychometric',
    [42, 48, 35, 58, 96], '自陈问卷 → 五个连续维度',
    '反向映射：十二维 → OCEAN 五分数（作为可比锚点）'),
  S('enneagram', '九型人格', 'Enneagram', '全球', '1970s（源流更早）', 'psychometric',
    [48, 42, 58, 30, 22], '自陈问卷 → 九种核心动机型 + 侧翼',
    '双向映射：自陈先验 0.70；余弦相似度反算型号与侧翼'),
  S('ziwei', '紫微斗数', 'Zi Wei Dou Shu', '华语圈', '宋代—', 'divination',
    [42, 45, 60, 15, 5], '农历生辰 → 十二宫 + 一百余星曜',
    '结构对照：其十二宫与 OML 十二维的语义对照表见 docs/03'),
  S('yijing', '易经 / 六爻 / 梅花易数', 'I Ching & its oracles', '东亚 + 全球', '公元前 1 千纪—', 'divination',
    [66, 40, 45, 20, 18], '起卦（蓍草/铜钱/时间数）→ 六十四卦与爻辞',
    '结构核心：OML 六轴极性 ≡ 六爻，64 核心型与文王卦序一一对应'),
  S('bloodtype', '血型性格论', 'Blood Type Personality', '日韩 + 东亚', '1927—', 'popculture',
    [58, 40, 30, 12, 6], 'ABO 血型 → 四类性格叙事',
    '正向映射，权重上限刻意设为最低 0.10（实证支持极弱，保留文化可比性）'),
  S('seimei', '姓名学 / 姓名判断', 'Name Divination (Seimei-handan / 三才五格)', '东亚', '近代（日本 1920s 系统化）', 'divination',
    [52, 38, 55, 10, 4], '汉字笔画数 → 五格三才吉凶',
    '需康熙笔画字典，本实现仅支持拉丁字母的表达数/灵魂数'),
  S('humandesign', '人类图', 'Human Design', '全球（新兴）', '1987—', 'divination',
    [30, 30, 48, 5, 3], '出生时间 → 64 闸门 / 9 中心 / 四类型',
    '正向：太阳闸门（近似轮）；反向：十二维 → 四类型近似判定'),
  S('genekeys', '基因钥匙', 'Gene Keys', '全球（新兴）', '2009—', 'divination',
    [18, 18, 30, 3, 2], '与人类图共用 64 卦轮 + 三层意识频率',
    '与 OML 的 64 型共享同一卦轮索引，可直接互译'),
  S('palmistry', '手相', 'Palmistry / Chiromancy', '全球', '古代—', 'divination',
    [64, 35, 40, 5, 4], '掌纹与手形（非出生信息）',
    '不纳入（输入模态不同），仅列入普查'),
  S('physiognomy', '面相 / 相术', 'Physiognomy', '东亚 + 全球', '古代—', 'divination',
    [58, 32, 38, 6, 3], '面部特征 → 命理判断',
    '不纳入。基于外貌的推断具有高度歧视风险，见 docs/05'),
  S('disc', 'DISC 行为风格', 'DISC Assessment', '全球职场', '1928/1956—', 'psychometric',
    [40, 45, 62, 45, 20], '自陈问卷 → 四象限行为风格',
    '对照表：D↔锻、I↔曜、S↔磐/根、C↔衡'),
  S('riasec', '霍兰德职业兴趣（RIASEC）', 'Holland Codes', '全球教育/职涯', '1959—', 'psychometric',
    [36, 40, 35, 62, 55], '兴趣问卷 → 六边形六码',
    '对照表：R/I/A/S/E/C 与十二维的映射见 docs/03'),
  S('attachment', '成人依恋类型', 'Adult Attachment Styles', '全球（心理学 + 社媒）', '1987—', 'psychometric',
    [50, 48, 25, 40, 78], '自陈量表 → 四象限（安全/焦虑/回避/恐惧）',
    '反向映射：织–垣 × 磐–汐 四象限；直接进入配对算法'),
  S('lovelang', '五种爱的语言', 'Five Love Languages', '全球（大众心理）', '1992—', 'popculture',
    [52, 45, 40, 10, 12], '自陈偏好 → 五类表达渠道',
    '反向映射：十二维 → 五语排序，用于配对建议'),
  S('kabbalah', '卡巴拉数字学 / 生命之树', 'Kabbalah & Gematria', '犹太—西方神秘学', '中世纪—', 'divination',
    [34, 22, 25, 8, 10], '希伯来字母数值 → 生命之树十质点',
    '结构对照：十质点与十二维的部分对齐见 docs/03'),
  S('runes', '卢恩符文', 'Elder Futhark Runes', '北欧 + 全球异教复兴', '2—8 世纪 / 20 世纪复兴', 'divination',
    [30, 22, 22, 3, 6], '抽符 / 生日符 → 24 符义',
    '反向映射：每维一符；出生日 JDN 取生日符'),
  S('maya', '玛雅卓尔金历', 'Maya Tzolk’in', '中美洲 + 全球新纪元', '公元前 1 千纪—', 'divination',
    [26, 20, 20, 6, 12], '260 日轮 → 13 数 × 20 日号',
    '正向映射：20 日号 → 十二维（权重 0.25）'),
  S('ifa', '伊法 / 奥杜占卜', 'Ifá & Odù (Yoruba)', '西非 + 拉美散居（约鲁巴、坎东布雷）', '至少 15 世纪—', 'divination',
    [30, 32, 18, 35, 10], '棕榈果/占卜链 → 256 奥杜诗文',
    '结构对照：256 = 16×16 二元组合，与 64 卦同属二元占卜族'),
  S('almanac', '黄历 / 通胜择日', 'Chinese Almanac & Date Selection', '华语圈', '古代—', 'divination',
    [70, 55, 45, 40, 4], '干支 + 神煞 → 每日宜忌',
    '仅在节气/干支层共用引擎，不进入人格评分'),
  S('qimen', '奇门遁甲', 'Qi Men Dun Jia', '华语圈', '汉唐—', 'divination',
    [24, 22, 40, 8, 3], '时空盘 → 九宫八门九星',
    '未纳入个体评分（面向事件择时而非人格特质）'),
  S('liuren', '大六壬 / 太乙神数', 'Liu Ren & Tai Yi', '华语圈', '汉—', 'divination',
    [14, 12, 20, 5, 2], '时辰起课 → 十二天将',
    '未纳入个体评分（面向事件占断），仅列入普查'),
  S('kyusei', '九星气学', 'Kyūsei Kigaku (Nine Star Ki)', '日本', '20 世纪初系统化', 'divination',
    [22, 20, 25, 10, 3], '出生年月 → 九宫本命星',
    '与八字月令共享节气换月逻辑'),
  S('saju', '四柱（韩国 사주）', 'Saju Palja', '韩国', '高丽—', 'divination',
    [48, 50, 62, 25, 5], '与八字同源，婚配与择业中广泛使用',
    '共用 BaZi 引擎；合婚规则已对称化去性别化'),
  S('tuvi', '越南紫微（Tử Vi）', 'Tử Vi', '越南', '—', 'divination',
    [30, 30, 25, 12, 3], '与紫微斗数同源的十二宫命盘', '结构对照层：与紫微斗数共用宫位语义对照'),
  S('mahabote', '缅甸摩诃菩提 / 泰国生日历', 'Mahabote & Thai Day Astrology', '东南亚上座部佛教区', '—', 'divination',
    [22, 24, 15, 20, 2], '出生星期 → 八曜宫位',
    '结构对照层：出生星期可由 JDN 直接得出，供跨体系比对'),
  S('tibetan', '藏历命理 / 藏医体质', 'Tibetan Astrology & Sowa Rigpa', '藏区 / 喜马拉雅', '11 世纪—', 'somatic',
    [16, 18, 12, 18, 8], '时轮历 + 五行 + 三因（隆/赤巴/培根）',
    '体质三分与阿育吠陀三体质在反向映射中并列'),
  S('ayurveda', '阿育吠陀三体质', 'Ayurvedic Doshas', '南亚 + 全球健康产业', '公元前—', 'somatic',
    [44, 40, 58, 40, 22], '问诊/体征 → 风、火、土三体质',
    '反向映射：十二维 → vata / pitta / kapha'),
  S('tcm', '中医体质学说（九分类）', 'TCM Constitution Typing', '华语圈 + 全球中医', '古代 / 2009 标准化', 'somatic',
    [50, 45, 55, 55, 30], '体质量表 → 平和/气虚/阳虚等九型',
    '反向映射：十二维 → 体质倾向（简化子集）'),
  S('celtic', '凯尔特树历', 'Celtic Tree Calendar', '欧美新异教', '20 世纪建构', 'divination',
    [18, 12, 12, 2, 3], '出生日期 → 13 树月',
    '结构对照层：出生日期直接映射，展示于出生符号图'),
  S('abjad', '阿拉伯字母数字命理（Abjad / Ilm al-Raml）', 'Abjad Numerology & Geomancy', '中东 / 北非 / 南亚', '中世纪—', 'divination',
    [30, 25, 18, 10, 6], '姓名字母数值 + 沙占十六图',
    '沙占十六图与 16 型分类学的历史同源性见 docs/01'),
  S('medicinewheel', '药轮 / 图腾体系', 'Medicine Wheel & Totem Traditions', '北美原住民（及其流行文化改写）', '前殖民时期—', 'divination',
    [24, 15, 12, 8, 5], '方位 + 季节 + 动物图腾',
    '仅列入普查；商业化改写涉及文化挪用争议，OML 不做映射'),
  S('polynesian', '波利尼西亚星历导航', 'Polynesian Star Calendars', '太平洋岛屿', '古代—', 'divination',
    [10, 10, 5, 12, 8], '月相与星象历 → 农事与命名',
    '仅列入普查：其月相历与出生月相层同源，但不做特质映射'),
  S('socionics', '社会人格学', 'Socionics', '俄语圈 / 东欧', '1970s—', 'psychometric',
    [20, 22, 12, 8, 12], '与 MBTI 同源的十六型 + 信息元模型',
    '可用 MBTI 通道近似互译'),
  S('clifton', '盖洛普优势识别（CliftonStrengths）', 'CliftonStrengths', '全球职场', '2001—', 'psychometric',
    [30, 32, 55, 45, 25], '自陈问卷 → 34 项优势排序',
    '对照层：优势主题与十二维的聚类对照'),
  S('hexaco', 'HEXACO 六因素', 'HEXACO', '学术界', '2000s—', 'psychometric',
    [12, 15, 8, 25, 72], '自陈问卷 → 六因素（含诚实-谦逊）',
    '对照层：H 因素与「垣」「根」的关系见 docs/03'),
  S('colorpsych', '性格色彩 / 四色性格', 'Four-Color Personality (乐嘉体系等)', '中国大陆', '2000s—', 'popculture',
    [38, 28, 35, 15, 5], '自陈问卷 → 红蓝黄绿四色',
    '对照表：红↔曜、蓝↔衡、黄↔锻、绿↔流'),
  S('sixteenpersonalities', '16Personalities（NERIS）', '16Personalities / NERIS', '全球互联网', '2011—', 'popculture',
    [70, 60, 45, 10, 8], 'MBTI 变体 + 「-A/-T」身份轴',
    'OML 的 -A/-T 调性后缀在结构位置上与其对应（但定义不同：见 docs/02 §5.3）'),
  S('kinsey', '金赛量表 / 克莱因方格 / 分离吸引模型', 'Kinsey Scale, Klein Grid, SAM', '全球', '1948 / 1978 / 2000s', 'identity',
    [44, 35, 5, 20, 45], '自陈：性/浪漫吸引的多维连续谱',
    '仅作身份与匹配准入维度使用，明确不参与任何人格特质推断（docs/05）'),
  S('gendersp', '性别认同与表达谱系', 'Gender Identity & Expression Spectrum', '全球', '20 世纪后期—', 'identity',
    [50, 40, 5, 35, 50], '自陈：认同、表达、指派性别的分离模型',
    '同上：自陈字段，仅用于称谓与匹配意愿，永不作为特质预测变量'),
];

export function influenceIndex(s) {
  return +(
    WEIGHTS.reach * s.reach + WEIGHTS.active * s.active + WEIGHTS.commerce * s.commerce
    + WEIGHTS.institution * s.institution + WEIGHTS.academia * s.academia
  ).toFixed(2);
}

export function rankedSystems() {
  return SYSTEMS
    .map((s) => ({ ...s, influence: influenceIndex(s) }))
    .sort((a, b) => b.influence - a.influence)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export const FAMILY_LABELS = {
  divination: { zh: '传统命理/占卜', en: 'Divination', color: '#c9a227' },
  psychometric: { zh: '现代心理测量', en: 'Psychometrics', color: '#4c8bf5' },
  popculture: { zh: '流行文化分类', en: 'Pop typology', color: '#d96ba0' },
  identity: { zh: '身份自述框架', en: 'Identity framework', color: '#5bbfa5' },
  somatic: { zh: '体质/医学传统', en: 'Somatic tradition', color: '#8f7ae5' },
};
