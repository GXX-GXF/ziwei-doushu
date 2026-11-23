// 合婚 AI 分析：前端合婚页调用的 /api/heming。
// 与 /api/interpret 同一套 SSE 格式：
// data: {"delta":{"text":"..."}}，最后 data: [DONE]。

import { NextRequest} from 'next/server';
import { streamDeepSeekChat, summarizeChart} from '@/lib/ai/deepseek';
import { cacheGet, cacheSet, cacheKey, sseFromText } from '@/lib/ai/cache';
import { consumeInterpretQuota, getClientIp, RATE_LIMIT_MESSAGE } from '@/lib/ai/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM_BASE = `你是一位精通紫微斗数倪海厦体系的命理师，擅长合婚分析。只根据下面给出的两张命盘数据分析，不要编造命盘里没有的星曜、宫位或四化。重点看双方命宫、夫妻宫、福德宫、子女宫与迁移宫的星曜配合、五行局与四化互动，讲清契合点、互补处、容易摩擦的地方，并给具体可操作的相处建议。语言直白通俗，像真人说话，不要套话和排比。涉及健康、投资只给参考方向，不下断言，不替人做决定。`;

export async function POST(req: NextRequest) {
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
return Response.json({ error: '未配置 DEEPSEEK_API_KEY'}, { status: 503});
}
const body = await req.json().catch(() => null);
if (!body?.chartA ||!body?.chartB) {
return Response.json({ error: '请求参数不完整'}, { status: 400});
}
const question =
body.question?? '请分析这两个命盘的婚配情况：契合点、互补处、容易摩擦的地方和相处建议。';
const system =
`${SYSTEM_BASE}\n\n\n${summarizeChart(body.chartA)}\n\n\n${summarizeChart(body.chartB)}`;
const cacheKeyValue = cacheKey(['heming', system, question]);
const cached = await cacheGet(cacheKeyValue);
if (cached !== null) {
console.log(`[heming] cache HIT key=${cacheKeyValue.slice(0, 12)} ip=${getClientIp(req)}`);
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
console.log(`[heming] rate limited ip=${quota.ip}`);
return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
}
console.log(`[heming] cache MISS key=${cacheKeyValue.slice(0, 12)} ip=${quota.ip} remaining=${quota.remaining}`);
return streamDeepSeekChat({
apiKey,
system,
messages: [{ role: 'user', content: question }],
onComplete: (text) => cacheSet(cacheKeyValue, text),
});
}
