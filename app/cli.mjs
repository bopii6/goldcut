#!/usr/bin/env node
// 命令行：给一个话题，出一条竖屏解读短片。
//   node app/cli.mjs "英伟达财报为什么大涨"
//   node app/cli.mjs "黄金为什么跌" --h 1080 --seconds 75 --voice zh-CN-XiaoxiaoNeural
//   node app/cli.mjs "宁德时代今年赚了多少" --format news|rank|explain --style neon|paper|breaking|mono
//   node app/cli.mjs "测试" --plan app/samples/demo.json      离线：跳过调研和编剧，直接用一份计划出片（不花钱，测渲染用）
//   node app/cli.mjs "测试" --sample rank                     离线：用 app/samples/formats.json 里某个类型的示例内容出片
import fs from 'node:fs'; import path from 'node:path';
import {makeFilm, STEPS} from './lib/pipeline.mjs';
import {FORMATS, compile} from './lib/formats.mjs';
import {STYLES} from './lib/styles.mjs';

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flags = new Set(['--h', '--seconds', '--voice', '--plan', '--out', '--brand', '--format', '--style', '--sample']);
const topic = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1])).join(' ').trim();
if (!topic) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 6).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}
const opts = {h: Number(arg('--h') ?? 720), seconds: Number(arg('--seconds') ?? 60), brand: arg('--brand') ?? ''};
if (arg('--voice')) opts.voice = arg('--voice');
if (arg('--out')) opts.dir = path.resolve(arg('--out'));
if (arg('--plan')) { const p = JSON.parse(fs.readFileSync(arg('--plan'), 'utf8')); opts.plan = p.plan ?? p; opts.images = p.images ?? []; }
if (FORMATS[arg('--format')]) opts.format = arg('--format');
if (STYLES[arg('--style')]) opts.style = arg('--style');
if (arg('--sample')) {
  const f = arg('--sample'), all = JSON.parse(fs.readFileSync(new URL('./samples/formats.json', import.meta.url), 'utf8'));
  if (!all[f]) { console.error(`没有这个示例：${f}（有 ${Object.keys(all).filter(k => k[0] !== '_').join(' / ')}）`); process.exit(1); }
  opts.format = f; opts.plan = compile(f, all[f], []); opts.images = [];
}

const name = Object.fromEntries(STEPS);
const t0 = Date.now(), el = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s`;
const res = await makeFilm(topic, opts, e => {
  if (e.type === 'start') console.log(`话题：${e.topic}\n目录：${e.dir}`);
  else if (e.type === 'step' && e.status !== 'run') console.log(`${el()} ${e.status === 'skip' ? '·' : '✓'} ${name[e.id]}${e.summary ? `（${e.summary}）` : ''}`);
  else if (e.type === 'step') console.log(`${el()} → ${name[e.id]}…`);
  else if (e.type === 'log') console.log('       ' + e.msg.replace(/\n/g, '\n       '));
  else if (e.type === 'plan') console.log(`       片名：${e.plan.title}｜${e.plan.oneLiner}`);
}).catch(e => { console.error('\n失败：' + e.message); process.exit(1); });
console.log(`\n成片：${res.file}`);
if (res.cost) console.log(`花费：约 $${res.cost.usd.toFixed(4)} ≈ ¥${res.cost.cny.toFixed(3)}（${(res.cost.tokens / 1000).toFixed(1)}k token，明细在 usage.json）`);
