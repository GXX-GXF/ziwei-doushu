'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean; // don't show user bubble for auto/topic messages
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  palaceNonce?: number;
}

const TOPICS = [
  { key: 'overview',     label: '命格' },
  { key: 'love',        label: '感情' },
  { key: 'career',      label: '事业' },
  { key: 'wealth',      label: '财运' },
  { key: 'health',      label: '健康' },
  { key: 'personality', label: '性格' },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `请生成命格总览，按以下结构输出：

**【命格定性】**
用一句话概括这个命盘的核心格局与命主气质。

**【主星解读】**
命宫主星的核心特质，引用倪海厦原话或观点。

**【三方四正】**
财、官、迁三宫的联动分析及整体格局。

**【当前大限】**
当下大限运势方向与最值得关注的事项。

**【优势与注意】**
命盘天赋优势，以及需要注意的风险或功课。`,

  love: `请深度分析感情婚姻运，按以下结构输出：

**【感情格局】**
一句话定性感情命格。

**【夫妻宫分析】**
夫妻宫主星、四化，以及倪海厦体系的具体解读。

**【三方联动】**
相关宫位对感情的影响。

**【当前大限感情运】**
当下10年感情走向与关键节点。

**【实际建议】**
具体可行的感情建议。`,

  career: `请深度分析事业运，按以下结构输出：

**【事业格局】**
一句话定性事业命格，宜任职或宜创业。

**【官禄宫分析】**
官禄宫主星、四化，以及倪师对这种配置的判断。

**【财帛宫联动】**
财运与事业的关系，财路来源分析。

**【当前大限事业运】**
当下10年事业走向。

**【实际建议】**
适合的方向、行业与策略。`,

  wealth: `请深度分析财运，按以下结构输出：

**【财运格局】**
一句话定性财运模式，是主动财还是被动财。

**【财帛宫分析】**
财帛宫主星、四化，财富来源与流动模式。

**【田宅宫（财库）】**
积蓄能力与不动产运势分析。

**【当前大限财运】**
当下财运走向与注意事项。

**【理财建议】**
具体的财务建议。`,

  health: `请分析健康运势，按以下结构输出：

**【疾厄宫主星】**
疾厄宫星曜与健康含义。

**【主要风险】**
结合倪海厦子午流注理论，分析主要健康隐患与需关注的部位。

**【大限健康走势】**
当下健康趋势与关键时间段。

**【预防建议】**
具体注意事项与养生方向。`,

  personality: `请深度解析性格特质，按以下结构输出：

**【命宫主星性格】**
命宫主星的核心性格特质，引用倪师原话。

**【三方性格综合】**
财、官、迁三宫对性格的影响，全貌描绘。

**【人际关系模式】**
与他人互动方式、待人处世风格。

**【优势与人生课题】**
天赋优势，以及需要面对的人生功课。`,
};

const PALACE_ROLES: Record<string, string> = {
  '命宫':   '自我、性格、先天格局',
  '兄弟宫': '兄弟关系、合伙人',
  '夫妻宫': '感情关系、婚姻状态',
  '子女宫': '子女缘分、下属关系',
  '财帛宫': '财运来源、收入方式',
  '疾厄宫': '身体健康、意外',
  '迁移宫': '外出机遇、人际格局',
  '交友宫': '朋友圈、贵人、小人',
  '官禄宫': '事业成就、社会地位',
  '田宅宫': '不动产、家庭环境',
  '福德宫': '精神享受、内心福分',
  '父母宫': '父母关系、文书契约',
};

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[13px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({ chart, selectedPalace, selectedSiHua, palaceNonce }: InsightPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('overview');
  // 每个上下文（话题 / 宫位 / 四化）各自保存一份对话；切换只换显示，不调接口
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [activeKey, setActiveKey] = useState<string>('topic:overview');
  const threadsRef = useRef<Record<string, Message[]>>({}); // always-current copy for closures
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0); // 生成序号：旧流的 finally 不得误关新流
  const genKeyRef = useRef<string>('topic:overview'); // 正在生成的上下文
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // 当前上下文的消息列表
  const messages = threads[activeKey] ?? [];

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);


  // 宫格点击：只切换解读区上下文，不调接口；已有文字直接显示，没有就显示生成按钮
  useEffect(() => {
    if (!selectedPalace) return;
    setActiveKey(`palace:${selectedPalace.branch}`);
    setActiveTopic('');
  }, [selectedPalace, palaceNonce]);

  // 四化点击：只切换解读区上下文，不调接口
  useEffect(() => {
    if (!selectedSiHua) return;
    setActiveKey(`sihua:${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`);
    setActiveTopic('');
  }, [selectedSiHua]);

  // 按上下文 key 生成对应的解读 prompt（与此前自动注入的 prompt 文本完全一致）
  const buildPalacePrompt = (palace: Palace): string => {
    const majorStars = palace.stars.filter(s => s.type === 'major');
    const starDesc = majorStars.length > 0
      ? majorStars.map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`).join('、')
      : '空宫（借对宫）';
    const role = PALACE_ROLES[palace.name] ?? '';
    return `请重点分析【${palace.name}】（主管：${role}），该宫主星为${starDesc}，按以下结构输出：

**【宫位定性】**
${palace.name}在命盘中的意义，以及这种星曜配置的整体判断。

**【主星解读】**
主星在此宫的倪海厦体系解读，引用具体观点。

**【三方四正联动】**
三方四正宫位对此宫的影响。

**【实际建议】**
基于此宫的具体建议。`;
  };

  const buildSiHuaPrompt = (starName: string, siHua: string, view: TimeView): string => {
    const palaceOfStar = chart.palaces.find(p =>
      p.stars.some(s => s.name === starName)
    );
    const palaceName = palaceOfStar?.name ?? '未知宫位';
    const viewLabel = view === 'daxian' ? '大限' : '流年';
    return `请分析【${viewLabel}${starName}化${siHua}】的飞化影响，按以下结构输出：

**【化${siHua}基本含义】**
化${siHua}在倪海厦体系中的核心含义，以及${starName}化${siHua}的特殊含义。

**【落宫影响】**
${starName}化${siHua}落在【${palaceName}】，该宫主管的领域受到何种影响，倪师如何解读。

**【三方四正飞化路径】**
化${siHua}入${palaceName}后，对其三方四正（对宫、两个三合宫）的联动影响。

**【当前运势影响】**
在${viewLabel}时间维度下，此化${siHua}对命主近期运势的具体影响。

**【实际建议】**
基于此四化的具体可操作建议。`;
  };

  // 当前上下文的生成 prompt；null 表示该上下文不可生成
  const buildCtxPrompt = (key: string): string | null => {
    if (key.startsWith('topic:')) {
      return TOPIC_PROMPTS[key.slice(6)] ?? null;
    }
    if (key.startsWith('palace:')) {
      const palace = chart.palaces.find(p => p.branch === Number(key.slice(7)));
      return palace ? buildPalacePrompt(palace) : null;
    }
    if (key.startsWith('sihua:')) {
      const parts = key.slice(6).split('-');
      if (parts.length !== 3) return null;
      return buildSiHuaPrompt(parts[0], parts[1], parts[2] as TimeView);
    }
    return null;
  };

  // 当前上下文的本地信息（全部取自已算出的命盘，不调接口）
  const ctxLocal = (() => {
    if (activeKey.startsWith('palace:')) {
      const palace = chart.palaces.find(p => p.branch === Number(activeKey.slice(7)));
      if (!palace) return null;
      const majorStars = palace.stars.filter(s => s.type === 'major');
      const starDesc = majorStars.length > 0
        ? majorStars.map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`).join('、')
        : '空宫（借对宫）';
      return {
        title: palace.name,
        sub: PALACE_ROLES[palace.name] ?? PALACE_ROLES[`${palace.name}宫`] ?? '',
        lines: [`主星：${starDesc}`],
        hint: `点下方按钮生成【${palace.name}】解读`,
      };
    }
    if (activeKey.startsWith('sihua:')) {
      const parts = activeKey.slice(6).split('-');
      if (parts.length !== 3) return null;
      const [starName, siHua, view] = parts;
      const palaceOfStar = chart.palaces.find(p => p.stars.some(s => s.name === starName));
      const viewLabel = view === 'daxian' ? '大限' : '流年';
      return {
        title: `${viewLabel}${starName}化${siHua}`,
        sub: `落宫：${palaceOfStar?.name ?? '未知宫位'}`,
        lines: [] as string[],
        hint: `点下方按钮生成【${viewLabel}${starName}化${siHua}】解读`,
      };
    }
    const topic = TOPICS.find(t => `topic:${t.key}` === activeKey);
    return {
      title: null as string | null,
      sub: '',
      lines: [] as string[],
      hint: `点下方按钮生成「${topic?.label ?? '命格'}」解读，也可以直接点上方话题或在下方追问`,
    };
  })();

  const streamResponse = async (apiMessages: { role: 'user' | 'assistant'; content: string }[], signal?: AbortSignal, key?: string) => {
    const gen = genRef.current;
    const targetKey = key ?? genKeyRef.current;
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, messages: apiMessages }),
        signal,
      });
      if (res.status === 404) throw new Error('api-missing');
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { error?: string } | null)?.error ?? '今日解读次数已用完，明天再来');
      }
      if (!res.ok) throw new Error('请求失败');
      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      setThreads(prev => ({ ...prev, [targetKey]: [...(prev[targetKey] ?? []), { role: 'assistant', content: '' }] }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const delta = JSON.parse(data).delta?.text ?? '';
            assistantText += delta;
            setThreads(prev => {
              const updated = [...(prev[targetKey] ?? [])];
              updated[updated.length - 1] = { role: 'assistant', content: assistantText };
              return { ...prev, [targetKey]: updated };
            });
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      // 被新话题/追问打断：静默结束，不追加错误提示
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        /* 打断 */
      } else {
        const missing = e instanceof Error && e.message === 'api-missing';
        const limitedMsg = e instanceof Error && e.message.includes('今日解读次数已用完') ? e.message : null;
        setThreads(prev => ({ ...prev, [targetKey]: [...(prev[targetKey] ?? []), { role: 'assistant', content: missing ? '开源版不含 AI 解读接口（/api/interpret），需要你自己实现后才能用，详见 README「快速开始」。排盘本身不需要任何 API Key。' : limitedMsg ?? '解读失败，请稍后重试。' }] }));
      }
    } finally {
      // 只有最新一次生成才放开 loading，避免旧流的 finally 误关新流
      if (genRef.current === gen) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const sendMessage = (text: string, hidden = false, key: string = activeKey) => {
    if (!text.trim()) return;
    // 生成中点新话题/追问：打断上一条流（只改 UI 层，不动接口与解读逻辑）
    if (loadingRef.current) {
      abortRef.current?.abort();
      genRef.current += 1;
      const prevKey = genKeyRef.current;
      setThreads(prev => {
        const list = prev[prevKey] ?? [];
        const last = list[list.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          return { ...prev, [prevKey]: list.slice(0, -1) };
        }
        return prev;
      });
      loadingRef.current = false;
      setLoading(false);
    }
    genRef.current += 1;
    genKeyRef.current = key;
    const controller = new AbortController();
    abortRef.current = controller;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text, hidden };
    // Capture current messages synchronously via ref (avoids stale closure)
    const apiMessages = [...(threadsRef.current[key] ?? []), userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setThreads(prev => ({ ...prev, [key]: [...(prev[key] ?? []), userMsg] }));
    setInput('');
    streamResponse(apiMessages, controller.signal, key);
  };

  // 切换话题只换显示：已有文字直接显示，没有就显示生成按钮，不调接口
  const handleTopicClick = (topicKey: string) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    setActiveKey(`topic:${topicKey}`);
  };

  // “生成解读”：只对当前上下文调一次接口
  const handleGenerate = () => {
    if (loadingRef.current) return;
    const prompt = buildCtxPrompt(activeKey);
    if (!prompt) return;
    sendMessage(prompt, true, activeKey);
  };

  const handleSend = () => {
    sendMessage(input, false, activeKey);
  };

  return (
    <div className="flex flex-col insight-panel rounded-xl overflow-hidden card-glass">

      {/* ── Topic buttons ── */}
      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-6 gap-1">
          {TOPICS.map(t => {
            const isActive = activeTopic === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTopicClick(t.key)}
                className="py-1.5 text-[12px] font-medium rounded-lg transition-all duration-150"
                style={{
                  background: isActive ? 'color-mix(in srgb, var(--ac) 12%, transparent)' : 'transparent',
                  border: `1px solid ${isActive ? 'color-mix(in srgb, var(--ac) 30%, transparent)' : 'var(--t-border)'}`,
                  color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {loading && (
          <div className="mt-1.5 text-[12px] text-center" style={{ color: 'var(--t-faint)' }}>
            ✦ 生成中…
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="insight-scroll flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Loading state before first message */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
            <div className="text-4xl" style={{ color: 'var(--t-gold)', opacity: 0.15 }}>✦</div>
            {ctxLocal?.title && (
              <div>
                <div className="text-[15px] font-medium" style={{ color: 'var(--t-gold)' }}>{ctxLocal.title}</div>
                {ctxLocal.sub && (
                  <div className="text-[12px] mt-1" style={{ color: 'var(--t-faint)' }}>{ctxLocal.sub}</div>
                )}
                {ctxLocal.lines.map((l, i) => (
                  <div key={i} className="text-[13px] mt-1" style={{ color: 'var(--t-text2)' }}>{l}</div>
                ))}
              </div>
            )}
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>{ctxLocal?.hint ?? '点下方按钮生成解读'}</p>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-5 py-2.5 rounded-xl text-[14px] font-medium transition-all"
              style={{
                background: 'color-mix(in srgb, var(--ac) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--ac) 35%, transparent)',
                color: 'var(--t-gold)',
              }}
            >
              ✦ 生成解读
            </button>
          </div>
        )}
        {messages.length === 0 && loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
            <p className="text-[12px] animate-pulse" style={{ color: 'var(--t-faint)' }}>命格解读生成中…</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            if (msg.role === 'user' && msg.hidden) return null;

            if (msg.role === 'user') {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[13px]"
                    style={{
                      background: 'color-mix(in srgb, var(--ac) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--ac) 18%, transparent)',
                      color: 'var(--t-gold)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            }

            // Assistant message
            const isLastMsg = i === messages.length - 1;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[12px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                  命理解读
                </div>
                <AiContent text={msg.content} streaming={loading && isLastMsg} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="继续追问，如：今年适合换工作吗？"

            className="flex-1 rounded-lg px-3 py-2 text-[13px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'color-mix(in srgb, var(--ac) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ac) 25%, transparent)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : '追问'}
          </button>
        </div>
      </div>

    </div>
  );
}
