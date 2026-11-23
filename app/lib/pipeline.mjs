// 一个"项目" = films/ 下的一个文件夹。分两段做，中间可以停下来让人审稿：
//   plan     调研 → 配图 → 写文案和镜头表                    → 状态 review（等人看）
//   produce  配音 → 检查镜头表（错了交回 DeepSeek 修）→ 渲染 → 混音 → 封面 → 状态 done
// 自动模式（CLI 默认、网页上关掉"先审稿"）就是 plan 完直接 produce。
// 每一步都往 emit 发进度：CLI 打印，网页用 SSE 推给浏览器。
import fs from 'node:fs'; import path from 'node:path';
import {config} from './env.mjs';
import {research} from './research.mjs';
import {gatherImages} from './images.mjs';
import {writePlan, repairPlan, rewriteShot, normalizePlan, fallbackShot} from './writer.mjs';
import {scaffold, writeScript, writeFilm, voiceOver, check, render, mix, mux, poster} from './film.mjs';
import {Meter, costLine} from './cost.mjs';
import {FORMATS, writeContent, compile} from './formats.mjs';

export const STEPS = [
  ['research', '联网调研'], ['images', '找配图'], ['write', '写文案和镜头表'], ['voice', '配音'],
  ['check', '检查镜头表'], ['render', '逐帧渲染'], ['mix', '混音合成'],
];
export const DEFAULTS = {h: 720, seconds: 60, voice: null, brand: '', music: 'auto', review: false, endCard: true, style: 'night', format: 'story'};

const slug = s => s.replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 24) || 'film';
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
export const toRaw = plan => ({...plan, shots: plan.shots.map(({until, _lines, ...s}) => ({...s, cover: _lines}))});

// ---------------- 项目文件 ----------------
export const projectDir = id => path.join(config.filmsDir(), id);
const P = (dir, f) => path.join(dir, f);
const readJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJSON = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
export const readState = dir => readJSON(P(dir, 'state.json'), {});
export function setState(dir, patch) { const s = {...readState(dir), ...patch, updated: Date.now()}; writeJSON(P(dir, 'state.json'), s); return s; }

export async function createProject(topic, opts = {}) {
  const o = {...DEFAULTS, ...opts}; o.voice ??= config.voice();
  if (!config.apiKey() && !o.plan) throw new Error('没有 DeepSeek API Key：在设置里填，或者在项目根目录的 .env 里写 DEEPSEEK_API_KEY=sk-...');
  const id = `${stamp()}_${slug(topic)}`, dir = o.dir ?? projectDir(id);
  await scaffold(dir);
  const {plan, images, sources, dir: _d, ...keep} = o;
  setState(dir, {id: path.basename(dir), topic, opts: keep, status: 'new', created: Date.now()});
  if (plan) {                                            // 离线：直接给了计划
    writeJSON(P(dir, 'images.json'), images ?? []); writeJSON(P(dir, 'sources.json'), sources ?? []);
    writeJSON(P(dir, 'plan.json'), normalizePlan(plan, images ?? []).plan);
    setState(dir, {status: 'review', title: plan.title});
  }
  return dir;
}

function ctx(dir, emit) {
  const st = readState(dir);
  const meter = new Meter(readJSON(P(dir, 'usage.json'), {}).calls_detail ?? []);
  const usage = () => { const u = meter.summary(); if (u.calls) writeJSON(P(dir, 'usage.json'), u); return u; };
  return {st, o: {...DEFAULTS, ...st.opts}, meter, usage,
    step: (id, status, extra = {}) => emit({type: 'step', id, status, ...extra}),
    log: msg => emit({type: 'log', msg})};
}
const planSummary = p => ({title: p.title, oneLiner: p.oneLiner, lines: p.lines, shots: p.shots.map(s => ({scene: s.scene, says: s.says, hero: !!s.hero}))});

// ---------------- 第一段：调研 + 写稿 ----------------
export async function planPhase(dir, emit = () => {}) {
  const {st, o, meter, usage, step, log} = ctx(dir, emit);
  setState(dir, {status: 'planning', error: null});
  try {
    step('research', 'run');
    const fmt = FORMATS[o.format] ? o.format : 'story';
    const {brief, sources} = await research(st.topic, log, meter, FORMATS[fmt].research);
    fs.writeFileSync(P(dir, 'research.md'), brief); writeJSON(P(dir, 'sources.json'), sources);
    step('research', 'done', {summary: `${sources.length} 个来源`});
    emit({type: 'sources', sources: sources.slice(0, 30)});

    step('images', 'run');
    let images = [];
    try { images = await gatherImages(sources, dir, {log, meter}); } catch (e) { log('配图失败，跳过：' + e.message); }
    writeJSON(P(dir, 'images.json'), images);
    step('images', 'done', {summary: `${images.length} 张`});
    emit({type: 'images', images});

    step('write', 'run');
    let raw;
    if (fmt === 'story') raw = await writePlan(st.topic, brief, images, {seconds: o.seconds}, log, meter);
    else {                                       // 其余类型：模型写结构化内容，程序按这个类型的骨架拼镜头
      log(`按「${FORMATS[fmt].name}」的结构写内容…`);
      const content = await writeContent(fmt, st.topic, brief, images, {seconds: o.seconds}, meter);
      writeJSON(P(dir, 'content.json'), content);
      raw = compile(fmt, content, images);
    }
    writeJSON(P(dir, 'plan_raw.json'), raw);
    const {plan, notes} = normalizePlan(raw, images);
    notes.forEach(n => log('校正：' + n));
    writeJSON(P(dir, 'plan.json'), plan);
    step('write', 'done', {summary: `${plan.lines.length} 句 · ${plan.shots.length} 镜`});
    log(costLine(usage()));
    setState(dir, {status: 'review', title: plan.title});
    emit({type: 'plan', plan: planSummary(plan)});
    return plan;
  } catch (e) { setState(dir, {status: 'error', error: e.message, failedPhase: 'plan'}); throw e; }
  finally { usage(); }
}

// ---------------- 审稿：保存修改、重做一镜 ----------------
export function savePlan(dir, raw) {
  const images = readJSON(P(dir, 'images.json'), []);
  const {plan, notes} = normalizePlan(raw, images);
  writeJSON(P(dir, 'plan.json'), plan);
  const st = readState(dir);
  setState(dir, {title: plan.title, ...(st.status === 'done' ? {stale: true} : {})});
  return {plan: toRaw(plan), notes};
}

export async function rewriteOne(dir, index, instruction, scene) {
  const images = readJSON(P(dir, 'images.json'), []);
  const raw = toRaw(readJSON(P(dir, 'plan.json')));
  if (!raw.shots[index]) throw new Error(`没有第 ${index + 1} 镜`);
  const meter = new Meter(readJSON(P(dir, 'usage.json'), {}).calls_detail ?? []);
  let brief = ''; try { brief = fs.readFileSync(P(dir, 'research.md'), 'utf8'); } catch {}
  raw.shots[index] = await rewriteShot(raw, index, instruction, scene, brief, images, meter);
  writeJSON(P(dir, 'usage.json'), meter.summary());
  return savePlan(dir, raw);
}

// ---------------- 第二段：出片 ----------------
export async function producePhase(dir, emit = () => {}) {
  const {o, meter, usage, step, log} = ctx(dir, emit);
  const t0 = Date.now();
  setState(dir, {status: 'producing', error: null});
  try {
    let plan = readJSON(P(dir, 'plan.json'));
    if (!plan) throw new Error('还没有文案和镜头表');
    const images = readJSON(P(dir, 'images.json'), []), sources = readJSON(P(dir, 'sources.json'), []);

    step('voice', 'run');
    writeScript(dir, plan, {voice: o.voice, endCard: o.endCard});
    const tl = await voiceOver(dir, ln => /总长|^b\d/.test(ln) || log(ln));
    step('voice', 'done', {summary: `${tl.duration.toFixed(1)} 秒`});

    // 检查镜头表：出错交回 DeepSeek 修（最多两次），还不行就把出错的镜换成兜底
    step('check', 'run');
    const film = {bg: (images.find(im => im.kind === 'photo') ?? images[0])?.path ?? null, brand: o.brand, endCard: o.endCard, style: o.style};
    let res;
    for (let attempt = 0; ; attempt++) {
      writeFilm(dir, plan, film);
      res = await check(dir);
      if (res.ok) break;
      log(`检查没过（第 ${attempt + 1} 次）：\n` + res.errors.split('\n').slice(0, 12).join('\n'));
      if (attempt < 2 && config.apiKey()) {
        try { ({plan} = normalizePlan(await repairPlan(toRaw(plan), res.errors, images, log, meter), images)); continue; }
        catch (e) { log('修复失败：' + e.message); }
      }
      if (attempt >= 4) throw new Error('镜头表一直过不了检查：\n' + res.errors);
      const bad = [...new Set([...res.errors.matchAll(/第 (\d+) 镜/g)].map(m => Number(m[1]) - 1))].filter(i => i >= 0 && i < plan.shots.length);
      for (const i of (bad.length ? bad : plan.shots.map((_, i) => i))) {
        const s = plan.shots[i], own = s._lines.map(id => plan.lines.find(l => l.id === id));
        plan.shots[i] = {...fallbackShot(s, own), until: s.until, _lines: s._lines};
        log(`第 ${i + 1} 镜换成兜底的关键词镜头`);
      }
    }
    writeJSON(P(dir, 'plan.json'), plan);
    (res.warns ?? []).filter(w => !/道具|props|连着|fx-/.test(w)).slice(0, 6).forEach(w => log('提醒：' + w));
    step('check', 'done', {summary: `${res.shots.length} 镜通过`});

    step('render', 'run');
    const frames = Math.ceil(tl.duration * 30);
    emit({type: 'render', frames, h: o.h, estimate: Math.round(frames * (o.h >= 1080 ? 0.13 : 0.065))});
    log(`开始渲染 ${frames} 帧（${o.h}p，竖屏）…`);
    const video = await render(dir, o.h, ln => log(ln));
    step('render', 'done');

    step('mix', 'run');
    const shots = res.shots.map((s, i) => ({...s, hero: !!plan.shots[i]?.hero}));
    const audio = await mix(dir, shots, {music: o.music, mood: moodOf(plan)});
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.mp4')) fs.rmSync(P(dir, f));   // 重新出片：换掉旧成片
    const final = P(dir, `${slug(plan.title)}.mp4`);
    await mux(video, audio, final);
    const hero = shots.find(s => s.hero) ?? shots[Math.floor(shots.length / 2)];
    await poster(video, P(dir, 'poster.jpg'), hero ? Math.max(hero.t0 + .8, hero.t1 - .25) : 2).catch(() => {});
    fs.writeFileSync(P(dir, 'sources.md'), `# ${plan.title}\n\n${plan.oneLiner}\n\n## 文案\n\n${plan.lines.map(l => l.text).join('\n')}\n\n## 来源\n\n${sources.map(s => `- [${s.title || s.url}](${s.url})`).join('\n')}\n\n## 配图出处\n\n${images.map(im => `- ${im.path} ← ${im.page}`).join('\n') || '（无）'}\n`);
    step('mix', 'done');

    const u = usage(); if (u.calls) log(costLine(u));
    const cost = u.calls ? {tokens: u.tokens, usd: u.usd, cny: u.cny, byStep: u.byStep} : null;
    const secs = Math.round((Date.now() - t0) / 1000);
    setState(dir, {status: 'done', stale: false, title: plan.title, video: path.basename(final), duration: tl.duration, h: o.h});
    emit({type: 'done', file: final, dir, title: plan.title, seconds: secs, cost});
    return {file: final, dir, plan, cost};
  } catch (e) { setState(dir, {status: 'error', error: e.message, failedPhase: 'produce'}); throw e; }
  finally { usage(); }
}

// 配乐的情绪：跌、风险、危机 → tense；其余 → bright
const moodOf = plan => /跌|崩|危|亏|裁员|战|风险|暴雷|下滑|衰退|泡沫/.test(plan.lines.map(l => l.text).join('')) ? 'tense' : 'bright';

// 一条龙（CLI 用）：建项目 → 调研写稿 → 出片
export async function makeFilm(topic, opts = {}, emit = () => {}) {
  const dir = await createProject(topic, opts);
  emit({type: 'start', dir, topic});
  if (readState(dir).status !== 'review') await planPhase(dir, emit);
  else for (const s of ['research', 'images', 'write']) emit({type: 'step', id: s, status: 'skip'});
  return producePhase(dir, emit);
}
