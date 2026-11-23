// 金剪 goldcut —— 网页界面。不用框架：hash 路由 + 模板字符串，状态都在服务端（films/<项目>/）。
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const view = $('#view');
let META = null, STATUS = null, cleanup = [], gen = 0;   // gen：每换一次页面 +1，旧页面的异步回调发现对不上就不再画

// ---------------- 小工具 ----------------
async function api(method, url, body) {
  const r = await fetch(url, {method, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `请求失败（${r.status}）`);
  return j;
}
let toastT;
function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', bad ? 5000 : 2600); }
function confirmBox(title, text, okText = '确定', danger = false) {
  return new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="card modal"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="acts"><button class="btn ghost" data-v="0">取消</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(okText)}</button></div></div>`;
    bg.onclick = e => { const v = e.target.dataset?.v; if (v != null || e.target === bg) { bg.remove(); res(v === '1'); } };
    document.body.appendChild(bg); $('[data-v="1"]', bg).focus();
  });
}
const yuan = c => c == null ? '—' : '¥' + (c < 0.01 ? c.toFixed(4) : c < 1 ? c.toFixed(3) : c.toFixed(2));
const dur = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const when = t => { if (!t) return ''; const d = new Date(t), now = new Date(), sameDay = d.toDateString() === now.toDateString();
  return sameDay ? '今天 ' + d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : d.toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'}) + ' ' + d.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}); };
const store = {get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const I = {
  play: '<svg class="icon" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  spark: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  down: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  redo: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  film: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
  clock: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mic: '<svg class="icon" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  music: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  hd: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9v6M7 12h3M10 9v6M14 9h1.5a2.5 2.5 0 0 1 0 5H14z"/></svg>',
  arrow: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  alert: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
  box: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>',
};

// ---------------- 全局状态：左下角 ----------------
async function refreshStatus() {
  try { STATUS = await api('GET', '/api/status'); } catch { return; }
  const a = $('#apiState');
  a.innerHTML = STATUS.hasKey ? `<span class="dot ok"></span><span>DeepSeek 已连接 · ${esc(STATUS.model)}</span>` : `<span class="dot bad"></span><a href="#/settings">还没填 API Key</a>`;
  const b = $('#busyState');
  if (STATUS.busy) { b.hidden = false; b.innerHTML = `<span class="dot run"></span><a href="#/p/${encodeURIComponent(STATUS.busy.id)}">${STATUS.busy.kind === 'plan' ? '正在调研写稿' : '正在出片'}${STATUS.queued ? ` · 排队 ${STATUS.queued}` : ''}</a>`; }
  else b.hidden = true;
  $('#monthCost').textContent = `本月花费 ${yuan(STATUS.monthCny)}`;
  $('#navCount').textContent = STATUS.count || '';
}
setInterval(refreshStatus, 8000);
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set('gc-theme', nx); try { localStorage.setItem('gc-theme', nx); } catch {}
};

// ---------------- 路由 ----------------
async function route() {
  cleanup.forEach(f => f()); cleanup = []; gen++;
  const h = location.hash.slice(1) || '/';
  const [, page, arg] = h.split('/');
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (page === 'p' ? 'library' : page || 'new')));
  window.scrollTo(0, 0);
  if (!META) META = await api('GET', '/api/meta');
  if (page === 'library') return pageLibrary();
  if (page === 'settings') return pageSettings();
  if (page === 'p' && arg) return pageProject(decodeURIComponent(arg));
  return pageNew();
}
addEventListener('hashchange', route);

// ---------------- 作品卡 ----------------
const STATUS_TXT = {new: ['准备中', 'run'], queued: ['排队中', 'run'], planning: ['调研写稿中', 'run'], review: ['待审稿', 'review'], producing: ['出片中', 'run'], done: ['已完成', 'done'], error: ['出错了', 'error']};
const badge = s => { const [t, c] = STATUS_TXT[s] ?? [s, '']; return `<span class="badge ${c}">${c === 'run' ? '<span class="dot run"></span>' : ''}${t}</span>`; };
function pcard(p) {
  return `<a class="pcard" href="#/p/${encodeURIComponent(p.id)}">
    <div class="thumb">${p.poster ? `<img src="${p.poster}" alt="" loading="lazy">` : `<div class="ph"><div><b>${esc(p.title)}</b>${p.status === 'done' ? '' : esc(STATUS_TXT[p.status]?.[0] ?? '')}</div></div>`}
      <div class="ov">${p.status === 'done' ? (p.stale ? '<span class="badge review">有改动</span>' : '<span></span>') : badge(p.status)}${p.duration ? `<span class="dur">${dur(p.duration)}</span>` : ''}</div></div>
    <div class="meta"><b>${esc(p.title)}</b><small><span>${when(p.created)}</span>${p.cost ? `<span>${yuan(p.cost.cny)}</span>` : ''}</small></div></a>`;
}

// ---------------- 新建 ----------------
const IDEAS = ['英伟达最新财报为什么股价反而跌', '黄金今年为什么大起大落', '美联储下一步加息还是降息', 'DeepSeek 为什么这么便宜', '比特币最近为什么大涨', '新能源车价格战打到哪一步了'];
function optSelect(id, icon, items, val) {
  return `<span class="opt">${icon}<select id="${id}">${items.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></span>`;
}
// 风格卡：预览图（同一份分镜在这个风格下的三帧）+ 名字 + 一句话
function styleCards(cur, elId) {
  return `<div class="styles" id="${elId}" data-value="${esc(cur)}" role="radiogroup">${META.styles.map(s => `<button type="button" role="radio" aria-checked="${s.id === cur}" class="stc ${s.id === cur ? 'on' : ''}" data-v="${s.id}">
    <img src="/styles/${s.id}.jpg" alt="" loading="lazy"><span class="nm"><i style="background:linear-gradient(135deg,${s.swatch.join(',')})"></i>${esc(s.name)}</span><small>${esc(s.desc)}</small></button>`).join('')}</div>`;
}
// 类型卡：每种类型的结构用一行"骨架"示意出来
const FMT_FLOW = {story: ['钩子', '证据', '因果', '结论'], news: ['今天N件事', '第1条', '第2条', '回顾'], rank: ['TOP5', '#5→#2', '#1揭晓', '总榜'], explain: ['抛问题', '第1步', '第2步', '总结']};
function formatCards(cur, elId) {
  return `<div class="styles fmts" id="${elId}" data-value="${esc(cur)}" role="radiogroup">${META.formats.map(f => `<button type="button" role="radio" aria-checked="${f.id === cur}" class="stc ${f.id === cur ? 'on' : ''}" data-v="${f.id}">
    <span class="ic">${f.icon}</span><span class="nm">${esc(f.name)}</span><small>${esc(f.desc)}</small><span class="flow">${(FMT_FLOW[f.id] ?? []).map(esc).join('<i>›</i>')}</span></button>`).join('')}</div>`;
}
function bindStyleCards(box, onPick) {
  box.addEventListener('click', e => {
    const b = e.target.closest('.stc'); if (!b || b.dataset.v === box.dataset.value) return;
    box.dataset.value = b.dataset.v;
    $$('.stc', box).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    onPick?.(b.dataset.v);
  });
}
function musicItems() { return [['auto', '配乐：自动'], ['tense', '配乐：紧张'], ['bright', '配乐：明快'], ...META.music.map(f => [f, '配乐：' + f.replace(/\.\w+$/, '')]), ['none', '不要配乐']]; }
async function pageNew() {
  const g = gen;
  const pref = store.get('gc-new', {});
  const d = {...META.defaults, review: true, ...pref};   // 网页默认先审稿（命令行默认一口气出片）
  view.innerHTML = `<div class="page">
    <div class="hero">
      <h1>今天讲<em>什么</em>？</h1>
      <p class="lead">给一个财经或科技话题，DeepSeek 联网查清楚、写好口播和分镜，几分钟后出一条竖屏解读短片。</p>
      <div id="keyNote"></div>
      <div class="card composer">
        <textarea id="topic" rows="3" placeholder="比如：英伟达最新一季财报为什么股价反而跌？" maxlength="200"></textarea>
        <div class="bar">
          ${optSelect('o-seconds', I.clock, [[45, '45 秒'], [60, '60 秒'], [90, '90 秒']], d.seconds)}
          ${optSelect('o-voice', I.mic, META.voices.map(v => [v[0], v[1] + ' · ' + v[2].split(' · ')[0]]), d.voice)}
          ${optSelect('o-music', I.music, musicItems(), d.music)}
          ${optSelect('o-h', I.hd, [[720, '720p 快'], [1080, '1080p 高清']], d.h)}
          <span class="sp"></span>
          <span class="switch ${d.review !== false ? 'on' : ''}" id="o-review" title="打开：写完稿先停下来让你看、能改；关掉：一口气出片"><i></i>先审稿</span>
          <button class="btn primary" id="go">开始创作 ${I.arrow}</button>
        </div>
        <div class="style-h">视频类型 <span class="muted">· 决定叙事结构和镜头</span></div>
        ${formatCards(d.format ?? 'story', 'o-format')}
        <div class="style-h">画面风格 <span class="muted">· 决定颜色和质感，每种类型都能配</span></div>
        ${styleCards(d.style ?? 'night', 'o-style')}
      </div>
      <div class="ideas">${IDEAS.map(t => `<button class="idea">${esc(t)}</button>`).join('')}</div>
      <div class="how">
        <div><b><span>1</span>联网调研</b><p>DeepSeek 深度搜索最新新闻、财报、数据，整理成带出处的简报。</p></div>
        <div><b><span>2</span>写稿分镜</b><p>口语化文案 + 逐镜画面：大数字、对比、因果链、走势线……</p></div>
        <div><b><span>3</span>你来审稿</b><p>每一句、每一镜都能改；不满意的镜头让 AI 换个演法。</p></div>
        <div><b><span>4</span>自动出片</b><p>配音、字幕、配乐、音效、逐帧渲染，1080×1920 竖屏成片。</p></div>
      </div>
    </div>
    <div class="section-h"><h2>最近的作品</h2><a href="#/library">全部作品 →</a></div>
    <div class="grid" id="recent"><div class="muted">加载中…</div></div>
  </div>`;
  const ta = $('#topic'); ta.focus();
  $$('.idea').forEach(b => b.onclick = () => { ta.value = b.textContent; ta.focus(); });
  $('#o-review').onclick = e => e.currentTarget.classList.toggle('on');
  bindStyleCards($('#o-style'));
  bindStyleCards($('#o-format'));
  ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#go').click(); };
  await refreshStatus(); if (g !== gen) return;
  if (!STATUS?.hasKey) $('#keyNote').innerHTML = `<div class="card pad" style="margin-bottom:14px;text-align:left;display:flex;gap:14px;align-items:center;border-color:var(--gold2)">
    <div style="flex:1"><b>先连上 DeepSeek</b><div class="muted" style="font-size:13px">需要一个 API Key（到 platform.deepseek.com 创建）。一条片通常不到 ¥0.2。</div></div><a class="btn" href="#/settings">去设置</a></div>`;
  $('#go').onclick = async () => {
    const topic = ta.value.trim(); if (!topic) { ta.focus(); return toast('先写一个话题', true); }
    const o = {topic, format: $('#o-format').dataset.value, style: $('#o-style').dataset.value, seconds: +$('#o-seconds').value, voice: $('#o-voice').value, music: $('#o-music').value, h: +$('#o-h').value, review: $('#o-review').classList.contains('on')};
    store.set('gc-new', {format: o.format, style: o.style, seconds: o.seconds, voice: o.voice, music: o.music, h: o.h, review: o.review});
    $('#go').disabled = true;
    try { const r = await api('POST', '/api/projects', o); location.hash = `#/p/${encodeURIComponent(r.id)}`; }
    catch (e) { toast(e.message, true); $('#go').disabled = false; }
  };
  const list = await api('GET', '/api/projects'); if (g !== gen) return;
  $('#recent').innerHTML = list.length ? list.slice(0, 6).map(pcard).join('') : '<div class="muted">还没有作品，写个话题试试。</div>';
}

// ---------------- 作品库 ----------------
async function pageLibrary() {
  const g = gen;
  view.innerHTML = `<div class="page"><div class="top"><div><h1>作品</h1><div class="sub" id="libSub"></div></div><div class="actions"><a class="btn primary" href="#/">${I.spark}新建</a></div></div>
    <div class="tabs" id="libTabs"></div><div class="grid" id="lib"></div></div>`;
  const list = await api('GET', '/api/projects'); if (g !== gen) return;
  const groups = [['all', '全部', () => true], ['done', '已完成', p => p.status === 'done'], ['review', '待审稿', p => p.status === 'review'], ['run', '进行中', p => ['planning', 'producing', 'queued', 'new'].includes(p.status)], ['error', '出错', p => p.status === 'error']];
  const total = list.reduce((a, p) => a + (p.cost?.cny ?? 0), 0);
  $('#libSub').textContent = `${list.length} 个项目 · 累计 DeepSeek 花费 ${yuan(total)}`;
  let cur = store.get('gc-lib', 'all');
  const draw = () => {
    $('#libTabs').innerHTML = groups.map(([k, t, f]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${t}<span class="n">${list.filter(f).length}</span></button>`).join('');
    const f = groups.find(g => g[0] === cur)?.[2] ?? (() => true), items = list.filter(f);
    $('#lib').innerHTML = items.length ? items.map(pcard).join('') : `<div class="empty" style="grid-column:1/-1">${I.film}<div>这里还没有作品</div></div>`;
  };
  $('#libTabs').onclick = e => { const b = e.target.closest('button'); if (b) { cur = b.dataset.k; store.set('gc-lib', cur); draw(); } };
  draw();
}

// ---------------- 设置 ----------------
async function pageSettings() {
  const g = gen; const s = await api('GET', '/api/settings'); await refreshStatus(); if (g !== gen) return;
  view.innerHTML = `<div class="page"><div class="top"><div><h1>设置</h1><div class="sub">所有设置都存在本机项目的 .env 里。</div></div></div>
  <div class="set">
    <div class="card pad"><h3>DeepSeek API Key</h3><p class="hint">到 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com</a> 创建。联网搜索不额外收费，只按 token 计费，一条 60 秒的片子大约 ¥0.1–0.2。</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${STATUS.hasKey ? `<span class="badge done"><span class="dot ok"></span>已连接 ${esc(STATUS.keyHint)}</span>` : '<span class="badge error">未设置</span>'}
        <input class="input" id="key" type="password" placeholder="${STATUS.hasKey ? '换一个 Key：sk-…' : 'sk-…'}" style="flex:1;min-width:220px" autocomplete="off">
        <button class="btn primary" id="saveKey">保存</button>
      </div></div>
    <div class="card pad"><h3>默认声音</h3><p class="hint">新建作品时默认用这个声音（每条片还能单独换）。免费的微软 edge-tts。</p>
      <div class="voice" id="voices">${META.voices.map(v => `<button data-v="${v[0]}" class="${v[0] === s.voice ? 'on' : ''}"><b>${esc(v[1])}</b><small>${esc(v[2])}</small></button>`).join('')}</div></div>
    <div class="card pad"><h3>渲染</h3><p class="hint">同时开几路渲染。内存 16G 建议 2 路，32G 以上可以开 3–4 路，更快。</p>
      <div class="seg" id="workers">${[1, 2, 3, 4].map(n => `<button data-n="${n}" class="${n === s.workers ? 'on' : ''}">${n} 路</button>`).join('')}</div></div>
    <div class="card pad"><h3>配乐</h3><p class="hint">内置两段合成的垫乐（没有版权问题）。想用自己的音乐，把 mp3 / wav 放进下面这个文件夹，刷新后就能在新建时选。</p>
      <dl class="kv"><dt>音乐文件夹</dt><dd>${esc(META.musicDir)}</dd><dt>自己的音乐</dt><dd>${META.music.length ? META.music.map(esc).join('、') : '（还没有）'}</dd></dl></div>
    <div class="card pad"><h3>关于</h3><dl class="kv"><dt>模型</dt><dd>${esc(s.model)}</dd><dt>作品目录</dt><dd>${esc(s.filmsDir)}</dd><dt>删除的作品</dt><dd>${esc(s.filmsDir)}\\_trash</dd></dl></div>
  </div></div>`;
  $('#saveKey').onclick = async () => { try { await api('POST', '/api/key', {key: $('#key').value.trim()}); toast('已保存'); pageSettings(); } catch (e) { toast(e.message, true); } };
  $('#voices').onclick = async e => { const b = e.target.closest('button'); if (!b) return; await api('PUT', '/api/settings', {voice: b.dataset.v}); META.defaults.voice = b.dataset.v; $$('#voices button').forEach(x => x.classList.toggle('on', x === b)); toast('默认声音已更新'); };
  $('#workers').onclick = async e => { const b = e.target.closest('button'); if (!b) return; await api('PUT', '/api/settings', {workers: +b.dataset.n}); $$('#workers button').forEach(x => x.classList.toggle('on', x === b)); toast('已更新'); };
}

// ---------------- 项目页 ----------------
const FLOW = [['research', '调研'], ['images', '配图'], ['write', '写稿'], ['review', '审稿'], ['voice', '配音'], ['check', '检查'], ['render', '渲染'], ['mix', '合成']];
const NOW_TXT = {research: ['联网调研中', 'DeepSeek 正在搜索、打开网页、核对数字，通常 1–3 分钟'], images: ['找配图', '从引用的新闻网页里取头图'], write: ['写文案和分镜', '口播文案 + 每一镜的画面'],
  voice: ['配音', '生成配音和逐字时间线'], check: ['检查分镜', '有问题会自动交回 DeepSeek 修'], render: ['逐帧渲染', '一帧一帧画出来，这一步最久'], mix: ['混音合成', '配音、配乐、音效混在一起，出 mp4']};

async function pageProject(id) {
  const g = gen;
  let P, es = null, tick = null, tab = store.get('gc-tab', 'sheet'), dirty = false, rewriting = -1;
  const load = async () => { P = await api('GET', `/api/projects/${encodeURIComponent(id)}`); };
  try { await load(); } catch (e) { view.innerHTML = `<div class="page"><div class="empty">${I.alert}<div>${esc(e.message)}</div><p><a class="btn" href="#/library">回到作品</a></p></div></div>`; return; }

  const busy = () => ['planning', 'producing', 'queued', 'new'].includes(P.status);
  const live = {steps: {}, log: [], sources: [], images: [], render: null, phaseStart: null};
  const ingest = e => {
    if (e.type === 'queued') live.phaseStart = e.ts;
    if (e.type === 'phase') { live.phaseStart = e.ts; live.steps = {}; live.render = null; }
    if (e.type === 'step') live.steps[e.id] = {status: e.status, summary: e.summary, ts: e.ts};
    if (e.type === 'log') live.log.push(`[${new Date(e.ts).toLocaleTimeString('zh-CN', {hour12: false})}] ${e.msg}`);
    if (e.type === 'sources') live.sources = e.sources;
    if (e.type === 'images') live.images = e.images;
    if (e.type === 'render') live.render = {...e, start: e.ts};
    if (e.type === 'error') live.log.push('出错：' + e.msg);
  };
  (P.events || []).forEach(ingest);

  // 进度条每一格的状态：先按项目状态定底子，再叠上这一段实时收到的步骤
  function stepStates() {
    const st = {}, s = P.status, planDone = ['research', 'images', 'write', 'review'];
    const inProduce = s === 'producing' || (s === 'queued' && P.plan) || (s === 'error' && P.failedPhase === 'produce');
    if (s === 'done') FLOW.forEach(([k]) => st[k] = 'done');
    if (s === 'review') { ['research', 'images', 'write'].forEach(k => st[k] = 'done'); st.review = 'wait-user'; }
    if (inProduce) planDone.forEach(k => st[k] = 'done');
    if (s === 'planning' || s === 'producing' || s === 'error') for (const [k, v] of Object.entries(live.steps)) st[k] = v.status === 'run' ? 'run' : 'done';
    if (s === 'planning' && !Object.keys(live.steps).length) st.research = 'run';
    if (s === 'error') { const run = Object.entries(live.steps).find(([, v]) => v.status === 'run')?.[0]; st[run ?? (inProduce ? 'voice' : 'research')] = 'fail'; }
    return st;
  }
  const stepper = () => { const st = stepStates(); return `<div class="card stepper">${FLOW.map(([k, t], i) => `${i ? `<span class="ln ${st[k] === 'done' || st[k] === 'run' ? 'done' : ''}"></span>` : ''}<span class="st ${st[k] ?? ''}"><i>${st[k] === 'done' ? '✓' : st[k] === 'fail' ? '!' : st[k] === 'run' ? '' : i + 1}</i>${t}</span>`).join('')}</div>`; };

  function aside() {
    const v = P.video ? `<video src="${P.video}" controls playsinline preload="metadata" poster="${P.poster ?? ''}"></video>` :
      busy() ? `<div class="idle"><div class="spin"></div>正在制作<br>做好了会出现在这里</div>` :
      `<div class="idle">${P.status === 'review' ? '审完稿点「开始出片」<br>成片会出现在这里' : '还没有成片'}</div>`;
    const voice = META.voices.find(x => x[0] === P.opts?.voice);
    return `<div class="phone"><div class="scr">${v}${P.stale && P.video ? '<div class="stale">分镜改过了，这是上一版成片。点「重新出片」更新。</div>' : ''}</div></div>
      ${P.video ? `<div class="dl-row"><a class="btn primary" href="${P.video}?dl=1">${I.down}下载 mp4</a><button class="btn" id="copyScript">复制文案</button></div>` : ''}
      <div class="card"><dl class="facts">
        <div><dt>时长</dt><dd>${P.duration ? dur(P.duration) : '—'}</dd></div><div><dt>画质</dt><dd>${P.opts?.h ?? 720}p</dd></div>
        <div><dt>声音</dt><dd>${esc(voice?.[1] ?? '—')}</dd></div><div><dt>DeepSeek 花费</dt><dd title="${P.cost ? esc(Object.entries(P.cost.byStep).map(([k, v]) => `${({research: '调研', write: '写稿', repair: '修镜头表', rewrite: '重写单镜'})[k] ?? k}：${(v.tokens / 1000).toFixed(1)}k token`).join('\n')) : ''}">${P.cost ? yuan(P.cost.cny) : '—'}</dd></div>
        <div><dt>类型</dt><dd>${esc(META.formats.find(f => f.id === (P.opts?.format ?? 'story'))?.name ?? '—')}</dd></div><div><dt>风格</dt><dd>${esc(META.styles.find(s => s.id === (P.opts?.style ?? 'night'))?.name ?? '—')}</dd></div>
        <div class="wide"><dt>话题</dt><dd style="font-weight:500">${esc(P.topic)}</dd></div>
      </dl></div>`;
  }

  function working() {
    // 正在跑的那一步；两步之间的空档里显示下一步
    const order = P.status === 'planning' ? ['research', 'images', 'write'] : ['voice', 'check', 'render', 'mix'];
    const lastDone = Math.max(-1, ...order.map((k, i) => live.steps[k]?.status === 'done' ? i : -1));
    const s = Object.entries(live.steps).find(([, v]) => v.status === 'run')?.[0] ?? (P.status === 'queued' ? null : order[Math.min(order.length - 1, lastDone + 1)]);
    const [t, d] = s ? NOW_TXT[s] : ['排队中', '前面还有任务，轮到了会自动开始'];
    let prog = '';
    if (s === 'render' && live.render) {
      const el = (Date.now() - live.render.start) / 1000, pct = Math.min(96, 100 * el / Math.max(10, live.render.estimate));
      prog = `<div class="bar-p"><span style="width:${pct.toFixed(1)}%"></span></div><div class="bar-note"><span>${live.render.frames} 帧 · ${live.render.h}p</span><span>预计还要 ${Math.max(5, Math.round(live.render.estimate - el))} 秒</span></div>`;
    }
    const el = live.phaseStart ? Math.round((Date.now() - live.phaseStart) / 1000) : 0;
    return `<div class="card working">
      <div class="now"><span class="spin"></span><div><b>${t}</b><small>${d}</small></div><span class="el" id="elapsed">${dur(el)}</span></div>
      ${prog}
      ${live.sources.length ? `<div class="chips">${live.sources.slice(0, 16).map((x, i) => `<a class="chip" href="${esc(x.url)}" target="_blank" rel="noopener" style="animation-delay:${i * 40}ms">${esc(x.site || hostOf(x.url))} · ${esc(x.title || '')}</a>`).join('')}${live.sources.length > 16 ? `<span class="chip">+${live.sources.length - 16}</span>` : ''}</div>` : ''}
      ${live.images.length ? `<div class="thumbs">${live.images.map(im => `<img src="/films/${encodeURIComponent(id)}/${im.path}" alt="">`).join('')}</div>` : ''}
      <details class="log"${store.get('gc-log', false) ? ' open' : ''}><summary>${I.box}运行日志（${live.log.length}）</summary><pre id="logpre">${esc(live.log.join('\n'))}</pre></details>
    </div>`;
  }
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

  function errorBox() {
    return `<div class="card errbox"><h3>${I.alert}${P.failedPhase === 'plan' || !P.plan ? '调研写稿' : '出片'}没成功</h3><pre>${esc(P.error)}</pre>
      <div style="display:flex;gap:8px"><button class="btn primary" id="retry">${I.redo}重试</button>${live.log.length ? '' : ''}</div>
      ${live.log.length ? `<details class="log"><summary>运行日志（${live.log.length}）</summary><pre>${esc(live.log.join('\n'))}</pre></details>` : ''}</div>`;
  }

  // ---- 分镜编辑 ----
  const SKIP = new Set(['scene', 'cover', 'says', 'hero', 'until']), SKIPN = new Set(['at', 'col', 'fx', 'mark', 'hl', 'i', 'pos', 'side', 'c', 'flat', 'y', 'hh', 'drawTo', 'down']);
  const flabel = k => META.fields[k] ?? k;
  function imgPicker(path, val, allowNone) {
    if (!P.images.length) return '';
    return `<div class="grp"><span>${path.endsWith('.img') ? '图片' : '背景图'}</span><div class="imgpick">${allowNone ? `<button class="none ${!val ? 'on' : ''}" data-img="${path}" data-v="">无</button>` : ''}${P.images.map(im => `<button class="${im.path === val ? 'on' : ''}" data-img="${path}" data-v="${esc(im.path)}" title="${esc(im.desc || im.title)}"><img src="${im.url}" alt=""></button>`).join('')}</div></div>`;
  }
  const inp = (path, label, v) => `<label class="f">${esc(label)}<input class="input" data-path="${path}" value="${esc(v)}"></label>`;
  function fieldsOf(s, si) {
    const out = [];
    for (const [k, v] of Object.entries(s)) {
      if (SKIP.has(k)) continue;
      const p = `${si}.${k}`;
      if (k === 'bg' || k === 'img') { out.push(imgPicker(p, v, k === 'bg')); continue; }
      if (k === 'data' && Array.isArray(v)) { out.push(`<label class="f" style="grid-column:1/-1">${flabel(k)}（逗号分开）<input class="input" data-path="${p}" data-kind="nums" value="${esc(v.join(', '))}"></label>`); continue; }
      if (typeof v === 'string' || typeof v === 'number') { if (!SKIPN.has(k)) out.push(inp(p, flabel(k), v)); continue; }
      if (Array.isArray(v)) {
        const rows = v.map((it, j) => {
          if (typeof it === 'string') return inp(`${p}.${j}`, `${flabel(k)} ${j + 1}`, it);
          if (it && typeof it === 'object') return Object.entries(it).filter(([kk, vv]) => !SKIPN.has(kk) && (typeof vv === 'string' || typeof vv === 'number')).map(([kk, vv]) => inp(`${p}.${j}.${kk}`, `${j + 1} · ${flabel(kk)}`, vv)).join('');
          return '';
        }).join('');
        if (rows) out.push(`<div class="grp"><span>${flabel(k)}</span><div class="row">${rows}</div></div>`);
        continue;
      }
      if (v && typeof v === 'object') {
        const rows = Object.entries(v).filter(([kk, vv]) => !SKIPN.has(kk) && (typeof vv === 'string' || typeof vv === 'number')).map(([kk, vv]) => inp(`${p}.${kk}`, flabel(kk), vv)).join('');
        if (rows) out.push(`<div class="grp"><span>${flabel(k)}</span><div class="row">${rows}</div></div>`);
      }
    }
    if (!('bg' in s) && P.images.length && META.scenes[s.scene]?.keys.includes('bg')) out.push(imgPicker(`${si}.bg`, '', true));
    return out.join('');
  }
  // 按实测校准：edge-tts（+5% 语速）念中文约每秒 5.5 个字（标点、数字一起算），句间 0.3 秒
  function estSeconds() { const chars = P.plan.lines.reduce((a, l) => a + [...l.text.replace(/[，。！？、：；“”,.!?:;\s]/g, '')].length, 0); return Math.round(chars / 5.0 + P.plan.lines.length * .3 + .9 + (P.opts?.endCard !== false ? 2.6 : 0)); }
  function sheet() {
    const pl = P.plan, ro = busy();
    const sceneOpts = cur => Object.entries(META.scenes).filter(([k]) => k !== 'vp-photo' || P.images.length).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v.group === '讲' ? '讲 · ' : '图 · '}${esc(v.label)}</option>`).join('');
    return `<div class="card sheet-head">
        <input class="t" id="pTitle" value="${esc(pl.title)}" ${ro ? 'disabled' : ''} placeholder="片名">
        <input class="o" id="pOne" value="${esc(pl.oneLiner)}" ${ro ? 'disabled' : ''} placeholder="一句话">
        <div class="stats"><span>${pl.lines.length} 句</span><span>${pl.shots.length} 镜</span><span>预计 ${estSeconds()} 秒</span></div>
      </div>
      <div class="shots">${pl.shots.map((s, i) => {
        const sc = META.scenes[s.scene] ?? {label: s.scene, group: '讲'};
        const own = pl.lines.filter(l => (s.cover || []).includes(l.id));
        return `<div class="card shot ${s.hero ? 'hero' : ''}" data-i="${i}">
          <div class="rail"><span class="no">${String(i + 1).padStart(2, '0')}</span>${s.hero ? '<span class="star" title="最重的一镜">★</span>' : ''}</div>
          <div class="body">
            <div class="hd"><span class="scene-tag ${sc.group}">${esc(sc.label)}</span><span class="says">${esc(s.says)}</span>
              ${ro ? '' : `<span class="tools"><select class="input" data-scene="${i}" style="height:30px;padding:2px 8px;font-size:12.5px;width:auto" title="换一种画面（AI 会按新组件重写这一镜）">${sceneOpts(s.scene)}</select><button class="btn sm ghost" data-rw="${i}" title="让 AI 重写这一镜">${I.spark}重写</button></span>`}</div>
            <div class="lines">${own.map(l => `<div class="line"><span class="id">${l.id}</span><textarea class="input" rows="1" data-line="${l.id}" ${ro ? 'disabled' : ''}>${esc(l.text)}</textarea></div>`).join('')}</div>
            ${ro ? '' : `<details${store.get('gc-fields', false) ? ' open' : ''} class="fd"><summary class="muted" style="cursor:pointer;font-size:12.5px;margin-bottom:8px">屏上的字和图</summary><div class="fields">${fieldsOf(s, i) || '<span class="muted">这一镜没有可改的字</span>'}</div></details>`}
            ${rewriting === i ? `<div class="rewrite"><input class="input" id="rwText" placeholder="想怎么改？比如：换成柱状图 / 字再短一点 / 突出 37% 这个数（可不写）"><button class="btn primary sm" id="rwGo">${I.spark}重写这一镜</button><button class="btn ghost sm" id="rwX">取消</button></div>` : ''}
          </div></div>`;
      }).join('')}</div>
      ${ro ? '' : `<div class="savebar"><span class="msg" id="saveMsg">${dirty ? '<b>有没保存的修改</b>' : P.status === 'done' && !P.stale ? '成片和分镜一致' : P.stale ? '分镜改过了，成片还是旧的' : '审完了就开始出片吧'}</span>
        ${dirty ? '<button class="btn ghost" id="discard">放弃修改</button><button class="btn" id="save">保存</button>' : ''}
        <button class="btn primary" id="produce">${I.film}${P.video ? '重新出片' : '开始出片'}</button></div>`}`;
  }
  const md = s => {
    const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/(^|[\s（(])(https?:\/\/[^\s)）<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    const lines = s.split(/\r?\n/); let html = '', list = null, table = null;
    const flush = () => { if (list) { html += `</${list}>`; list = null; } if (table) { html += '</table>'; table = null; } };
    for (const ln of lines) {
      let m;
      if (/^\s*\|.*\|\s*$/.test(ln)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(ln)) continue; const cells = ln.trim().slice(1, -1).split('|').map(c => inl(c.trim()));
        if (!table) { flush(); table = true; html += '<table><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr>'; } else html += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'; continue; }
      if (table) { html += '</table>'; table = null; }
      if ((m = /^(#{1,4})\s+(.*)/.exec(ln))) { flush(); const n = Math.min(3, m[1].length + 1); html += `<h${n}>${inl(m[2])}</h${n}>`; }
      else if ((m = /^\s*[-*]\s+(.*)/.exec(ln))) { if (list !== 'ul') { flush(); list = 'ul'; html += '<ul>'; } html += `<li>${inl(m[1])}</li>`; }
      else if ((m = /^\s*\d+[.、]\s+(.*)/.exec(ln))) { if (list !== 'ol') { flush(); list = 'ol'; html += '<ol>'; } html += `<li>${inl(m[1])}</li>`; }
      else if ((m = /^>\s?(.*)/.exec(ln))) { flush(); html += `<blockquote>${inl(m[1])}</blockquote>`; }
      else if (/^---+$/.test(ln.trim())) { flush(); html += '<hr>'; }
      else if (ln.trim()) { flush(); html += `<p>${inl(ln)}</p>`; } else flush();
    }
    flush(); return html;
  };
  function sourcesTab() {
    if (!P.sources.length) return '<div class="empty">没有来源记录</div>';
    return `<div class="srcs">${P.sources.map(s => `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener"><span class="badge" style="width:20px;height:20px;padding:0;justify-content:center">${esc((s.site || hostOf(s.url)).slice(0, 1).toUpperCase())}</span>
      <span style="min-width:0"><b>${esc(s.title || s.url)}</b><small>${esc(s.site || hostOf(s.url))}${s.date ? ' · ' + esc(String(s.date).slice(0, 10)) : ''}</small></span>${s.cited ? '<span class="cited">被引用</span>' : '<span></span>'}</a>`).join('')}</div>`;
  }
  function optsTab() {
    const o = P.opts ?? {};
    return `<div class="card pad"><h3>这条片的设置</h3><p class="hint">改完点「${P.video ? '重新出片' : '开始出片'}」生效。不用重新调研，也不花 DeepSeek 的钱。</p>
      <div class="style-h" style="padding:0 0 8px">画面风格</div>${styleCards(o.style ?? 'night', 'p-style')}
      <div class="optgrid" style="margin-top:16px">
        <label class="f">声音<select class="input" data-opt="voice">${META.voices.map(v => `<option value="${v[0]}"${v[0] === o.voice ? ' selected' : ''}>${esc(v[1])} · ${esc(v[2])}</option>`).join('')}</select></label>
        <label class="f">配乐<select class="input" data-opt="music">${musicItems().map(([v, t]) => `<option value="${esc(v)}"${v === (o.music ?? 'auto') ? ' selected' : ''}>${esc(t.replace('配乐：', ''))}</option>`).join('')}</select></label>
        <label class="f">画质<select class="input" data-opt="h"><option value="720"${o.h != 1080 ? ' selected' : ''}>720p（快）</option><option value="1080"${o.h == 1080 ? ' selected' : ''}>1080p 高清</option></select></label>
        <label class="f">栏目名（片尾和接缝的小字）<input class="input" data-opt="brand" maxlength="8" value="${esc(o.brand ?? '')}" placeholder="可不填"></label>
      </div>
      <div style="margin-top:14px"><span class="switch ${o.endCard !== false ? 'on' : ''}" data-opt-switch="endCard"><i></i>片尾卡（片名 + 栏目名，停 2.6 秒）</span></div></div>`;
  }

  function render() {
    if (g !== gen) return;
    const canEdit = P.plan && !busy();
    const tabs = P.plan ? `<div class="tabs" id="tabs">${[['sheet', '分镜'], ['research', '调研简报'], ['sources', `来源<span class="n">${P.sources.length}</span>`], ['opts', '本片设置']].map(([k, t]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="tabBody">${tab === 'sheet' ? sheet() : tab === 'research' ? `<div class="card pad md">${md(P.research || '（没有）')}</div>` : tab === 'sources' ? sourcesTab() : optsTab()}</div>` : '';
    view.innerHTML = `<div class="page">
      <a class="crumb" href="#/library">${I.back}作品</a>
      <div class="top"><div style="min-width:0"><h1>${esc(P.plan?.title ?? P.title ?? P.topic)}</h1><div class="sub">${badge(P.status)} <span style="margin-left:6px">${esc(P.plan?.oneLiner || P.topic)}</span></div></div>
        <div class="actions">${!busy() ? `<button class="btn ghost danger" id="del">${I.trash}删除</button>` : ''}${P.status === 'done' || P.status === 'review' ? `<button class="btn" id="replan" title="重新联网调研、重写文案和分镜（会花一点 DeepSeek 的钱）">${I.redo}重新调研</button>` : ''}</div></div>
      ${stepper()}
      <div class="proj"><div style="min-width:0">${busy() ? working() : ''}${P.status === 'error' ? errorBox() : ''}${busy() && P.plan ? '<div style="height:18px"></div>' : ''}${tabs}</div>
        <aside class="aside">${aside()}</aside></div></div>`;
    bind();
  }

  // ---- 交互 ----
  const getPath = path => { const ks = path.split('.'); let o = P.plan.shots; for (const k of ks.slice(0, -1)) o = o[k]; return [o, ks.at(-1)]; };
  // 第一次改动：只换底部保存条，不重画整页（不然正在打字的输入框会丢焦点）
  const markDirty = () => {
    if (dirty) return; dirty = true;
    const m = $('#saveMsg'); if (!m) return;
    m.innerHTML = '<b>有没保存的修改</b>';
    m.insertAdjacentHTML('afterend', '<button class="btn ghost" id="discard">放弃修改</button><button class="btn" id="save">保存</button>');
    $('#save').addEventListener('click', async () => { try { await save(); render(); } catch (e) { toast(e.message, true); } });
    $('#discard').addEventListener('click', async () => { dirty = false; await load(); render(); });
  };
  async function save(quiet) {
    P.plan.title = $('#pTitle')?.value ?? P.plan.title; P.plan.oneLiner = $('#pOne')?.value ?? P.plan.oneLiner;
    const r = await api('PUT', `/api/projects/${encodeURIComponent(id)}/plan`, {plan: P.plan});
    P.plan = r.plan; dirty = false; if (P.status === 'done') P.stale = true;
    if (r.notes?.length && !quiet) toast('已保存，自动校正了 ' + r.notes.length + ' 处');
    else if (!quiet) toast('已保存');
  }
  function bind() {
    $('#tabs')?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; store.set('gc-tab', tab); render(); } });
    $('#retry')?.addEventListener('click', async () => { try { await api('POST', `/api/projects/${encodeURIComponent(id)}/${P.failedPhase === 'plan' || !P.plan ? 'plan' : 'produce'}`); await reload(); } catch (e) { toast(e.message, true); } });
    $('#del')?.addEventListener('click', async () => { if (!await confirmBox('删除这个作品？', '会挪到作品目录下的 _trash 文件夹，想找回可以去那里拿。', '删除', true)) return;
      try { await api('DELETE', `/api/projects/${encodeURIComponent(id)}`); toast('已删除'); location.hash = '#/library'; } catch (e) { toast(e.message, true); } });
    $('#replan')?.addEventListener('click', async () => { if (!await confirmBox('重新调研？', '会重新联网搜索、重写文案和分镜，现在的分镜会被换掉（成片保留到重新出片为止）。大约花 ¥0.1。', '重新调研')) return;
      try { await api('POST', `/api/projects/${encodeURIComponent(id)}/plan`); await reload(); } catch (e) { toast(e.message, true); } });
    $('#copyScript')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(`${P.plan.title}\n\n${P.plan.lines.map(l => l.text).join('\n')}`); toast('文案已复制'); } catch { toast('复制失败', true); } });
    $$('details.log').forEach(d => d.addEventListener('toggle', () => store.set('gc-log', d.open)));
    $$('details.fd').forEach(d => d.addEventListener('toggle', () => store.set('gc-fields', d.open)));
    // 分镜编辑
    $$('[data-line]').forEach(t => { const fit = () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }; fit();
      t.addEventListener('input', () => { fit(); P.plan.lines.find(l => l.id === t.dataset.line).text = t.value; markDirty(); }); });
    $$('[data-path]').forEach(el => el.addEventListener('input', () => { const [o, k] = getPath(el.dataset.path);
      o[k] = el.dataset.kind === 'nums' ? el.value.split(/[,，\s]+/).map(Number).filter(Number.isFinite) : el.value; markDirty(); }));
    $$('[data-img]').forEach(b => b.addEventListener('click', () => { const [o, k] = getPath(b.dataset.img); if (b.dataset.v) o[k] = b.dataset.v; else delete o[k]; dirty = true; render(); }));
    $('#pTitle')?.addEventListener('input', markDirty); $('#pOne')?.addEventListener('input', markDirty);
    $('#save')?.addEventListener('click', async () => { try { await save(); render(); } catch (e) { toast(e.message, true); } });
    $('#discard')?.addEventListener('click', async () => { dirty = false; await load(); render(); });
    $('#produce')?.addEventListener('click', async () => {
      try { if (dirty) await save(true); await api('POST', `/api/projects/${encodeURIComponent(id)}/produce`); toast('开始出片'); await reload(); } catch (e) { toast(e.message, true); } });
    $$('[data-rw]').forEach(b => b.addEventListener('click', () => { rewriting = +b.dataset.rw; render(); $('#rwText')?.focus(); }));
    $('#rwX')?.addEventListener('click', () => { rewriting = -1; render(); });
    const doRewrite = async (i, scene) => {
      const card = $(`.shot[data-i="${i}"]`); card.style.opacity = .55; card.querySelector('.hd').insertAdjacentHTML('beforeend', '<span class="spin"></span>');
      try { if (dirty) await save(true); const r = await api('POST', `/api/projects/${encodeURIComponent(id)}/rewrite`, {index: i, instruction: $('#rwText')?.value ?? '', scene});
        P.plan = r.plan; rewriting = -1; if (P.status === 'done') P.stale = true; toast(`第 ${i + 1} 镜重写好了`); } catch (e) { toast(e.message, true); }
      render(); refreshStatus();
    };
    $('#rwGo')?.addEventListener('click', () => doRewrite(rewriting, null));
    $('#rwText')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRewrite(rewriting, null); });
    $$('[data-scene]').forEach(s => s.addEventListener('change', () => doRewrite(+s.dataset.scene, s.value)));
    // 本片设置：改了就存
    const ps = $('#p-style');
    if (ps) bindStyleCards(ps, async v => { try { const r = await api('PUT', `/api/projects/${encodeURIComponent(id)}/opts`, {style: v}); P.opts = r.opts; toast(`风格换成「${META.styles.find(s => s.id === v)?.name}」，点${P.video ? '「重新出片」' : '「开始出片」'}生效`); } catch (e) { toast(e.message, true); } });
    $$('[data-opt]').forEach(el => el.addEventListener('change', async () => { try { const r = await api('PUT', `/api/projects/${encodeURIComponent(id)}/opts`, {[el.dataset.opt]: el.dataset.opt === 'h' ? +el.value : el.value}); P.opts = r.opts; toast('已保存'); } catch (e) { toast(e.message, true); } }));
    $$('[data-opt-switch]').forEach(el => el.addEventListener('click', async () => { const k = el.dataset.optSwitch, v = !el.classList.contains('on'); el.classList.toggle('on', v);
      try { const r = await api('PUT', `/api/projects/${encodeURIComponent(id)}/opts`, {[k]: v}); P.opts = r.opts; } catch (e) { toast(e.message, true); } }));
  }

  // 换阶段（开始出片、重试、重新调研）：清掉上一段的实时状态，按服务端这一段的事件重来
  async function reload() {
    await load();
    Object.assign(live, {steps: {}, log: [], sources: [], images: [], render: null, phaseStart: null});
    (P.events || []).forEach(ingest);
    render(); connect(); refreshStatus();
  }
  function connect() {
    es?.close(); es = null; clearInterval(tick);
    if (!busy()) return;
    es = new EventSource(`/api/projects/${encodeURIComponent(id)}/events`);
    const seen = new Set((P.events || []).map(e => e.seq));
    es.onmessage = async ev => {
      const e = JSON.parse(ev.data); if (e.seq != null) { if (seen.has(e.seq)) return; seen.add(e.seq); }
      ingest(e);
      if (['plan', 'done', 'error', 'phase-done', 'phase'].includes(e.type)) {
        if (e.type === 'done') toast('成片做好了 🎬'); if (e.type === 'error') toast('出错了：' + e.msg.split('\n')[0], true);
        await load(); render(); if (!busy()) { es?.close(); clearInterval(tick); refreshStatus(); }
        return;
      }
      if (e.type === 'step' || e.type === 'sources' || e.type === 'images' || e.type === 'render') { render(); return; }
      if (e.type === 'log') { const pre = $('#logpre'); if (pre) { pre.textContent = live.log.join('\n'); pre.scrollTop = pre.scrollHeight; } }
    };
    tick = setInterval(() => {                   // 计时和渲染进度条每秒动一下（不重画整页）
      const el = $('#elapsed'); if (el && live.phaseStart) el.textContent = dur((Date.now() - live.phaseStart) / 1000);
      if (live.render && Object.entries(live.steps).some(([k, v]) => k === 'render' && v.status === 'run')) {
        const s = (Date.now() - live.render.start) / 1000, bar = $('.bar-p span'), note = $('.bar-note span:last-child');
        if (bar) bar.style.width = Math.min(96, 100 * s / Math.max(10, live.render.estimate)).toFixed(1) + '%';
        if (note) note.textContent = `预计还要 ${Math.max(5, Math.round(live.render.estimate - s))} 秒`;
      }
    }, 1000);
  }
  const leave = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', leave);
  cleanup.push(() => { es?.close(); clearInterval(tick); removeEventListener('beforeunload', leave); });
  render(); connect();
}

refreshStatus(); route();
