// Minimal DeepSeek (OpenAI-compatible) streaming client for the chart
// interpretation routes. The frontend reads SSE lines shaped as
// data: {"delta":{"text":"..."}} and ends on data: [DONE].
// DeepSeek answers in the OpenAI SSE shape, so this translates each
// choices[0].delta.content chunk into the shape the panels expect.

import type { ZiweiChart } from '@/lib/ziwei/types';

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

export function summarizeChart(chart: ZiweiChart): string {
  const lines: string[] = [];
  const b = chart.birthInfo;
  if (b) {
    const hourBranch = BRANCHES[b.hour] ?? '';
    lines.push(
      `出生：公历${b.year}年${b.month}月${b.day}日 ${hourBranch}时，${b.gender === 'male' ? '男' : '女'}${b.city ? `，出生地${b.province ?? ''}${b.city}` : ''}`
    );
  }
  const lunar = chart.lunarInfo;
  if (lunar) {
    lines.push(
      `农历：${lunar.lunarYear}年${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)}月${lunar.lunarDay}日，四柱 ${lunar.fourPillars?.join(' ') ?? ''}`
    );
  }
  const daxian = chart.daXians?.[chart.currentDaXianIndex];
  lines.push(
    `命宫：${BRANCHES[chart.mingGongBranch]}宫，身宫：${BRANCHES[chart.shenGongBranch]}宫，五行局：${chart.wuxingJuName}，命主：${chart.mingZhu ?? '未标'}，身主：${chart.shenZhu ?? '未标'}，${chart.yinYangGender ?? ''}，现年 ${chart.currentAge} 岁` +
      (daxian ? `，当前大限 ${daxian.startAge}-${daxian.endAge} 岁在${daxian.palaceName}` : '')
  );
  for (const p of chart.palaces ?? []) {
    const stars = (p.stars ?? [])
      .map((s) => `${s.name}${s.siHua ? `化${s.siHua}` : ''}${s.brightnessRaw ? `(${s.brightnessRaw})` : ''}`)
      .join('、');
    const self = (p.selfSihua ?? []).map((m) => `${m.starName}自化${m.siHua}`).join('、');
    const stem = p.stem !== undefined ? STEMS[p.stem] : '';
    const empty = p.isEmpty
      ? `（空宫，借对宫${p.borrowedFromName ?? ''}主星：${(p.borrowedStars ?? []).join('、')}）`
      : '';
    lines.push(`${p.name}宫（${stem}${BRANCHES[p.branch]}）：${stars || '无主星'}${empty}${self ? `；${self}` : ''}`);
  }
  return lines.join('\n');
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function streamDeepSeekChat(opts: {
  apiKey: string;
  system: string;
  messages: ChatMessage[];
  onComplete?: (text: string) => void | Promise<void>;
}): Promise<Response> {
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return Response.json(
      { error: `AI 服务请求失败（${upstream.status}）`, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      let fullText = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content: string = parsed.choices?.[0]?.delta?.content ?? '';
              if (content) {
                fullText += content;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta: { text: content } })}\n\n`)
                );
              }
            } catch {
              // skip partial lines
            }
          }
        }
        if (fullText) {
          try {
            await opts.onComplete?.(fullText);
          } catch {
            // 写缓存失败也不打断流
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Cache': 'MISS',
      Connection: 'keep-alive',
    },
  });
}
