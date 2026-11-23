// 第二步：编剧 + 导演。调研简报 → 口播文案（script.json）+ 镜头表（film.js 里的 K.film([...])）。
// 模型输出一份 JSON 计划，这里把它校正成渲染器一定能吃的样子：时刻都对得上字、每句都有镜头、只有一个最重的一镜。
import {chat, parseJSON} from './deepseek.mjs';
import {SCENES, SHOT_KEYS, PATTERNS, catalogText} from './catalog.mjs';

const SYSTEM = `你是一位财经/科技短视频的编剧兼导演，风格学"小Lin说"：口语、第一人称、句句往下接，用一笔账把事情讲清楚。
你写出的计划会被程序直接渲染成 1080×1920 竖屏视频，所以必须严格按要求输出 JSON。`;

function userPrompt(topic, brief, images, opts) {
  const imgs = images.length ? images.map(im => `- ${im.path}：${im.desc || im.title}（${im.kind === "photo" ? "照片" : "插图"}，来自 ${im.site}）`).join('\n') : '（没有可用图片，不要用 vp-photo）';
  return `话题：${topic}

# 调研简报（只能用这里面的事实和数字，不许编）
${brief}

# 可用图片
${imgs}

# 你要输出的 JSON
{
  "title": "片名，10 字以内",
  "oneLiner": "观众看完能转述的那一句话",
  "accent": "#rrggbb 全片主色（和题目相关：黄金用金色、科技用蓝紫、跌用冷色…，饱和度别太高）",
  "pattern": "${PATTERNS.join(' | ')} 选一个和题目沾边的底纹",
  "lines": [ {"id": "b01", "text": "口播的一句话"} ],
  "shots": [ {"scene": "组件名", "cover": ["b01"], "says": "这一镜让观众多懂了什么", ...组件参数} ]
}

# 文案（lines）要求
- 总共 ${opts.minLines}–${opts.maxLines} 句，念出来 ${opts.seconds} 秒左右（中文每秒约 4.2 个字）。id 依次是 b01、b02、b03…
- 每句 8–30 个字；一句里每个逗号分开的分句不超过 14 个字。
- 第一句就要抛出最反常、最抓人的那个点（钩子）；最后一句回到开头，给观众一句能带走的判断。
- 数字照常写（"1158亿美元"、"7%"、"2025年"），会自动念出来。口语化，别用书面语和套话，不要"大家好""欢迎关注"。
- 每个事实和数字都必须来自调研简报。

# 镜头（shots）要求
- ${opts.minShots}–${opts.maxShots} 镜，按顺序覆盖全部句子：每镜的 "cover" 是它覆盖的连续 1–3 句的 id（注意：有的组件自己也有 lines 参数，那是屏上的大字，别搞混），每句恰好属于一镜。
- 每镜先想 says（这一镜让观众多懂了什么，和上一镜不一样），再选组件。
- 组件参数里的时刻写成 "@句id" 或 "@句id:词"，意思是"念到这个词的那一刻"；"词"必须从那一句的 text 里一字不差地抄（2–4 个字），而且那一句必须属于这一镜。
- 屏上出现的字要短：组件说明里写了字数上限就照着来。数字要和文案、调研一致。
- 全片只有一镜写 "hero": true（最重的一镜，通常是 vp-verdict 或最大的那个数）。
- 相邻两镜不用同一个组件；同一个组件全片最多用 2 次；至少用 5 种不同的组件；讲故事的（vp-words / vp-ask / vp-reject / vp-verdict / vp-number）和图形的（其余）交替着来。
- 第一镜是钩子：第一句里最反常的那个数或那个词必须出现在屏上（第一句有数字就用 vp-number 把它砸出来，没有就用 vp-words / vp-ask）；最后一镜用 vp-words 或 vp-number 收尾。
- en（英文小字）只在写得出地道英文时才写：2–4 个词的自然短语（"SAFE HAVEN?"、"THE BOARD SAYS NO"），不要逐字直译，拿不准就不写。
- 有可用图片时：至少一镜用 vp-photo；讲故事的镜头（vp-words / vp-ask / vp-reject / vp-verdict / vp-number）可以写 "bg": "图片路径" 垫一张和这一镜内容相关的图，不同镜头尽量换不同的图。

# 能用的组件（只能用这些，参数只能写列出来的）
${catalogText(images)}
通用参数（图形组件都能写）：title 标题（可用 <em>重点</em>），brow 左上角小字。

只输出 JSON，不要别的文字。`;
}

export async function writePlan(topic, brief, images, opts = {}, log = () => {}, meter = null) {
  const o = {seconds: 60, minLines: 12, maxLines: 18, minShots: 8, maxShots: 12, ...opts};
  log('写文案和镜头表…');
  const res = await chat({messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: userPrompt(topic, brief, images, o)}], json: true, thinking: true, effort: 'high', maxTokens: 16000, meter, step: 'write'});
  return parseJSON(res.content);
}

// 渲染器报错时，把错误和计划交回给模型改
export async function repairPlan(plan, errorText, images, log = () => {}, meter = null) {
  log('镜头表有错，交回给 DeepSeek 修…');
  const msg = `下面这份视频计划 JSON 在渲染检查时报错了。请只改出错的地方（组件参数、时刻、字数），其余保持不变，输出完整的修好的 JSON。

# 报错
${errorText}

# 能用的组件
${catalogText(images, plan.format)}

# 计划
${JSON.stringify(plan, null, 1)}

只输出 JSON。`;
  const res = await chat({messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: msg}], json: true, thinking: false, maxTokens: 16000, meter, step: 'repair'});
  return parseJSON(res.content);
}

// 只重做一镜：用户在审稿页写一句要求（"换成柱状图""字再短一点"），或者只是想换个演法
export async function rewriteShot(plan, index, instruction, scene, brief, images, meter = null) {
  const s = plan.shots[index];
  const own = plan.lines.filter(l => s.cover.includes(l.id));
  const msg = `这是一条竖屏解读短片的计划。请只重做第 ${index + 1} 镜，输出这一镜的 JSON 对象（不是整份计划）。

# 要求
${instruction?.trim() || '换一种更好看、更清楚的演法。'}
${scene ? `必须用组件 ${scene}。` : plan.format && plan.format !== 'story' ? `保持组件 ${s.scene} 不变（这种视频类型的镜头骨架是固定的），只改屏上的内容；hud 原样保留。` : ''}
- "cover" 保持 ${JSON.stringify(s.cover)} 不变；时刻 "@句id:词" 的词必须从这几句里一字不差地抄：
${own.map(l => `  ${l.id}：${l.text}`).join('\n')}
- 只用调研简报里的事实和数字。

# 前后镜（别重复它们的组件）
上一镜：${plan.shots[index - 1]?.scene ?? '（无）'}　下一镜：${plan.shots[index + 1]?.scene ?? '（无）'}

# 现在这一镜
${JSON.stringify(s)}

# 能用的组件
${catalogText(images, plan.format)}

# 可用图片
${images.map(im => `- ${im.path}：${im.desc || im.title}`).join('\n') || '（无）'}

# 调研简报（节选）
${brief.slice(0, 6000)}

只输出这一镜的 JSON 对象，形如 {"scene": "...", "cover": [...], "says": "...", ...参数}。`;
  const res = await chat({messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: msg}], json: true, thinking: true, effort: 'low', maxTokens: 6000, meter, step: 'rewrite'});
  const shot = parseJSON(res.content);
  return {...shot, cover: s.cover, ...(s.hero ? {hero: true} : {}), ...(s.hud ? {hud: s.hud} : {})};   // 常驻元素由程序管，不让模型改坏
}

// ---------------- 校正：把模型的计划变成渲染器一定能吃的样子 ----------------
const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();

export function normalizePlan(raw, images = []) {
  const notes = [];
  const P = {title: clean(raw.title) || '解读', oneLiner: clean(raw.oneLiner), accent: isHex(raw.accent) ? raw.accent : '#d9a441',
    pattern: PATTERNS.includes(raw.pattern) ? raw.pattern : 'chart', format: raw.format ?? 'story', lines: [], shots: []};

  // 句子：重新编号 b01…，记住旧 id → 新 id
  const idMap = new Map();
  (raw.lines ?? []).forEach(l => {
    const text = clean(l.text); if (!text) return;
    const id = `b${String(P.lines.length + 1).padStart(2, '0')}`; idMap.set(String(l.id), id); P.lines.push({id, text});
  });
  if (P.lines.length < 3) throw new Error('模型写的文案太短（少于 3 句）');
  const LI = new Map(P.lines.map((l, i) => [l.id, i]));

  // 每镜覆盖哪几句：按每镜的第一句排好，镜 i 覆盖 [首句_i, 首句_{i+1})
  let shots = (raw.shots ?? []).filter(s => s && typeof s === 'object').map(s => {
    const ids = (Array.isArray(s.cover) ? s.cover : [s.cover]).map(x => idMap.get(String(x))).filter(Boolean);
    return {...s, _first: ids.length ? Math.min(...ids.map(x => LI.get(x))) : null};
  }).filter(s => s._first != null);
  shots.sort((a, b) => a._first - b._first);
  shots = shots.filter((s, i) => i === 0 || s._first !== shots[i - 1]._first);
  if (!shots.length) throw new Error('模型没有写出镜头');
  shots[0]._first = 0;
  shots.forEach((s, i) => { s._last = (i + 1 < shots.length ? shots[i + 1]._first : P.lines.length) - 1; });

  const imgSet = new Set(images.map(im => im.path));
  shots.forEach((s, i) => {
    const own = P.lines.slice(s._first, s._last + 1);
    let sp = fixShot(s, own, idMap, imgSet, notes, i);
    sp.until = i + 1 < shots.length ? '@' + P.lines[shots[i + 1]._first].id : undefined;
    sp._lines = own.map(l => l.id);
    P.shots.push(sp);
  });

  // 最重的一镜：恰好一个
  const heroes = P.shots.map((s, i) => s.hero ? i : -1).filter(i => i >= 0);
  P.shots.forEach(s => delete s.hero);
  const pick = heroes.find(i => P.shots[i].scene === 'vp-verdict') ?? heroes[0] ?? P.shots.findIndex(s => s.scene === 'vp-verdict');
  P.shots[pick >= 0 ? pick : Math.floor(P.shots.length * .7)].hero = true;
  return {plan: P, notes};
}

// 一镜：删掉不认识的参数、把时刻对到这一镜自己的句子上、组件不对就换成兜底的 vp-words
function fixShot(s, own, idMap, imgSet, notes, i) {
  const def = SCENES[s.scene];
  const tag = `第 ${i + 1} 镜`;
  if (!def) { notes.push(`${tag}：组件 ${s.scene} 不能用，换成关键词`); return fallbackShot(s, own); }
  const sp = {scene: s.scene, says: clean(s.says) || own[0].text};
  if (s.hero) sp.hero = true;
  for (const k of def.keys) if (s[k] != null && s[k] !== '') sp[k] = s[k];
  for (const k of Object.keys(s)) if (!def.keys.includes(k) && !SHOT_KEYS.includes(k) && k[0] !== '_') notes.push(`${tag}：删掉了 ${s.scene} 不认识的参数 ${k}`);

  // 时刻：'@旧id:词' → 新 id；句子不在这一镜里就挪到这一镜里找这个词，找不到就只留句子
  const fixAt = v => {
    const m = /^@([^:]+)(?::(.+))?$/.exec(v); if (!m) return v;
    let id = idMap.get(m[1]) ?? m[1]; const w = m[2]?.trim();
    const inOwn = own.find(l => l.id === id);
    if (w) {
      const hit = (inOwn && inOwn.text.includes(w)) ? inOwn : own.find(l => l.text.includes(w));
      if (hit) return `@${hit.id}:${w}`;
      return `@${(inOwn ?? own[0]).id}`;
    }
    return `@${(inOwn ?? own[0]).id}`;
  };
  const walk = v => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    : typeof v === 'string' && v.startsWith('@') ? fixAt(v) : typeof v === 'number' && !Number.isFinite(v) ? 0 : v;
  for (const k of def.keys) if (sp[k] != null) sp[k] = walk(sp[k]);

  // 数值统一成字符串（组件里 value 按字符串排版），走势线的 data 例外
  const strVal = o => { if (o && typeof o === 'object' && typeof o.value === 'number') o.value = String(o.value); return o; };
  for (const k of ['items', 'left', 'right']) if (sp[k]) Array.isArray(sp[k]) ? sp[k].forEach(strVal) : strVal(sp[k]);
  if (typeof sp.value === 'number') sp.value = String(sp.value);

  // 各组件的硬要求
  const need = {
    'vp-words': () => Array.isArray(sp.words) && sp.words.length && (sp.words = sp.words.slice(0, 2).map(w => typeof w === 'string' ? {text: w} : w).filter(w => clean(w.text))).length,
    'vp-ask': () => Array.isArray(sp.lines) && sp.lines.length,
    'vp-reject': () => sp.stamp && clean(sp.stamp.text ?? sp.stamp),
    'vp-verdict': () => Array.isArray(sp.lines) && sp.lines.length,
    'vp-number': () => clean(sp.value),
    'vp-bars': () => Array.isArray(sp.items) && sp.items.length >= 2,
    'vp-versus': () => sp.left && sp.right,
    'vp-chain': () => Array.isArray(sp.items) && sp.items.length >= 2,
    'vp-list': () => Array.isArray(sp.items) && sp.items.length >= 1,
    'vp-line': () => Array.isArray(sp.data) && (sp.data = sp.data.map(Number).filter(Number.isFinite)).length >= 4 && (sp.source ||= '公开数据'),
    'vp-timeline': () => Array.isArray(sp.items) && sp.items.length >= 2,
    'vp-share': () => clean(sp.value),
    'vp-rank': () => Array.isArray(sp.items) && sp.items.length >= 2,
    'vp-quote': () => Array.isArray(sp.lines) && sp.lines.length && clean(sp.name),
    'vp-chapter': () => clean(sp.title),
    'vp-photo': () => imgSet.has(sp.img),
  }[s.scene];
  if (sp.bg && !imgSet.has(sp.bg)) delete sp.bg;
  if (typeof sp.stamp === 'string') sp.stamp = {text: sp.stamp};
  if (typeof sp.drop === 'string') sp.drop = {text: sp.drop};
  if (need && !need()) { notes.push(`${tag}：${s.scene} 缺必要的内容，换成关键词`); return fallbackShot(s, own); }
  return sp;
}

// 兜底：从这一镜的句子里挑一个短词做 vp-words（一定能渲染）
export function fallbackShot(s, own) {
  const text = own[0].text, parts = text.split(/[，。！？、：；,.!?:;\s]+/).filter(Boolean);
  const pickWord = parts.map(p => p.slice(0, 5)).sort((a, b) => b.length - a.length)[0] ?? text.slice(0, 4);
  const sp = {scene: 'vp-words', says: clean(s.says) || text, words: [{text: pickWord, at: `@${own[0].id}:${pickWord}`, col: 'accent'}]};
  if (!text.includes(pickWord)) sp.words[0].at = `@${own[0].id}`;
  if (s.hero) sp.hero = true;
  return sp;
}
