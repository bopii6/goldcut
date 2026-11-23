// 视频类型：每种类型有自己的调研重点、文案结构和镜头骨架。
//   story   财经解读（原来那种：钩子 → 讲故事 → 证据 → 结论，模型自由选 vp- 组件）
//   news    新闻速报：今天 N 件事，每条 标题 → 数字 → 点评，常驻日期栏、条数进度、滚动快讯
//   rank    榜单盘点：TOP N 从最后一名倒数到第一，每名 名次砸下 → 数据条 → 点评，常驻名次栏
//   explain 知识科普：抛问题 → 分几步讲（流程 / 类比 / 要点）→ 总结，常驻章节导航
// 除了 story，模型只写"内容"（结构化 JSON），镜头由这里的 compile 按固定骨架拼出来——类型的结构是程序保证的，不靠模型自觉。
import {chat, parseJSON} from './deepseek.mjs';

export const FORMATS = {
  story: {name: '财经解读', desc: '讲一笔账：钩子、证据、因果、结论，小Lin说那种', icon: '📈', research: ''},
  news: {name: '新闻速报', desc: '今天 N 件事：每条一个数字一句点评，带日期栏和滚动快讯', icon: '📰',
    research: '这条视频是"新闻速报"：重点找最近 1–3 天里和话题相关的 3–5 条彼此独立的新闻事件。每条写清：发生了什么（一句话）、日期、哪家媒体报的、一个关键数字（带单位）、出处网址。'},
  rank: {name: '榜单盘点', desc: 'TOP 5 从第五名倒数到第一，名次砸下、数据条比大小', icon: '🏆',
    research: '这条视频是"榜单盘点"：重点找一份能排出 TOP 5 的完整数据——同一口径、同一年份、同一单位。列出第 1 到第 5 名的名字、数值、出处；再给每一名找一个有意思的点（为什么上榜、反常的地方）。'},
  explain: {name: '知识科普', desc: 'X 是什么、怎么运作：分三步图解，流程、类比、要点', icon: '💡',
    research: '这条视频是"知识科普"：重点查清它的原理和运作机制，拆成 3 个循序渐进的步骤；每一步找一个关键事实或数字；再想一个贴切的生活类比。'},
};
export const formatList = () => Object.entries(FORMATS).map(([id, f]) => ({id, name: f.name, desc: f.desc, icon: f.icon}));

const SYSTEM = `你是一位中文财经/科技短视频的编剧，口语、第一人称、句句往下接，不说套话。你写的内容会被程序直接排成 1080×1920 竖屏视频，必须严格按要求输出 JSON。`;
const LINE_RULES = `# 口播句的要求（所有 say 开头的字段）
- 每句 8–28 个字；一句里每个逗号分开的分句不超过 14 个字。数字照常写（"1158亿美元"、"7%"），会自动念出来。
- 口语化，像在跟朋友讲；不要"大家好""欢迎关注""让我们"。
- 所有事实和数字只能来自调研简报，不许编。`;
const imgList = images => images.length ? images.map(im => `- ${im.path}：${im.desc || im.title}`).join('\n') : '（没有可用图片，img 一律写 null）';

const PROMPTS = {
  news: (topic, brief, images, o) => `话题：${topic}
今天是 ${o.today}。

# 调研简报
${brief}

# 可用图片
${imgList(images)}

# 输出这样的 JSON（新闻速报，${o.items} 条新闻，念完约 ${o.seconds} 秒）
{
  "title": "片名，≤10 字",
  "oneLiner": "看完能记住的一句话",
  "accent": "#rrggbb 主色（新闻一般用红、橙、蓝）",
  "kicker": "栏目名，2 个字：早报 / 快讯 / 晚报 / 周报 选一个",
  "date": "节目日期，如 11月23日",
  "intro": "开场口播一句：今天几件事 + 最抓人的那件",
  "items": [
    {"headline": "标题 ≤16 字，可用 <em>重点</em>", "short": "短标题 ≤10 字", "source": "媒体名",
     "say": "念这条新闻的口播句", "value": "关键数字（只写数字和符号，如 1158、-6.9%、$104），没有就 null", "unit": "单位", "label": "数字说明 ≤10 字",
     "sayNum": "带出这个数字的口播句（数字原样出现）", "comment": "点评 ≤12 字", "sayComment": "点评的口播句", "img": "可用图片的路径或 null"}
  ],
  "outro": "收尾口播一句，回到今天最重要的那件事",
  "takeaway": "一句结论 ≤10 字"
}
- items 按重要性排，第一条最重磅；每条新闻彼此独立；有数字的尽量都带上 value。

${LINE_RULES}

只输出 JSON。`,

  rank: (topic, brief, images, o) => `话题：${topic}

# 调研简报
${brief}

# 可用图片
${imgList(images)}

# 输出这样的 JSON（榜单盘点，TOP ${o.items}，念完约 ${o.seconds} 秒）
{
  "title": "片名，≤10 字",
  "oneLiner": "看完能记住的一句话",
  "accent": "#rrggbb 主色",
  "listTitle": "榜单名 ≤10 字，如 全球最赚钱公司",
  "metric": "按什么排 ≤16 字，如 按2025年净利润",
  "unit": "数值的单位，如 亿美元",
  "intro": "开场口播一句：这是个什么榜 + 一个悬念",
  "items": [
    {"rank": ${o.items}, "name": "名字 ≤8 字", "sub": "小字 ≤10 字（国家、行业）", "value": 数值（纯数字）,
     "say": "报名次和名字的口播句（要出现名字）", "comment": "点评 ≤12 字", "sayComment": "点评的口播句", "img": "可用图片的路径或 null"}
  ],
  "outro": "收尾口播一句", "takeaway": "一句结论 ≤10 字"
}
- items 从第 ${o.items} 名排到第 1 名（倒数），每名的 value 用同一口径、同一单位，数值必须来自调研。
- 第 1 名留到最后揭晓，它的口播要有悬念感。

${LINE_RULES}

只输出 JSON。`,

  explain: (topic, brief, images, o) => `话题：${topic}

# 调研简报
${brief}

# 输出这样的 JSON（知识科普，${o.items} 步讲清，念完约 ${o.seconds} 秒）
{
  "title": "片名，≤10 字",
  "oneLiner": "看完能记住的一句话",
  "accent": "#rrggbb 主色（科普一般用蓝、青、紫）",
  "question": "开场抛的问题 ≤12 字，不写问号",
  "intro": "开场口播一句，把问题抛给观众",
  "steps": [
    {"title": "这一步叫什么 ≤6 字", "kind": "flow / analogy / point 三选一",
     "nodes": ["flow 用：2–4 个框，每个 ≤7 字，按先后顺序"], "a": "analogy 用：要讲的东西 ≤10 字", "b": "analogy 用：像生活里的什么 ≤10 字",
     "point": "这一步的要点 ≤16 字，可用 <em>重点</em>", "say": ["这一步的口播，2–3 句"]}
  ],
  "outro": "收尾口播一句", "summary": ["2–3 条要点，每条 ≤14 字"], "takeaway": "一句话 ≤10 字"
}
- 三步要循序渐进；三种 kind 尽量都用上（至少一个 flow、一个 analogy）。
- 类比要贴切、生活化；flow 的框是真实的先后步骤。

${LINE_RULES}

只输出 JSON。`,
};

export async function writeContent(format, topic, brief, images, o, meter) {
  const items = format === 'rank' ? 5 : format === 'explain' ? 3 : o.seconds >= 75 ? 5 : o.seconds <= 45 ? 3 : 4;
  const res = await chat({messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: PROMPTS[format](topic, brief, images, {...o, items, today: new Date().toISOString().slice(0, 10)})}],
    json: true, thinking: true, effort: 'high', maxTokens: 12000, meter, step: 'write'});
  return parseJSON(res.content);
}

// ---------------- 内容 → 文案 + 镜头 ----------------
const S = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const cut = (v, n) => { const s = S(v); return [...s.replace(/<\/?em>/g, '')].length > n ? s.replace(/<\/?em>/g, '').slice(0, n) : s; };
const isHex = c => /^#[0-9a-f]{6}$/i.test(c ?? '');

export function compile(format, C, images) {
  const lines = [], add = text => { const t = S(text); if (!t) return null; const id = `b${String(lines.length + 1).padStart(2, '0')}`; lines.push({id, text: t}); return id; };
  const imgOK = new Set(images.map(i => i.path)), img = v => imgOK.has(v) ? v : undefined;
  const base = {title: cut(C.title, 12) || '解读', oneLiner: S(C.oneLiner), accent: isHex(C.accent) ? C.accent : null, pattern: 'chart', format};
  const shots = [];
  const shot = (scene, cover, p) => { cover = cover.filter(Boolean); if (cover.length) shots.push({scene, cover, says: p.says ?? '', ...p}); };

  if (format === 'news') {
    const its = (C.items ?? []).filter(i => S(i.say)).slice(0, 5);
    if (!its.length) throw new Error('模型没写出新闻条目');
    const hudBase = {kind: 'news', kicker: cut(C.kicker, 2) || '快讯', date: cut(C.date, 8), n: its.length, ticker: its.map(i => cut(i.short || i.headline, 14))};
    shot('fx-news-open', [add(C.intro)], {says: '今天几件事', date: hudBase.date, kicker: hudBase.kicker, title: `今天 ${its.length} 件事`, heads: hudBase.ticker, hud: {...hudBase, i: 0}});
    its.forEach((it, k) => {
      const a = add(it.say), b = it.value != null && S(it.value) ? add(it.sayNum) : null, c = it.comment ? add(it.sayComment) : null;
      if (S(it.unit) && S(it.value).endsWith(S(it.unit))) it.unit = '';      // "-48.42%" 已经带了 %，单位就不再写一遍
      shot('fx-news-item', [a, b, c], {says: cut(it.short || it.headline, 20), no: k + 1, headline: cut(it.headline, 18), source: cut(it.source, 10), img: img(it.img),
        ...(b ? {value: S(it.value), unit: cut(it.unit, 6), label: cut(it.label, 12)} : {}), ...(c ? {comment: cut(it.comment, 14)} : {}),
        at: [b ? `@${b}` : null, c ? `@${c}` : null], hud: {...hudBase, i: k + 1}});
    });
    shot('fx-news-wrap', [add(C.outro)], {says: '回顾', title: '今天就这些', heads: hudBase.ticker, takeaway: cut(C.takeaway, 12), hud: {...hudBase, i: its.length + 1}});
    base.pattern = 'chart';
  }

  if (format === 'rank') {
    const its = (C.items ?? []).filter(i => S(i.name) && S(i.say)).sort((a, b) => b.rank - a.rank).slice(0, 7);
    if (its.length < 3) throw new Error('模型写的榜单少于 3 名');
    its.forEach((it, k) => { it.rank = its.length - k; });                  // 名次按倒数顺序重排，保证 N…1
    const n = its.length, max = Math.max(...its.map(i => Number(i.value) || 0)), names = {};
    shot('fx-rank-open', [add(C.intro)], {says: '榜单开场', title: cut(C.listTitle || C.title, 12), n, metric: cut(C.metric, 18), hud: {kind: 'rank', n}});
    its.forEach(it => {
      const a = add(it.say), c = it.comment ? add(it.sayComment) : null;
      shot('fx-rank-item', [a, c], {says: `第 ${it.rank} 名：${cut(it.name, 8)}`, rank: it.rank, name: cut(it.name, 8), sub: cut(it.sub, 12), img: img(it.img),
        value: Number(it.value) || 0, unit: cut(C.unit, 6), max, ...(c ? {comment: cut(it.comment, 14)} : {}), at: [null, c ? `@${c}` : null],
        ...(it.rank === 1 ? {hero: true} : {}), hud: {kind: 'rank', n, cur: it.rank, names: {...names}}});
      names[it.rank] = cut(it.name, 6);
    });
    shot('fx-rank-final', [add(C.outro)], {says: '总榜', title: cut(C.listTitle || C.title, 12), unit: cut(C.unit, 6), takeaway: cut(C.takeaway, 12),
      items: its.map(i => ({rank: i.rank, name: cut(i.name, 6), value: Number(i.value) || 0}))});   // 总榜整屏都是横条，不挂右侧名次栏（会挡住数值）
  }

  if (format === 'explain') {
    const st = (C.steps ?? []).filter(s => S(s.title)).slice(0, 4);
    if (!st.length) throw new Error('模型没写出科普步骤');
    const chapters = st.map(s => cut(s.title, 6));
    shot('fx-exp-open', [add(C.intro)], {says: '抛问题', question: cut(C.question, 12), chapters, hud: {kind: 'exp', chapters, cur: 0}});
    st.forEach((s, k) => {
      const ids = [].concat(s.say ?? []).slice(0, 3).map(add);
      const kind = ['flow', 'analogy', 'point'].includes(s.kind) ? s.kind : 'point';
      const p = {says: chapters[k], no: k + 1, title: cut(s.title, 8), kind, point: cut(s.point, 18) || undefined, hud: {kind: 'exp', chapters, cur: k + 1}};
      if (kind === 'flow') { p.nodes = [].concat(s.nodes ?? []).map(x => cut(x, 8)).filter(Boolean).slice(0, 4); if (p.nodes.length < 2) { p.kind = 'point'; delete p.nodes; } }
      if (kind === 'analogy') { p.a = cut(s.a, 10); p.b = cut(s.b, 10); if (!p.a || !p.b) { p.kind = 'point'; delete p.a; delete p.b; } }
      if (p.kind === 'point' && !p.point) p.point = cut(s.title, 16);
      shot('fx-exp-step', ids, p);
    });
    shot('fx-exp-sum', [add(C.outro)], {says: '总结', title: '一张图记住', items: [].concat(C.summary ?? []).map(x => cut(x, 14)).filter(Boolean).slice(0, 4), takeaway: cut(C.takeaway, 12),
      hud: {kind: 'exp', chapters, cur: chapters.length + 1}});
  }

  // at 里没对上句子的去掉（null），其余交给 normalizePlan 统一校正
  for (const s of shots) if (s.at) { s.at = s.at.map(x => x ?? undefined); if (s.at.every(x => !x)) delete s.at; }
  return {...base, accent: base.accent ?? '#d9a441', lines, shots: shots.map(s => ({...s}))};
}
