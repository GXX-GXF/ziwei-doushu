// AI 命盘解读：前端 ChatPanel / InsightPanel 调用的 /api/interpret。
// 开源版不含此路由，这里用 DeepSeek（OpenAI 兼容协议）实现，
// 以 SSE 流回前端：data: {"delta":{"text":"..."}}，最后 data: [DONE]。

import { NextRequest} from 'next/server';
import { streamDeepSeekChat, summarizeChart} from '@/lib/ai/deepseek';
import { cacheGet, cacheSet, cacheKey, sseFromText } from '@/lib/ai/cache';
import { consumeInterpretQuota, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/ai/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM_BASE = `你是一位精通紫微斗数倪海厦体系的命理师。只根据下面给出的命盘数据解读，不要编造命盘里没有的星曜、宫位或四化，也不要把别的命理体系混进来。语言直白通俗，像真人说话，不要套话和排比。涉及健康、投资只给参考方向，不下断言，不替人做决定。按用户的问题回答，结构清晰，重点突出，篇幅适中。`;

export async function POST(req: NextRequest) {
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
return Response.json({ error: '未配置 DEEPSEEK_API_KEY'}, { status: 503});
}
const body = await req.json().catch(() => null);
if (!body?.chart ||!Array.isArray(body.messages)) {
return Response.json({ error: '请求参数不完整'}, { status: 400});
}
const system = `${SYSTEM_BASE}\n\n\n${summarizeChart(body.chart)}`;
const cacheKeyValue = cacheKey(['interpret', system, JSON.stringify(body.messages)]);
const cached = await cacheGet(cacheKeyValue);
if (cached !== null) {
console.log(`[interpret] cache HIT key=${cacheKeyValue.slice(0, 12)} ip=${getClientIp(req)}`);
return new Response(sseFromText(cached), {
headers: {
'Content-Type': 'text/event-stream',
'Cache-Control': 'no-cache, no-transform',
Connection: 'keep-alive',
'X-Cache': 'HIT',
},
});
}
const quota = await consumeInterpretQuota(req);
if (!quota.allowed) {
console.log(`[interpret] rate limited ip=${quota.ip}`);
return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
}
console.log(`[interpret] cache MISS key=${cacheKeyValue.slice(0, 12)} ip=${quota.ip} remaining=${quota.remaining}`);
return streamDeepSeekChat({
apiKey,
system,
messages: body.messages,
onComplete: (text) => cacheSet(cacheKeyValue, text),
});
}
