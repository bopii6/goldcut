// 第三步：把计划变成一条片子：建工程（复用 scripts/new_film.mjs）→ script.json + film.js → 配音 → 检查 → 渲染 → 混音 → 合成 mp4。
import fs from 'node:fs'; import path from 'node:path';
import {ROOT, config} from './env.mjs';
import {run} from './run.mjs';
import {styleOf} from './styles.mjs';

const S = f => path.join(ROOT, 'scripts', f);

// 字体：kit.css 要的字体文件不随仓库给。有就用，没有就退到 Windows / macOS 自带的字体，不让 404 把渲染卡死。
const FONT_FALLBACK = {
  Num: "local('Bebas Neue'),local('BebasNeue-Regular'),local('Bahnschrift SemiBold Condensed'),local('Impact')",
  Shu: "local('Alimama ShuHeiTi Bold'),local('AlimamaShuHeiTi-Bold'),local('Microsoft YaHei Bold'),local('PingFang SC Semibold'),local('SimHei')",
  Mi: "local('MiSans'),local('Microsoft YaHei'),local('PingFang SC'),local('Noto Sans SC')",
  Mont: "local('Montserrat'),local('Segoe UI'),local('Helvetica Neue')",
};
export function patchFonts(dir) {
  const css = path.join(dir, 'lib/kit.css'); let c = fs.readFileSync(css, 'utf8');
  c = c.replace(/@font-face\{font-family:(\w+);src:([^;}]+)/g, (m, fam, src) => {
    const ok = [...src.matchAll(/url\(([^)]+)\)/g)].map(x => x[1]).filter(u => fs.existsSync(path.join(dir, 'lib', u)));
    return `@font-face{font-family:${fam};src:${[...ok.map(u => `url(${u})`), FONT_FALLBACK[fam] ?? "local('Microsoft YaHei')"].join(',')}`;
  });
  fs.writeFileSync(css, c);
}

export async function scaffold(dir) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`片子目录已存在：${dir}`);
  await run(process.execPath, [S('new_film.mjs'), dir, '--vertical'], {quiet: true});
  patchFonts(dir);
  // 本机 Edge 渲染时会去要 /favicon.ico，404 会被 render.mjs 当成页面报错：给一个空图标
  const ix = path.join(dir, 'index.html');
  fs.writeFileSync(ix, fs.readFileSync(ix, 'utf8').replace('<head>', '<head><link rel="icon" href="data:,">'));
  addFormatKit(dir);
}

// 三种视频类型的专用镜头（kit/fmt.js、fmt.css）：拷进片子的 lib/，页面里接在 vpro 后面。老项目重新出片时也补上
export function addFormatKit(dir) {
  for (const f of ['fmt.js', 'fmt.css']) fs.copyFileSync(path.join(ROOT, 'kit', f), path.join(dir, 'lib', f));
  const ix = path.join(dir, 'index.html'); let h = fs.readFileSync(ix, 'utf8');
  if (!h.includes('lib/fmt.js')) h = h.replace('<script src="lib/vpro.js"></script>', '<script src="lib/vpro.js"></script><script src="lib/fmt.js"></script>')
    .replace('<link rel="stylesheet" href="lib/vpro.css">', '<link rel="stylesheet" href="lib/vpro.css"><link rel="stylesheet" href="lib/fmt.css">');
  fs.writeFileSync(ix, h);
}

export const END_LEN = 2.6;   // 片尾卡停几秒（时间线里的 title 位置，配乐在这里抬起来）
export function writeScript(dir, plan, {voice, rate = '+5%', endCard = true} = {}) {
  const S = {voice: voice ?? config.voice(), rate, pre: 0.3, lines: plan.lines.map((l, i) => ({id: l.id, text: l.text, gap: i === plan.lines.length - 1 ? 0.6 : 0.3}))};
  if (endCard) S.title = {after: plan.lines.at(-1).id, len: END_LEN};
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(S, null, 1));
}

// 风格：颜色变量交给 KIT_VPRO.theme，样式层追加到 film.css（starter 原本的那份 + 风格的）
const BASE_CSS = fs.readFileSync(path.join(ROOT, 'starter-v/film.css'), 'utf8');
export function writeFilm(dir, plan, {bg = null, brand = '', endCard = true, style = 'night'} = {}) {
  addFormatKit(dir);
  const st = styleOf(style);
  fs.writeFileSync(path.join(dir, 'film.css'), BASE_CSS + (st.css ? `\n/* ---- 风格：${st.name} ---- */${st.css}\n` : ''));
  const theme = {...st.theme, accent: st.theme.accent ?? plan.accent, ...(bg ? {bg} : {})};
  for (const k of Object.keys(theme)) if (theme[k] == null) delete theme[k];
  plan = {...plan, pattern: st.pattern ?? plan.pattern, _theme: theme};
  const shots = plan.shots.map(s => {
    const o = {}; for (const [k, v] of Object.entries(s)) if (k[0] !== '_' && v !== undefined) o[k] = v; return o;
  });
  if (endCard) {                     // 片尾卡：片名 + 栏目名，停在最后一句之后
    shots.at(-1).until = '@title';
    shots.push({scene: 'vp-chapter', says: '片尾：片名', no: brand || 'END', title: plan.title.slice(0, 10), en: '数据来源见简介', ...(bg ? {bg} : {})});
  }
  const js = `// 自动生成：goldcut app（DeepSeek 写的文案和镜头表）。片名：${plan.title.replace(/\n/g, ' ')}
// 想手改：改下面的镜头表，再跑 node scripts/render.mjs --dir . --check
window.ready=(async()=>{
const F=await FB.init({counts:['assets/clips/counts.json'],fonts:KIT.FONTS,subMax:12});
const K=await KIT.use(F);
await KIT_VERT.use(K,{skin:'dark',pattern:${JSON.stringify(plan.pattern)},brand:${JSON.stringify(brand)}});
KIT_VPRO.theme(${JSON.stringify(plan._theme)});
await K.film(${JSON.stringify(shots, null, 1)});
return K.go();
})();
`;
  fs.writeFileSync(path.join(dir, 'film.js'), js);
}

// 配音：edge-tts（免费），顺带出逐字时间线 timeline.json
export async function voiceOver(dir, onLine) {
  await run(config.python(), [S('temp_voice.py'), path.join(dir, 'script.json'), '--redo'], {onLine});
  return JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
}

// 检查镜头表：返回 {ok, errors, warns, shots}
export async function check(dir) {
  try {
    const out = await run(process.execPath, [S('render.mjs'), '--dir', dir, '--check'], {quiet: true});
    const r = JSON.parse(fs.readFileSync(path.join(dir, 'out/check.json'), 'utf8'));
    return {ok: true, warns: r.warns, shots: r.shots, out};
  } catch (e) {
    const text = (e.err || '') + '\n' + (e.out || '');
    return {ok: false, errors: text.trim() || e.message};
  }
}

export async function render(dir, h, onLine) {
  await run(process.execPath, [S('render.mjs'), '--dir', dir, '--video', '--h', String(h), '--workers', String(Math.max(1, Math.min(4, Number(process.env.GOLDCUT_WORKERS ?? 2))))], {onLine});
  return path.join(dir, 'out', `visual_${h}.mp4`);
}

// 配乐：music = 'auto'（按内容挑内置的 tense / bright）、'tense'、'bright'、'none'，或 music/ 文件夹里的文件名（自己的音乐）
export const MUSIC_DIR = path.join(ROOT, 'music');
export function listMusic() { try { return fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f)); } catch { return []; } }
async function musicFile(music, mood) {
  if (music === 'none') return null;
  if (music && !['auto', 'tense', 'bright'].includes(music)) { const f = path.join(MUSIC_DIR, path.basename(music)); if (fs.existsSync(f)) return f; }
  const m = music === 'tense' || music === 'bright' ? music : mood;
  const f = path.join(config.filmsDir(), '_music', `bed_${m}.wav`);
  if (!fs.existsSync(f)) { fs.mkdirSync(path.dirname(f), {recursive: true}); await run(config.python(), [path.join(ROOT, 'app/lib/bed.py'), f, m], {quiet: true}); }
  return f;
}

// 音效：合成的软风声（每次换镜）+ 最重的一镜一声低沉撞击；配乐被人声自动压低（sidechain）
export async function mix(dir, shots, {music = 'auto', mood = 'bright'} = {}) {
  const sfxDir = path.join(config.filmsDir(), '_sfx');
  if (!fs.existsSync(path.join(sfxDir, 'impact_low.wav'))) await run(config.python(), [S('sfx_synth.py'), sfxDir], {quiet: true});
  const events = [];
  shots.forEach((s, i) => {
    if (i > 0) events.push({file: 'whoosh_soft.wav', t: Math.max(0, s.t0 - 0.12), peak: -27});
    if (s.hero) events.push({file: 'impact_low.wav', t: s.t0 + 0.05, peak: -15, len: 1.2});
  });
  const sfx = {dir: path.relative(dir, sfxDir).replace(/\\/g, '/'), events};
  const bed = await musicFile(music, mood);
  if (bed) sfx.bed = {file: path.relative(sfxDir, bed).replace(/\\/g, '/'), gain: -17, from_pre: true, lift_title: 2.2, fade_in: 1.2};
  fs.writeFileSync(path.join(dir, 'sfx.json'), JSON.stringify(sfx, null, 1));
  await run(config.python(), [S('mix.py'), dir], {quiet: true});
  return path.join(dir, 'mix_master.wav');
}

// 封面：从成片里截一帧
export async function poster(video, out, t) {
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, t)), '-i', video, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', out], {quiet: true});
  return out;
}

export async function mux(video, audio, outFile) {
  await run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile], {quiet: true});
  return outFile;
}
