#!/usr/bin/env node
// 本机网页界面：node app/server.mjs → 浏览器打开 http://127.0.0.1:5178
// 只监听 127.0.0.1（本机），不对外开放。同一时间只跑一个任务（调研写稿 / 出片），其余排队。
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {config, saveEnv} from './lib/env.mjs';
import {STEPS, DEFAULTS, createProject, planPhase, producePhase, savePlan, rewriteOne, readState, setState, projectDir, toRaw} from './lib/pipeline.mjs';
import {SCENES, LABELS, FIELD_LABELS} from './lib/catalog.mjs';
import {listMusic, MUSIC_DIR, poster} from './lib/film.mjs';
import {STYLES, styleList} from './lib/styles.mjs';
import {FORMATS, formatList} from './lib/formats.mjs';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
const FILMS = config.filmsDir(); fs.mkdirSync(FILMS, {recursive: true});
const VOICES = [
  ['zh-CN-YunxiNeural', '云希', '男声 · 年轻利落'], ['zh-CN-YunjianNeural', '云健', '男声 · 沉稳有力'], ['zh-CN-YunyangNeural', '云扬', '男声 · 新闻播报'],
  ['zh-CN-XiaoxiaoNeural', '晓晓', '女声 · 温暖自然'], ['zh-CN-XiaoyiNeural', '晓伊', '女声 · 活泼'], ['zh-CN-XiaochenNeural', '晓辰', '女声 · 知性'],
];

// ---------------- 任务队列：每个项目一份事件记录，浏览器断线重连能补上 ----------------
const live = new Map();          // 项目 id → {events, clients, kind, running}
const queue = []; let busy = null;
const chan = id => { if (!live.has(id)) live.set(id, {events: [], clients: new Set(), kind: null, running: false}); return live.get(id); };
let SEQ = 0;                     // 每条事件一个递增编号：浏览器重连补发时靠它去重（同一毫秒可能有好几条）
function emit(id, e) {
  const c = chan(id); e.ts = Date.now(); e.seq = ++SEQ; c.events.push(e); if (c.events.length > 800) c.events.splice(0, 200);
  for (const res of c.clients) res.write(`data: ${JSON.stringify(e)}\n\n`);
}
function enqueue(id, kind, then = null) {
  const c = chan(id);
  if (c.running || queue.some(q => q.id === id)) throw new Error('这个项目已经在做了');
  c.events = []; c.kind = kind;
  queue.push({id, kind, then});
  emit(id, {type: 'queued', kind, position: queue.length + (busy ? 1 : 0)});
  pump();
}
async function pump() {
  if (busy || !queue.length) return;
  busy = queue.shift(); const {id, kind, then} = busy, c = chan(id), dir = projectDir(id);
  c.running = true; emit(id, {type: 'phase', kind});
  try {
    if (kind === 'plan') await planPhase(dir, e => emit(id, e));
    else await producePhase(dir, e => emit(id, e));
    emit(id, {type: 'phase-done', kind});
    if (then) { busy = null; c.running = false; enqueue(id, then); return; }
  } catch (e) {
    emit(id, {type: 'error', kind, msg: e.message});
  } finally {
    c.running = false; if (busy?.id === id) busy = null; pump();
  }
}

// ---------------- 项目读取 ----------------
const readJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const fileURL = (id, f) => `/films/${encodeURIComponent(id)}/${f.split('/').map(encodeURIComponent).join('/')}`;
function summary(id) {
  const dir = projectDir(id), st = readState(dir); if (!st.id) return null;
  const u = readJSON(path.join(dir, 'usage.json'));
  const video = st.video && fs.existsSync(path.join(dir, st.video)) ? fileURL(id, st.video) : null;
  const c = live.get(id), q = queue.findIndex(x => x.id === id);
  return {id, topic: st.topic, title: st.title ?? st.topic, status: c?.running ? (c.kind === 'plan' ? 'planning' : 'producing') : q >= 0 ? 'queued' : st.status,
    error: st.error, failedPhase: st.failedPhase ?? null, stale: !!st.stale, created: st.created, updated: st.updated, duration: st.duration ?? null, h: st.h ?? null, opts: st.opts,
    video, poster: fs.existsSync(path.join(dir, 'poster.jpg')) ? fileURL(id, 'poster.jpg') + `?v=${st.updated}` : null,
    cost: u ? {tokens: u.tokens, usd: u.usd, cny: u.cny, byStep: u.byStep} : null};
}
function listProjects() {
  return fs.readdirSync(FILMS, {withFileTypes: true}).filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => summary(d.name)).filter(Boolean).sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
}
function detail(id) {
  const s = summary(id); if (!s) return null;
  const dir = projectDir(id), plan = readJSON(path.join(dir, 'plan.json'));
  let research = ''; try { research = fs.readFileSync(path.join(dir, 'research.md'), 'utf8'); } catch {}
  const images = (readJSON(path.join(dir, 'images.json'), [])).map(im => ({...im, url: fileURL(id, im.path)}));
  return {...s, plan: plan ? toRaw(plan) : null, research, sources: readJSON(path.join(dir, 'sources.json'), []), images,
    events: live.get(id)?.events ?? []};
}

// ---------------- HTTP ----------------
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'};
function sendFile(req, res, file, extra = {}) {
  let st; try { st = fs.statSync(file); if (!st.isFile()) throw 0; } catch { return res.writeHead(404).end('not found'); }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {                                            // 视频拖进度条要 Range
    const a = range[1] ? Number(range[1]) : 0, b = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, ...extra});
    return fs.createReadStream(file, {start: a, end: b}).pipe(res);
  }
  res.writeHead(200, {'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ...extra});
  fs.createReadStream(file).pipe(res);
}
const json = (res, code, v) => res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'}).end(JSON.stringify(v));
const body = req => new Promise((ok, bad) => { let s = ''; req.on('data', c => { s += c; if (s.length > 2e6) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } }); });
const inside = (base, p) => { const r = path.resolve(base, p); return r.startsWith(path.resolve(base) + path.sep) ? r : null; };
const okId = id => /^[^\\/.][^\\/]*$/.test(id) && fs.existsSync(path.join(FILMS, id, 'state.json'));

function cleanOpts(b, base = DEFAULTS) {
  const o = {...base};
  if ([30, 45, 60, 75, 90].includes(Number(b.seconds))) o.seconds = Number(b.seconds);
  if ([720, 1080].includes(Number(b.h))) o.h = Number(b.h);
  if (VOICES.some(v => v[0] === b.voice)) o.voice = b.voice;
  if (typeof b.brand === 'string') o.brand = b.brand.slice(0, 8);
  if (typeof b.music === 'string' && (['auto', 'tense', 'bright', 'none'].includes(b.music) || listMusic().includes(b.music))) o.music = b.music;
  if (typeof b.review === 'boolean') o.review = b.review;
  if (typeof b.endCard === 'boolean') o.endCard = b.endCard;
  if (STYLES[b.style]) o.style = b.style;
  if (FORMATS[b.format]) o.format = b.format;
  return o;
}

const routes = [
  ['GET', /^\/api\/status$/, (req, res) => {
    const k = config.apiKey(), all = listProjects();
    const month = new Date().toISOString().slice(0, 7);
    const spent = all.filter(p => new Date(p.created ?? 0).toISOString().slice(0, 7) === month).reduce((a, p) => a + (p.cost?.cny ?? 0), 0);
    json(res, 200, {hasKey: !!k, keyHint: k ? `${k.slice(0, 5)}…${k.slice(-4)}` : '', model: config.model(), steps: STEPS,
      busy: busy ? {id: busy.id, kind: busy.kind} : null, queued: queue.length, monthCny: spent, count: all.filter(p => p.video).length});
  }],
  ['GET', /^\/api\/meta$/, (req, res) => json(res, 200, {voices: VOICES, formats: formatList(), styles: styleList(), music: listMusic(), musicDir: MUSIC_DIR, defaults: {...DEFAULTS, voice: config.voice()},
    scenes: Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, {label: LABELS[k][0], group: LABELS[k][1], doc: v.doc, keys: v.keys}])), fields: FIELD_LABELS})],
  ['POST', /^\/api\/key$/, async (req, res) => {
    const {key} = await body(req);
    if (!/^sk-[\w-]{10,}$/.test(key ?? '')) return json(res, 400, {error: 'Key 应该是 sk- 开头的一串'});
    saveEnv('DEEPSEEK_API_KEY', key.trim()); json(res, 200, {ok: true});
  }],
  ['PUT', /^\/api\/settings$/, async (req, res) => {
    const b = await body(req);
    if (VOICES.some(v => v[0] === b.voice)) saveEnv('GOLDCUT_VOICE', b.voice);
    if ([1, 2, 3, 4].includes(Number(b.workers))) { saveEnv('GOLDCUT_WORKERS', String(b.workers)); process.env.GOLDCUT_WORKERS = String(b.workers); }
    json(res, 200, {ok: true});
  }],
  ['GET', /^\/api\/settings$/, (req, res) => json(res, 200, {voice: config.voice(), workers: Number(process.env.GOLDCUT_WORKERS ?? 2), filmsDir: FILMS, model: config.model()})],
  ['GET', /^\/api\/projects$/, (req, res) => json(res, 200, listProjects())],
  ['POST', /^\/api\/projects$/, async (req, res) => {
    const b = await body(req); const topic = String(b.topic ?? '').trim().slice(0, 200);
    if (!topic) return json(res, 400, {error: '先写一个话题'});
    if (!config.apiKey()) return json(res, 400, {error: '还没有填 DeepSeek API Key'});
    const o = cleanOpts(b); o.voice ??= config.voice();
    const dir = await createProject(topic, o), id = path.basename(dir);
    enqueue(id, 'plan', o.review ? null : 'produce');
    json(res, 200, {id});
  }],
  ['GET', /^\/api\/projects\/([^/]+)$/, (req, res, id) => { const d = okId(id) && detail(id); d ? json(res, 200, d) : json(res, 404, {error: '没有这个项目'}); }],
  ['PUT', /^\/api\/projects\/([^/]+)\/plan$/, async (req, res, id) => {
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    if (chan(id).running) return json(res, 409, {error: '正在做，等它做完再改'});
    const {plan} = await body(req); json(res, 200, savePlan(projectDir(id), plan));
  }],
  ['PUT', /^\/api\/projects\/([^/]+)\/opts$/, async (req, res, id) => {
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    const dir = projectDir(id), st = readState(dir); setState(dir, {opts: cleanOpts(await body(req), {...DEFAULTS, ...st.opts})}); json(res, 200, summary(id));
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/rewrite$/, async (req, res, id) => {
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    if (chan(id).running) return json(res, 409, {error: '正在做，等它做完再改'});
    const b = await body(req); const scene = SCENES[b.scene] ? b.scene : null;
    json(res, 200, await rewriteOne(projectDir(id), Number(b.index), String(b.instruction ?? '').slice(0, 300), scene));
  }],
  ['POST', /^\/api\/projects\/([^/]+)\/(produce|plan)$/, async (req, res, id, kind) => {
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    if (kind === 'plan' && !config.apiKey()) return json(res, 400, {error: '还没有填 DeepSeek API Key'});
    enqueue(id, kind); json(res, 200, {ok: true});
  }],
  ['DELETE', /^\/api\/projects\/([^/]+)$/, (req, res, id) => {           // 不真删：挪进 films/_trash，想找回去那里拿
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    if (chan(id).running || queue.some(q => q.id === id)) return json(res, 409, {error: '正在做，不能删'});
    const trash = path.join(FILMS, '_trash'); fs.mkdirSync(trash, {recursive: true});
    fs.renameSync(path.join(FILMS, id), path.join(trash, id)); live.delete(id); json(res, 200, {ok: true});
  }],
  ['GET', /^\/api\/projects\/([^/]+)\/events$/, (req, res, id) => {
    if (!okId(id)) return json(res, 404, {error: '没有这个项目'});
    const c = chan(id);
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive'});
    res.write(`retry: 3000\n\n`);
    for (const e of c.events) res.write(`data: ${JSON.stringify(e)}\n\n`);
    c.clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); c.clients.delete(res); });
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
  try {
    for (const [m, re, fn] of routes) { const mm = req.method === m && re.exec(p); if (mm) return await fn(req, res, ...mm.slice(1)); }
    if (req.method === 'GET' && p.startsWith('/films/')) {
      const f = inside(FILMS, p.slice('/films/'.length)); if (!f) return res.writeHead(403).end();
      return sendFile(req, res, f, url.searchParams.has('dl') ? {'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}`} : {});
    }
    if (req.method === 'GET') {
      const f = p === '/' ? path.join(WEB, 'index.html') : inside(WEB, p.slice(1));
      if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return sendFile(req, res, f);
      return sendFile(req, res, path.join(WEB, 'index.html'));        // 单页应用：别的路径都回首页
    }
    res.writeHead(404).end('not found');
  } catch (e) { json(res, 500, {error: e.message}); }
});

// 老版本做的片子没有 state.json：补一份，作品库里才看得到
for (const d of fs.readdirSync(FILMS, {withFileTypes: true})) {
  const dir = path.join(FILMS, d.name);
  if (!d.isDirectory() || d.name.startsWith('_') || fs.existsSync(path.join(dir, 'state.json'))) continue;
  const plan = readJSON(path.join(dir, 'plan.json')), mp4 = fs.readdirSync(dir).find(f => f.endsWith('.mp4'));
  if (!plan) continue;
  const tl = readJSON(path.join(dir, 'timeline.json'), {}), t = fs.statSync(dir).birthtimeMs;
  setState(dir, {id: d.name, topic: d.name.replace(/^\d{8}-\d{6}_/, ''), title: plan.title, opts: {...DEFAULTS}, status: mp4 ? 'done' : 'review',
    video: mp4, duration: tl.duration, h: 720, created: t});
  if (mp4 && !fs.existsSync(path.join(dir, 'poster.jpg'))) poster(path.join(dir, mp4), path.join(dir, 'poster.jpg'), (tl.duration ?? 10) * .62).catch(() => {});
}

// 上次没做完就关了服务：状态停在"进行中"的改成出错，可以在页面上重试
for (const p of listProjects()) if (['planning', 'producing', 'queued'].includes(readState(projectDir(p.id)).status))
  setState(projectDir(p.id), {status: 'error', error: '上次没做完服务就关了，点重试接着做', failedPhase: readState(projectDir(p.id)).status === 'planning' ? 'plan' : 'produce'});

const port = config.port();
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`端口 ${port} 已经被占用：多半是已经开着一个金剪了，直接打开 http://127.0.0.1:${port} 就行。\n想同时开两个，在 .env 里写 GOLDCUT_PORT=5180 换个端口。`);
  else console.error('服务启动失败：' + e.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`金剪 goldcut 已启动：http://127.0.0.1:${port}`);
  console.log(`作品存在：${FILMS}`);
  if (!config.apiKey()) console.log('还没有 DeepSeek API Key：打开网页在设置里填，或者在 .env 里写 DEEPSEEK_API_KEY=sk-...');
});
