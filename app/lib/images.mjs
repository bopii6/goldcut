// 配图：从调研引用的新闻网页里取 og:image（文章的头图），下载、转成 jpg、量尺寸，太小的不要。
// 不用付费的图片搜索；拿不到图也能出片（组件会用纯色底纹）。图片版权归原网站，成片里标出处。
import fs from 'node:fs'; import path from 'node:path';
import {run} from './run.mjs';
import {chat, parseJSON} from './deepseek.mjs';
import {config, ROOT} from './env.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function get(url, ms = 10000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, {signal: ctl.signal, headers: {'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'}, redirect: 'follow'}); }
  finally { clearTimeout(t); }
}

function ogImage(html, base) {
  const metas = [...html.matchAll(/<meta\s[^>]*>/gi)].map(m => m[0]);
  for (const key of ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) {
    for (const m of metas) {
      if (!new RegExp(`(?:property|name)\\s*=\\s*["']${key}["']`, 'i').test(m)) continue;
      const c = /content\s*=\s*["']([^"']+)["']/i.exec(m)?.[1];
      if (c) { try { return new URL(c.replace(/&amp;/g, '&'), base).href; } catch {} }
    }
  }
  return null;
}

async function probe(file) {
  try {
    const out = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {quiet: true});
    const [w, h] = out.trim().split(',').map(Number); return {w, h};
  } catch { return null; }
}

export async function gatherImages(sources, filmDir, {max = 5, log = () => {}, meter = null} = {}) {
  const dir = path.join(filmDir, 'assets/img'); fs.mkdirSync(dir, {recursive: true});
  const found = [], seenImg = new Set();
  const cands = sources.filter(s => /^https?:/.test(s.url)).slice(0, 20);
  await Promise.all(cands.map(async (s, idx) => {
    try {
      const r = await get(s.url); if (!r.ok || !/html/i.test(r.headers.get('content-type') ?? '')) return;
      const html = (await r.text()).slice(0, 400000);
      const img = ogImage(html, s.url); if (!img || seenImg.has(img) || /logo|icon|avatar|default|placeholder/i.test(img)) return;
      seenImg.add(img);
      const ir = await get(img); if (!ir.ok || !/^image\//i.test(ir.headers.get('content-type') ?? '')) return;
      const buf = Buffer.from(await ir.arrayBuffer()); if (buf.length < 15000 || buf.length > 8e6) return;
      const raw = path.join(dir, `_raw${idx}`); fs.writeFileSync(raw, buf);
      const jpg = path.join(dir, `src${idx}.jpg`);
      await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-frames:v', '1', '-vf', "scale='min(1600,iw)':-2", '-q:v', '3', jpg], {quiet: true});
      fs.rmSync(raw, {force: true});
      const d = await probe(jpg); if (!d || d.w < 500 || d.h < 280) { fs.rmSync(jpg, {force: true}); return; }
      const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? s.title ?? '').trim().slice(0, 60);
      found.push({idx, path: `assets/img/src${idx}.jpg`, w: d.w, h: d.h, title: title || s.title, site: s.site || new URL(s.url).hostname, page: s.url, image: img});
    } catch {}
  }));
  found.sort((a, b) => a.idx - b.idx);
  const pool = found.slice(0, 8);
  for (const f of found.slice(8)) fs.rmSync(path.join(filmDir, f.path), {force: true});
  // 网页头图里很多是网站 logo、广告横幅、截图：垫在背景上就是满屏水印。先让 DeepSeek 看一眼，只留照片和像样的插图
  let keep;
  try { keep = await visionFilter(pool, filmDir, meter); log(`配图：${pool.length} 张头图里，DeepSeek 看过留下 ${keep.length} 张照片/插图（去掉 logo、横幅、截图）`); }
  catch (e) { keep = await pixelFilter(pool, filmDir); log(`配图：看图没成功（${e.message.slice(0, 60)}），按像素粗筛留下 ${keep.length} 张`); }
  keep = keep.slice(0, max);
  const kept = new Set(keep.map(k => k.path));
  for (const f of pool) if (!kept.has(f.path)) fs.rmSync(path.join(filmDir, f.path), {force: true});
  return keep;
}

export async function visionFilter(pool, filmDir, meter) {
  if (!pool.length) return [];
  const content = [{type: 'text', text: `下面 ${pool.length} 张图是新闻网页的头图，要给一条财经/科技短视频当配图。逐张判断，输出 JSON：
{"images":[{"i":1,"kind":"photo|illustration|logo|banner|screenshot|chart|text|ad","desc":"图里是什么（12 字以内，具体到人/公司/物）","usable":true}]}
usable 只有真实照片（photo）和不带大段文字的插图（illustration）才是 true；网站 logo、广告、二维码、带标题字的横幅、网页或社交媒体截图、纯文字图一律 false。`}];
  pool.forEach((im, k) => {
    content.push({type: 'text', text: `图${k + 1}：`});
    content.push({type: 'image_url', image_url: {url: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(filmDir, im.path)).toString('base64')}});
  });
  const res = await chat({messages: [{role: 'user', content}], json: true, thinking: false, maxTokens: 1500, meter, step: 'images', retries: 1, timeoutMs: 120000});
  const out = parseJSON(res.content).images ?? [];
  return pool.map((im, k) => ({im, v: out.find(o => Number(o.i) === k + 1)})).filter(x => x.v?.usable === true)
    .map(({im, v}) => ({...im, kind: v.kind, desc: String(v.desc ?? '').slice(0, 30)}));
}

async function pixelFilter(pool, filmDir) {
  if (!pool.length) return [];
  const out = await run(config.python(), [path.join(ROOT, 'app/lib/imgscore.py'), ...pool.map(im => path.join(filmDir, im.path))], {quiet: true});
  const score = out.trim().split(/\r?\n/).map(l => JSON.parse(l));
  return pool.filter((im, k) => (score[k]?.uniform ?? 1) < 0.35);
}
