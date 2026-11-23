// 第一步：调研。用 DeepSeek 的深度思考搜索（deepseek_web_search + thinking），模型自己搜、开网页、核对数字。
// 搜索是服务端工具，不按次收费，只算 token。
import {chat, collectSources} from './deepseek.mjs';

const today = () => new Date().toISOString().slice(0, 10);

export async function research(topic, log = () => {}, meter = null, focus = '') {
  const prompt = `今天是 ${today()}。我要做一条 60 秒左右的中文财经/科技解读竖屏短视频，话题是：

「${topic}」

请联网查清这件事，优先看最近的、权威的来源（官方公告、财报、主流媒体、统计机构）。
${focus}
用中文输出一份调研简报，格式如下：

## 一句话
观众看完能转述给别人的那一句结论。

## 来龙去脉
按时间顺序 4–8 条，每条带日期。

## 关键数字
6–12 个，每个写清：数字 + 单位 + 指什么 + 时间 + 出处网址。只写查到的，查不到的不要编。如果有能画走势的一串数（比如连续几年/几个月的数值），单独列出来，标明每个点的时间。

## 各方说法
当事人、官方、分析师的原话或立场，标出处。

## 反常识的点 / 钩子
这件事最反直觉、最能抓住人的 1–3 个点。

## 来源
用到的网址列表。`;
  log('联网调研中（DeepSeek 深度搜索，通常 1–3 分钟）…');
  const res = await chat({messages: [{role: 'user', content: prompt}], webSearch: true, thinking: true, effort: 'high', maxTokens: 12000, meter, step: 'research'});
  const sources = collectSources(res);
  const searches = res.toolCalls.reduce((n, s) => n + (s.calls?.length ?? 0), 0);
  log(`调研完成：模型调用了 ${searches} 次搜索/读网页，拿到 ${sources.length} 个来源`);
  if (!res.content.trim()) throw new Error('调研没有返回内容（可能被内容审核拦了），换个说法再试');
  return {brief: res.content, sources, usage: res.usage};
}
