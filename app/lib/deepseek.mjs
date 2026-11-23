// DeepSeek 客户端：只用 Node 自带的 fetch，不装 SDK。
// 两种用法：
//   chat({messages, json:true})            普通对话 / JSON 输出（写文案和镜头表）
//   chat({messages, webSearch:true})       联网：模型自己搜、自己开网页（deepseek_web_search，服务端执行，搜索本身不收费）
// 文档：https://api-docs.deepseek.com/guides/web_tools  https://api-docs.deepseek.com/guides/thinking_mode
import {config} from './env.mjs';

export class DeepSeekError extends Error {}

export async function chat({messages, json = false, webSearch = false, thinking = true, effort = 'high', maxTokens = 16000, timeoutMs = 600000, retries = 2, meter = null, step = 'other'}) {
  const key = config.apiKey();
  if (!key) throw new DeepSeekError('没有 DeepSeek API Key：在项目根目录的 .env 里写 DEEPSEEK_API_KEY=sk-...（或在网页界面里填）');
  const body = {
    model: config.model(),
    messages,
    max_tokens: maxTokens,
    thinking: {type: thinking ? 'enabled' : 'disabled'},
    stream: false,
  };
  if (thinking) body.reasoning_effort = effort;
  if (json) body.response_format = {type: 'json_object'};       // 联网工具不能和 JSON 输出一起用（文档写明会 400）
  if (webSearch) body.tools = [{type: 'deepseek_web_search'}];

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`${config.baseUrl()}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const text = await r.text();                                  // 非流式请求在出结果前会先发换行保活，JSON.parse 能吃掉前导空白
      let data; try { data = JSON.parse(text); } catch { throw new DeepSeekError(`DeepSeek 返回的不是 JSON（HTTP ${r.status}）：${text.slice(0, 300)}`); }
      if (data.usage) meter?.add(step, data.usage, body.model);   // 记账：生成中途失败的请求也带 usage、也收费，所以放在报错前面
      if (!r.ok || data.error) {
        const msg = data.error?.message ?? text.slice(0, 300);
        if (r.status === 401) throw Object.assign(new DeepSeekError('DeepSeek API Key 不对（401）'), {fatal: true});
        if (r.status === 402) throw Object.assign(new DeepSeekError('DeepSeek 账户余额不足（402），去 platform.deepseek.com 充值'), {fatal: true});
        if (r.status === 400) throw Object.assign(new DeepSeekError(`DeepSeek 拒绝了请求（400）：${msg}`), {fatal: true});
        throw new DeepSeekError(`DeepSeek 出错（HTTP ${r.status}）：${msg}`);
      }
      const m = data.choices?.[0]?.message ?? {};
      return {
        content: m.content ?? '',
        reasoning: m.reasoning_content ?? '',
        annotations: m.annotations ?? [],
        toolCalls: m.server_tool_calls ?? [],
        finish: data.choices?.[0]?.finish_reason,
        usage: data.usage ?? {},
      };
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new DeepSeekError(`DeepSeek 超时（${timeoutMs / 1000} 秒没回）`) : e;
      if (lastErr.fatal || attempt === retries) throw lastErr;
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    } finally { clearTimeout(timer); }
  }
  throw lastErr;
}

// 从模型回答里把 JSON 抠出来（JSON 模式一般就是纯 JSON，保险起见兼容 ```json 包裹）
export function parseJSON(s) {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new DeepSeekError('模型没有返回合法的 JSON');
}

// 联网结果里引用过的网页：sources（搜索结果）+ annotations（回答里的引用）
export function collectSources(res) {
  const seen = new Map();
  for (const step of res.toolCalls) for (const c of step.calls ?? []) {
    for (const s of c.sources ?? []) if (s.url && !seen.has(s.url)) seen.set(s.url, {url: s.url, title: s.title ?? '', site: s.site_name ?? '', date: s.published_at ?? null, cited: false});
    if (c.page?.url && !seen.has(c.page.url)) seen.set(c.page.url, {url: c.page.url, title: c.page.title ?? '', site: '', date: c.page.published_at ?? null, cited: false});
  }
  for (const a of res.annotations) {
    const u = a.url_citation?.url; if (!u) continue;
    if (!seen.has(u)) seen.set(u, {url: u, title: a.url_citation.title ?? '', site: '', date: null, cited: true});
    else seen.get(u).cited = true;
  }
  return [...seen.values()].sort((a, b) => (b.cited - a.cited));
}
