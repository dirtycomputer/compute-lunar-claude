/**
 * questionnaire.js — OML-144 标准问卷 / The OML-144 Standard Inventory
 *
 * 结构：12 维 × 12 题 = 144 题（8 正向 + 4 反向）。
 * 量表：7 点李克特（1 完全不符合 … 4 中性 … 7 完全符合）。
 * 反向题 k = -1，计分时取反，用于检测默认同意倾向（acquiescence bias）。
 *
 * 另有 12 道情境题（context），不计入十二维分数，仅用于：
 *   (a) 关系匹配的准入与偏好；(b) 可选的他系统自陈先验（MBTI / 九型 / 血型）。
 * 身份类信息（性别认同、性倾向、关系形态）在任何情况下都不参与人格特质推断，
 * 详见 docs/05-ethics-inclusion.md。
 */

/** 题库：id 前缀即维度键 */
export const ITEMS = [
  // ——— R 曜 Radiance ———
  { id: 'R01', d: 'R', k: 1, zh: '在热闹的场合待一整晚，我离开时比到场时更有精神。', en: 'After a whole evening in a lively crowd, I leave with more energy than I arrived with.' },
  { id: 'R02', d: 'R', k: 1, zh: '认识新的人对我是补给，而不是消耗。', en: 'Meeting new people refuels me rather than drains me.' },
  { id: 'R03', d: 'R', k: 1, zh: '我常常先说出来，再在说的过程中想清楚。', en: 'I often speak first and figure out what I think while talking.' },
  { id: 'R04', d: 'R', k: 1, zh: '被注视时我会更进入状态，而不是更紧张。', en: 'Being watched puts me more into my element, not less.' },
  { id: 'R05', d: 'R', k: 1, zh: '我习惯主动打破沉默。', en: 'I am usually the one who breaks a silence.' },
  { id: 'R06', d: 'R', k: 1, zh: '我的情绪状态，周围的人几乎都能立刻看出来。', en: 'People around me can read my mood almost immediately.' },
  { id: 'R07', d: 'R', k: 1, zh: '一整天没和人真正说过话，我会觉得少了什么。', en: 'A day without a real conversation feels like something is missing.' },
  { id: 'R08', d: 'R', k: 1, zh: '我希望自己的名字被人记住、被人提起。', en: 'I want my name to be remembered and mentioned.' },
  { id: 'R09', d: 'R', k: -1, zh: '我需要很长时间独自恢复，才能再次面对人群。', en: 'I need a long solitary recovery before I can face people again.' },
  { id: 'R10', d: 'R', k: -1, zh: '在群体里我更愿意待在边缘观察。', en: 'In a group I would rather stay on the edge and observe.' },
  { id: 'R11', d: 'R', k: -1, zh: '主动联系别人对我来说需要额外的力气。', en: 'Reaching out to people first costs me extra effort.' },
  { id: 'R12', d: 'R', k: -1, zh: '我更喜欢文字沟通，因为它可以不即时。', en: 'I prefer written communication because it need not be immediate.' },

  // ——— D 渊 Depth ———
  { id: 'D01', d: 'D', k: 1, zh: '我需要固定的独处时间，否则会变得干枯。', en: 'I need regular solitude or I go dry inside.' },
  { id: 'D02', d: 'D', k: 1, zh: '我常长时间沉浸在一件事里，忘记时间与身体。', en: 'I sink into one thing for hours and forget time and body.' },
  { id: 'D03', d: 'D', k: 1, zh: '我有一些从未告诉任何人的内在世界。', en: 'I keep an inner world I have never told anyone about.' },
  { id: 'D04', d: 'D', k: 1, zh: '我喜欢把一个问题想到底，而不是想个大概。', en: 'I like thinking a question all the way down, not roughly.' },
  { id: 'D05', d: 'D', k: 1, zh: '独自旅行或独自吃饭对我是享受。', en: 'Traveling or eating alone is a pleasure for me.' },
  { id: 'D06', d: 'D', k: 1, zh: '我的重要决定几乎都是在独处时做出的。', en: 'Nearly all my important decisions were made alone.' },
  { id: 'D07', d: 'D', k: 1, zh: '我需要先在心里演练，才能在外面表达。', en: 'I rehearse internally before I can express something outwardly.' },
  { id: 'D08', d: 'D', k: 1, zh: '睡前我常回放白天发生的细节。', en: 'Before sleep I replay the details of the day.' },
  { id: 'D09', d: 'D', k: -1, zh: '一个人待太久我会开始烦躁。', en: 'Too much time alone makes me restless.' },
  { id: 'D10', d: 'D', k: -1, zh: '我很少反省自己，事情过去就过去了。', en: 'I rarely examine myself; what is past is past.' },
  { id: 'D11', d: 'D', k: -1, zh: '我几乎没有什么不能对外人说的事。', en: 'There is almost nothing I could not tell a stranger.' },
  { id: 'D12', d: 'D', k: -1, zh: '我不太理解「需要独处」是什么意思。', en: 'I do not really understand what "needing alone time" means.' },

  // ——— L 衡 Ledger ———
  { id: 'L01', d: 'L', k: 1, zh: '听到结论时，我会本能地想知道依据是什么。', en: 'Hearing a conclusion, I instinctively want to know the evidence.' },
  { id: 'L02', d: 'L', k: 1, zh: '我喜欢把模糊的目标拆成可测量的指标。', en: 'I like breaking vague goals into measurable indicators.' },
  { id: 'L03', d: 'L', k: 1, zh: '做决定前我会尽量把选项列出来比较。', en: 'Before deciding I lay out the options and compare them.' },
  { id: 'L04', d: 'L', k: 1, zh: '我对数字、时间、金额有敏感度。', en: 'I am sensitive to numbers, times and amounts.' },
  { id: 'L05', d: 'L', k: 1, zh: '别人说「大概、差不多」时，我想确认具体值。', en: 'When people say "roughly", I want the actual figure.' },
  { id: 'L06', d: 'L', k: 1, zh: '我更信任可复现的经验，而不是一次性的奇迹。', en: 'I trust reproducible experience over one-off miracles.' },
  { id: 'L07', d: 'L', k: 1, zh: '我喜欢流程、清单和明确的定义。', en: 'I like procedures, checklists and clear definitions.' },
  { id: 'L08', d: 'L', k: 1, zh: '遇到复杂问题，我先建立框架再填内容。', en: 'For complex problems I build a framework before filling it in.' },
  { id: 'L09', d: 'L', k: -1, zh: '我常凭感觉下结论，事后才补理由。', en: 'I often conclude by feel and supply reasons afterwards.' },
  { id: 'L10', d: 'L', k: -1, zh: '细节让我烦躁，我只要一个大方向。', en: 'Details irritate me; I only want the general direction.' },
  { id: 'L11', d: 'L', k: -1, zh: '我很少检查信息的来源。', en: 'I seldom check where information came from.' },
  { id: 'L12', d: 'L', k: -1, zh: '计划对我来说大多是多余的。', en: 'Plans are mostly redundant for me.' },

  // ——— O 兆 Omen ———
  { id: 'O01', d: 'O', k: 1, zh: '结论常常先于推理到达我这里。', en: 'Conclusions arrive before the reasoning does.' },
  { id: 'O02', d: 'O', k: 1, zh: '我会注意巧合，并觉得它们携带信息。', en: 'I notice coincidences and feel they carry information.' },
  { id: 'O03', d: 'O', k: 1, zh: '我用比喻理解世界比用定义更顺手。', en: 'Metaphor works better than definition for understanding the world.' },
  { id: 'O04', d: 'O', k: 1, zh: '我做过对现实有提示意义的梦。', en: 'I have had dreams that seemed to hint at reality.' },
  { id: 'O05', d: 'O', k: 1, zh: '我对人的第一眼判断通常后来被证实。', en: 'My first impressions of people usually turn out right.' },
  { id: 'O06', d: 'O', k: 1, zh: '我相信有些事情无法被完全测量。', en: 'I believe some things cannot be fully measured.' },
  { id: 'O07', d: 'O', k: 1, zh: '我常在不相关的事物之间看到同一个模式。', en: 'I see the same pattern across unrelated things.' },
  { id: 'O08', d: 'O', k: 1, zh: '仪式感（生日、纪念日、开工吉时）对我有真实作用。', en: 'Ritual timing — birthdays, anniversaries, auspicious starts — really works on me.' },
  { id: 'O09', d: 'O', k: -1, zh: '「直觉」在我这里不算有效证据。', en: '"Intuition" does not count as evidence for me.' },
  { id: 'O10', d: 'O', k: -1, zh: '象征、塔罗、星座对我只是娱乐修辞。', en: 'Symbols, tarot and horoscopes are just entertainment to me.' },
  { id: 'O11', d: 'O', k: -1, zh: '我从不觉得偶然事件有额外含义。', en: 'I never read extra meaning into chance events.' },
  { id: 'O12', d: 'O', k: -1, zh: '我很难理解别人说的「感觉不对」。', en: 'I struggle to understand people who say "it just feels off".' },

  // ——— F 锻 Forge ———
  { id: 'F01', d: 'F', k: 1, zh: '我不接受默认设置，总想改写规则。', en: 'I do not accept default settings; I want to rewrite the rules.' },
  { id: 'F02', d: 'F', k: 1, zh: '在团队里我常自然而然承担定方向的角色。', en: 'In a team I naturally end up setting the direction.' },
  { id: 'F03', d: 'F', k: 1, zh: '竞争让我兴奋，而不是紧张。', en: 'Competition excites me rather than stresses me.' },
  { id: 'F04', d: 'F', k: 1, zh: '我给自己的标准高于别人对我的期待。', en: 'My standards for myself exceed what others expect of me.' },
  { id: 'F05', d: 'F', k: 1, zh: '遇到阻碍，我第一反应是找突破口而不是绕开。', en: 'Facing an obstacle, my first move is to break through, not around.' },
  { id: 'F06', d: 'F', k: 1, zh: '我愿意为目标承受长期的不舒服。', en: 'I will endure long discomfort for a goal.' },
  { id: 'F07', d: 'F', k: 1, zh: '在重要的事情上没有话语权，我很难忍受。', en: 'Having no say in something important is intolerable to me.' },
  { id: 'F08', d: 'F', k: 1, zh: '我相信环境是可以被我改变的。', en: 'I believe my environment can be changed by me.' },
  { id: 'F09', d: 'F', k: -1, zh: '我更愿意让别人决定，然后配合。', en: 'I would rather let others decide and then go along.' },
  { id: 'F10', d: 'F', k: -1, zh: '我没有什么长期想达成的目标。', en: 'I do not have long-term goals I am driving at.' },
  { id: 'F11', d: 'F', k: -1, zh: '被推着走比自己找方向轻松得多。', en: 'Being carried along is far easier than finding my own direction.' },
  { id: 'F12', d: 'F', k: -1, zh: '我很少主动争取本可以争取的东西。', en: 'I rarely go after things I could have gone after.' },

  // ——— C 流 Current ———
  { id: 'C01', d: 'C', k: 1, zh: '计划被打乱时，我能很快找到新的玩法。', en: 'When plans break, I quickly find a new way to play it.' },
  { id: 'C02', d: 'C', k: 1, zh: '我相信绕路本身也会带来东西。', en: 'I believe detours give something of their own.' },
  { id: 'C03', d: 'C', k: 1, zh: '信息不完整时我也能先出发。', en: 'I can set off before the information is complete.' },
  { id: 'C04', d: 'C', k: 1, zh: '不控制结果，我也能安心投入过程。', en: 'I can commit to a process without controlling its outcome.' },
  { id: 'C05', d: 'C', k: 1, zh: '事情失控时，我更倾向接受而不是对抗。', en: 'When things go out of control I accept rather than fight.' },
  { id: 'C06', d: 'C', k: 1, zh: '我常常临场发挥比事先准备更好。', en: 'I often improvise better than I prepare.' },
  { id: 'C07', d: 'C', k: 1, zh: '我能与「暂时没有答案」共处很久。', en: 'I can live with "no answer yet" for a long time.' },
  { id: 'C08', d: 'C', k: 1, zh: '我认为很多事有它自己的时机。', en: 'I think many things have their own timing.' },
  { id: 'C09', d: 'C', k: -1, zh: '没有明确路径我无法开始。', en: 'Without a clear path I cannot start.' },
  { id: 'C10', d: 'C', k: -1, zh: '失控感对我来说很难忍受。', en: 'Loss of control is very hard for me to bear.' },
  { id: 'C11', d: 'C', k: -1, zh: '行程被临时改变会让我一整天不舒服。', en: 'A last-minute change of plan spoils my whole day.' },
  { id: 'C12', d: 'C', k: -1, zh: '我需要提前知道所有环节才能放松。', en: 'I can only relax once I know every step in advance.' },

  // ——— P 汐 Pulse ———
  { id: 'P01', d: 'P', k: 1, zh: '我的感受来得又快又强。', en: 'My feelings arrive fast and strong.' },
  { id: 'P02', d: 'P', k: 1, zh: '别人的情绪会直接进入我的身体。', en: 'Other people’s emotions enter my body directly.' },
  { id: 'P03', d: 'P', k: 1, zh: '一部电影、一首歌可以改变我一整天的状态。', en: 'A film or a song can change my whole day.' },
  { id: 'P04', d: 'P', k: 1, zh: '我会因为一句无心的话反复想很久。', en: 'One careless remark can occupy me for a long time.' },
  { id: 'P05', d: 'P', k: 1, zh: '我很容易被美的东西击中。', en: 'Beauty hits me easily.' },
  { id: 'P06', d: 'P', k: 1, zh: '在意的人不开心时，我很难置身事外。', en: 'When someone I care about is unhappy, I cannot stay outside it.' },
  { id: 'P07', d: 'P', k: 1, zh: '我的情绪一天之内可以有很大起伏。', en: 'My mood can swing widely within a single day.' },
  { id: 'P08', d: 'P', k: 1, zh: '我常在别人开口前就察觉气氛变了。', en: 'I sense the mood shift before anyone speaks.' },
  { id: 'P09', d: 'P', k: -1, zh: '我很少有强烈的情绪反应。', en: 'I rarely have strong emotional reactions.' },
  { id: 'P10', d: 'P', k: -1, zh: '别人哭的时候我通常没什么感觉。', en: 'When others cry I usually feel little.' },
  { id: 'P11', d: 'P', k: -1, zh: '我常常事后很久才知道自己当时不开心。', en: 'I often realize much later that I had been upset.' },
  { id: 'P12', d: 'P', k: -1, zh: '音乐、电影很难真正影响我的状态。', en: 'Music and films rarely truly affect my state.' },

  // ——— S 磐 Stone ———
  { id: 'S01', d: 'S', k: 1, zh: '危机中我反而变得更清醒。', en: 'In a crisis I become clearer, not foggier.' },
  { id: 'S02', d: 'S', k: 1, zh: '情绪起伏基本不影响我的判断和行动。', en: 'Mood swings barely affect my judgment and action.' },
  { id: 'S03', d: 'S', k: 1, zh: '我从挫折中恢复得比大多数人快。', en: 'I recover from setbacks faster than most people.' },
  { id: 'S04', d: 'S', k: 1, zh: '长期不确定中我仍能维持日常秩序。', en: 'I keep daily order even under prolonged uncertainty.' },
  { id: 'S05', d: 'S', k: 1, zh: '别人慌乱时会自然地看向我。', en: 'When others panic they naturally look toward me.' },
  { id: 'S06', d: 'S', k: 1, zh: '我很少因为焦虑而失眠。', en: 'Anxiety rarely costs me sleep.' },
  { id: 'S07', d: 'S', k: 1, zh: '被批评时我能先看内容再看情绪。', en: 'Under criticism I read the content before the emotion.' },
  { id: 'S08', d: 'S', k: 1, zh: '我可以带着未解决的问题正常生活。', en: 'I can live normally with unresolved problems.' },
  { id: 'S09', d: 'S', k: -1, zh: '一件小事出错会掀翻我一整天。', en: 'One small thing going wrong overturns my whole day.' },
  { id: 'S10', d: 'S', k: -1, zh: '我需要很长时间才能从难过里走出来。', en: 'It takes me a long time to climb out of sadness.' },
  { id: 'S11', d: 'S', k: -1, zh: '压力大时我会先崩溃再处理。', en: 'Under pressure I fall apart first and cope later.' },
  { id: 'S12', d: 'S', k: -1, zh: '我经常担心还没发生的事。', en: 'I often worry about things that have not happened.' },

  // ——— W 织 Weave ———
  { id: 'W01', d: 'W', k: 1, zh: '关系是我生活意义的主要来源。', en: 'Relationships are my main source of meaning.' },
  { id: 'W02', d: 'W', k: 1, zh: '我愿意为共同体让渡一部分个人自由。', en: 'I will give up some personal freedom for a community.' },
  { id: 'W03', d: 'W', k: 1, zh: '我会主动维系那些容易断掉的联系。', en: 'I actively maintain connections that would otherwise lapse.' },
  { id: 'W04', d: 'W', k: 1, zh: '独自成功对我来说不如共同经历有价值。', en: 'Succeeding alone is worth less to me than shared experience.' },
  { id: 'W05', d: 'W', k: 1, zh: '我习惯先考虑「我们」再考虑「我」。', en: 'I think "we" before I think "I".' },
  { id: 'W06', d: 'W', k: 1, zh: '我很在意自己在重要的人心中的位置。', en: 'My place in the minds of people I love matters greatly.' },
  { id: 'W07', d: 'W', k: 1, zh: '我喜欢长期、深入、少而稳的关系。', en: 'I prefer few, deep, long, stable relationships.' },
  { id: 'W08', d: 'W', k: 1, zh: '有人需要我时，我会获得能量。', en: 'Being needed gives me energy.' },
  { id: 'W09', d: 'W', k: -1, zh: '我不需要靠关系来定义自己。', en: 'I do not define myself through relationships.' },
  { id: 'W10', d: 'W', k: -1, zh: '长时间不联系的朋友我也不会觉得可惜。', en: 'Friendships that lapse do not feel like a loss to me.' },
  { id: 'W11', d: 'W', k: -1, zh: '我更愿意一个人完成所有事。', en: 'I would rather do everything by myself.' },
  { id: 'W12', d: 'W', k: -1, zh: '归属感对我并不重要。', en: 'Belonging is not important to me.' },

  // ——— B 垣 Bastion ———
  { id: 'B01', d: 'B', k: 1, zh: '我说「不」的时候不需要理由。', en: 'When I say no, I do not owe a reason.' },
  { id: 'B02', d: 'B', k: 1, zh: '别人的期待改变不了我的核心决定。', en: 'Others’ expectations do not move my core decisions.' },
  { id: 'B03', d: 'B', k: 1, zh: '我清楚自己哪些部分不对外开放。', en: 'I know exactly which parts of me stay closed.' },
  { id: 'B04', d: 'B', k: 1, zh: '我需要能自己做主的空间，否则会窒息。', en: 'I need space where I decide, or I suffocate.' },
  { id: 'B05', d: 'B', k: 1, zh: '我不会为了合群而改变立场。', en: 'I do not change my position to fit in.' },
  { id: 'B06', d: 'B', k: 1, zh: '被讨厌时我仍能继续做我认为对的事。', en: 'I keep doing what I believe is right even when disliked.' },
  { id: 'B07', d: 'B', k: 1, zh: '我对自己的时间有很强的控制权。', en: 'I hold firm control over my own time.' },
  { id: 'B08', d: 'B', k: 1, zh: '我不轻易把决定权交给别人。', en: 'I do not hand my decisions to others easily.' },
  { id: 'B09', d: 'B', k: -1, zh: '我很难拒绝别人的请求。', en: 'I find it hard to refuse a request.' },
  { id: 'B10', d: 'B', k: -1, zh: '我常在事后才发现自己被越界了。', en: 'I usually notice a boundary was crossed only afterwards.' },
  { id: 'B11', d: 'B', k: -1, zh: '别人不高兴时我会先让步。', en: 'When someone is displeased I concede first.' },
  { id: 'B12', d: 'B', k: -1, zh: '我需要别人的认可才能确认自己的选择。', en: 'I need approval to be sure of my own choice.' },

  // ——— M 化 Meta ———
  { id: 'M01', d: 'M', k: 1, zh: '重复的生活会让我枯萎。', en: 'Repetition withers me.' },
  { id: 'M02', d: 'M', k: 1, zh: '我愿意为了新版本的自己拆掉旧的。', en: 'I will dismantle an old self for a new version.' },
  { id: 'M03', d: 'M', k: 1, zh: '我经常主动更换环境、方法或身份。', en: 'I regularly change my environment, methods or identity on purpose.' },
  { id: 'M04', d: 'M', k: 1, zh: '对没试过的事，我第一反应是想试。', en: 'My first reaction to the untried is to try it.' },
  { id: 'M05', d: 'M', k: 1, zh: '我不害怕推翻自己过去的观点。', en: 'I am not afraid to overturn my past views.' },
  { id: 'M06', d: 'M', k: 1, zh: '我喜欢处在还没有定型的阶段。', en: 'I like being in the stage where nothing has set yet.' },
  { id: 'M07', d: 'M', k: 1, zh: '我更相信「成为」而不是「是」。', en: 'I believe in becoming more than in being.' },
  { id: 'M08', d: 'M', k: 1, zh: '我常同时对好几个新领域感兴趣。', en: 'I am usually curious about several new fields at once.' },
  { id: 'M09', d: 'M', k: -1, zh: '变化需要充分理由，否则不如不变。', en: 'Change needs a good reason; otherwise do not change.' },
  { id: 'M10', d: 'M', k: -1, zh: '我能在同一套方法里待很多年。', en: 'I can stay inside one method for many years.' },
  { id: 'M11', d: 'M', k: -1, zh: '新环境让我不安多过兴奋。', en: 'New environments unsettle me more than they excite me.' },
  { id: 'M12', d: 'M', k: -1, zh: '我不太更新自己已经形成的判断。', en: 'I seldom update judgments I have already formed.' },

  // ——— G 根 Ground ———
  { id: 'G01', d: 'G', k: 1, zh: '我愿意守住一件事很多年。', en: 'I will hold to one thing for many years.' },
  { id: 'G02', d: 'G', k: 1, zh: '来处、家族、传统对我有真实的重量。', en: 'Origin, family and tradition carry real weight for me.' },
  { id: 'G03', d: 'G', k: 1, zh: '我重视承诺，答应过的事很少反悔。', en: 'I take promises seriously and rarely go back on them.' },
  { id: 'G04', d: 'G', k: 1, zh: '我喜欢有历史的东西：老物件、老店、旧照片。', en: 'I love things with history: old objects, old shops, old photographs.' },
  { id: 'G05', d: 'G', k: 1, zh: '我会主动维护节日、纪念这类仪式。', en: 'I actively keep festivals and commemorations alive.' },
  { id: 'G06', d: 'G', k: 1, zh: '我倾向于修复而不是更换。', en: 'I would rather repair than replace.' },
  { id: 'G07', d: 'G', k: 1, zh: '稳定的秩序让我有安全感。', en: 'Stable order makes me feel safe.' },
  { id: 'G08', d: 'G', k: 1, zh: '我在意自己留下什么，而不只是得到什么。', en: 'I care about what I leave behind, not only what I get.' },
  { id: 'G09', d: 'G', k: -1, zh: '过去对我没有约束力。', en: 'The past has no hold on me.' },
  { id: 'G10', d: 'G', k: -1, zh: '传统习俗对我而言只是形式。', en: 'Traditional customs are mere formality to me.' },
  { id: 'G11', d: 'G', k: -1, zh: '我很难长期专注在同一件事上。', en: 'I struggle to stay with one thing for long.' },
  { id: 'G12', d: 'G', k: -1, zh: '我不太在意自己的来处。', en: 'I do not much care where I came from.' },
];

export const LIKERT = [
  { v: 1, zh: '完全不符合', en: 'Strongly disagree' },
  { v: 2, zh: '大部分不符合', en: 'Disagree' },
  { v: 3, zh: '略不符合', en: 'Slightly disagree' },
  { v: 4, zh: '中性 / 不确定', en: 'Neutral' },
  { v: 5, zh: '略符合', en: 'Slightly agree' },
  { v: 6, zh: '大部分符合', en: 'Agree' },
  { v: 7, zh: '完全符合', en: 'Strongly agree' },
];

/**
 * 情境题（不计入十二维）。
 * identity 类字段仅用于称谓、匹配准入与统计，绝不作为人格特质的预测变量。
 */
export const CONTEXT_ITEMS = [
  {
    id: 'gender', type: 'select', scope: 'identity', required: false,
    zh: '性别认同', en: 'Gender identity',
    note: '自我描述优先；此项不参与任何人格推断。',
    options: [
      ['woman', '女性 Woman'], ['man', '男性 Man'],
      ['nonbinary', '非二元 Non-binary'], ['genderfluid', '性别流动 Genderfluid'],
      ['agender', '无性别 Agender'], ['transfem', '跨性别女性 Trans woman'],
      ['transmasc', '跨性别男性 Trans man'], ['intersex', '间性 Intersex'],
      ['questioning', '探索中 Questioning'], ['undisclosed', '不愿透露 Prefer not to say'],
      ['self', '自我描述 Self-describe'],
    ],
  },
  {
    id: 'pronouns', type: 'text', scope: 'identity', required: false,
    zh: '希望被使用的人称', en: 'Pronouns',
    placeholder: '如 她/ta/they/he，或留空',
  },
  {
    id: 'orientation', type: 'select', scope: 'identity', required: false,
    zh: '性/浪漫倾向（自陈标签）', en: 'Sexual / romantic orientation (self-label)',
    options: [
      ['straight', '异性恋 Straight'], ['gay', '同性恋 Gay/Lesbian'],
      ['bi', '双性恋 Bisexual'], ['pan', '泛性恋 Pansexual'],
      ['ace', '无性恋谱系 Asexual spectrum'], ['aro', '无浪漫倾向谱系 Aromantic spectrum'],
      ['queer', '酷儿 Queer'], ['questioning', '探索中 Questioning'],
      ['undisclosed', '不愿透露 Prefer not to say'],
    ],
  },
  {
    id: 'attractedTo', type: 'multi', scope: 'matching', required: false,
    zh: '希望被匹配到的性别（可多选）', en: 'Genders you want to be matched with (multi)',
    options: [
      ['woman', '女性'], ['man', '男性'], ['nonbinary', '非二元/性别多元'],
      ['any', '不限 Any'], ['none', '暂不寻求 Not seeking'],
    ],
  },
  {
    id: 'relStyle', type: 'select', scope: 'matching', required: false,
    zh: '关系形态偏好', en: 'Relationship structure',
    options: [
      ['mono', '单偶 Monogamous'], ['open', '开放式 Open'],
      ['poly', '多元关系 Polyamorous'], ['qpr', '柏拉图优先/酷儿式伙伴 QPR'],
      ['undecided', '尚未确定 Undecided'],
    ],
  },
  {
    id: 'intimacyPace', type: 'select', scope: 'matching', required: false,
    zh: '亲密推进节奏', en: 'Pace of intimacy',
    options: [['fast', '快 Fast'], ['medium', '中 Medium'], ['slow', '慢 Slow']],
  },
  // —— 可选的他系统自陈（作为极小权重的辅助先验）——
  { id: 'mbtiSelf', type: 'text', scope: 'prior', zh: '你已知的 MBTI（可选）', en: 'Known MBTI (optional)', placeholder: '如 INTJ' },
  { id: 'enneaSelf', type: 'select', scope: 'prior', zh: '你已知的九型人格（可选）', en: 'Known Enneagram (optional)', options: [['', '未知']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), `${n} 号`])) },
  { id: 'bloodType', type: 'select', scope: 'prior', zh: '血型（东亚文化符号，权重极低）', en: 'Blood type (East-Asian cultural symbol, minimal weight)', options: [['', '未知'], ['A', 'A'], ['B', 'B'], ['O', 'O'], ['AB', 'AB']] },
  { id: 'symbolWeight', type: 'range', scope: 'config', zh: '象征层权重 λb（0 = 纯心理测量，0.40 = 象征层影响最大）', en: 'Symbolic layer weight λb', min: 0, max: 0.4, step: 0.05, default: 0.15 },
];

export const ITEM_COUNT = ITEMS.length;
export const ITEMS_BY_DIM = ITEMS.reduce((acc, it) => {
  (acc[it.d] ||= []).push(it);
  return acc;
}, {});

/** 固定伪随机打散题序（避免同维度连续出现），保证可复现 */
export function shuffledItems(seed = 20260828) {
  const arr = ITEMS.map((it, i) => ({ it, i }));
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // 相邻同维度的做一次局部推离
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i].it.d === arr[i - 1].it.d) {
      for (let j = i + 1; j < arr.length; j += 1) {
        if (arr[j].it.d !== arr[i - 1].it.d && (i + 1 >= arr.length || arr[j].it.d !== arr[i + 1]?.it.d)) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          break;
        }
      }
    }
  }
  return arr.map((x) => x.it);
}
