// 用量和花费：每次调 DeepSeek 都记一笔（哪一步、token 数、按调用时刻算高峰/错峰价）。
// 价格（美元 / 百万 token）抄自 https://api-docs.deepseek.com/quick_start/pricing（2026-11-23）。官方会调价：变了改这里，或在 .env 里覆盖。
// 联网搜索（deepseek_web_search）2026-11-18 起不按次收费，搜回来的内容算进输入 token，已经包含在下面的数里。
import {config} from './env.mjs';

const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; };
export const PRICES = {
  'deepseek-flash': {hit: [0.003, 0.006], miss: [0.15, 0.3], out: [0.6, 1.2]},     // [错峰, 高峰]
  'deepseek-v4-pro': {hit: [0.022, 0.044], miss: [0.66, 1.32], out: [1.98, 3.96]},
};

// 高峰：周一到周五 UTC 01:00–04:00、06:00–10:00（中国法定节假日全天错峰，这里不认节假日，按高峰算会略高估）
export function isPeak(d = new Date()) {
  const day = d.getUTCDay(), h = d.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}

export function priceOf(model, peak) {
  const p = PRICES[model] ?? PRICES['deepseek-flash'], i = peak ? 1 : 0;
  return {hit: num('PRICE_CACHE_HIT', p.hit[i]), miss: num('PRICE_CACHE_MISS', p.miss[i]), out: num('PRICE_OUTPUT', p.out[i])};
}

export class Meter {
  constructor(calls = []) { this.calls = [...calls]; }        // 传入 usage.json 里已有的记录，同一个项目分几次做也能累计
  add(step, usage = {}, model = config.model(), when = new Date()) {
    const prompt = usage.prompt_tokens ?? 0;
    const hit = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
    const miss = usage.prompt_cache_miss_tokens ?? Math.max(0, prompt - hit);
    const out = usage.completion_tokens ?? 0, think = usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const peak = isPeak(when), pr = priceOf(model, peak);
    const usd = (hit * pr.hit + miss * pr.miss + out * pr.out) / 1e6;
    const st = usage.server_tool_use ?? {};
    this.calls.push({step, model, at: when.toISOString(), peak, hit, miss, out, think, searches: (st.tool_search ?? 0) + (st.tool_fetch ?? 0), usd});
  }
  summary() {
    const s = {calls: this.calls.length, hit: 0, miss: 0, out: 0, think: 0, usd: 0, byStep: {}};
    for (const c of this.calls) {
      for (const k of ['hit', 'miss', 'out', 'think', 'usd']) s[k] += c[k];
      const b = s.byStep[c.step] ??= {tokens: 0, usd: 0, calls: 0};
      b.tokens += c.hit + c.miss + c.out; b.usd += c.usd; b.calls++;
    }
    s.tokens = s.hit + s.miss + s.out;
    s.cnyRate = num('GOLDCUT_CNY_RATE', 7.1);       // 美元换人民币只是估个数，汇率自己在 .env 里改
    s.cny = s.usd * s.cnyRate;
    s.calls_detail = this.calls;
    return s;
  }
}

const STEP_NAME = {research: '调研', images: '看图', write: '写稿', repair: '修镜头表', rewrite: '重写单镜'};
export function costLine(s) {
  const steps = Object.entries(s.byStep).map(([k, v]) => `${STEP_NAME[k] ?? k} ${(v.tokens / 1000).toFixed(1)}k`).join('，');
  return `DeepSeek 用量 ${(s.tokens / 1000).toFixed(1)}k token（${steps}），约 $${s.usd.toFixed(4)} ≈ ¥${s.cny.toFixed(3)}`;
}
