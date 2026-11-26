'use client';
import { motion } from 'framer-motion';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';

const LevelStyle = {
  excellent: { dot: 'bg-amber-400', label: 'text-amber-500', badge: 'text-amber-500 bg-amber-500/10 border-amber-500/25' },
  good:      { dot: 'bg-[#9d6bff]', label: 'text-[#b7a6ff]', badge: 'text-[#b7a6ff] bg-[#9d6bff]/10 border-[#9d6bff]/25' },
  neutral:   { dot: 'bg-[#8a7fb0]', label: 'text-[#b6abcf]', badge: 'text-[#b6abcf] bg-[#9d6bff]/10 border-[#9d6bff]/20' },
  caution:   { dot: 'bg-orange-500', label: 'text-orange-500', badge: 'text-orange-500 bg-orange-500/10 border-orange-500/25' },
};


// ── 展示层去重（只改渲染，不动 lib/ziwei 引擎数据）──
// 1. 宫位标签：贪狼与铃星同宫时 palaces 会出现 ['财帛', '财帛']，按显示文本去重。
// 2. 「必须」行：严格版格局的 description 与 required 取自同一条原书注文
//    （如七杀朝斗：description 是「原书第 11 条：见前批注……」，required 是
//    「《全书》定贵局第 11 条：见前批注……」），去掉条目包装后是同一句话，
//    渲染时只留描述行；出处信息仍由下方的「出处」行保留。
const normalizeQuote = (s: string): string =>
  s
    .replace(/^原书第\d+条：/, '')
    .replace(/^《全书》[^：]*第\d+条：/, '')
    .replace(/〔存疑格[^〕]*〕/g, '')
    .replace(/[「」『』“”"'\s]/g, '');

const isDuplicateOfDescription = (description: string, text: string): boolean => {
  const d = normalizeQuote(description);
  const t = normalizeQuote(text);
  if (!d || !t) return false;
  if (t === d) return true;
  // 包装略有出入时兜底：较短一方是较长一方的子串且足够长，避免短条件被误删
  const shorter = t.length <= d.length ? t : d;
  const longer = t.length <= d.length ? d : t;
  return shorter.length >= 10 && longer.includes(shorter);
};

const dedupePalaceTags = (palaces: string[]): string[] =>
  [...new Set(palaces.map(pa => pa.replace('宫', '')))].slice(0, 2);

const dedupeRequired = (description: string, required: string[]): string[] =>
  required.filter(r => !isDuplicateOfDescription(description, r));

export default function PatternsCard({ chart }: { chart: ZiweiChart }) {
  const patterns = detectPatterns(chart);
  if (patterns.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card-glass rounded-xl p-4 mb-4"
    >
      <div className="text-[12px] tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--t-faint)' }}>
        <span style={{ color: 'var(--t-gold)', opacity: 0.6 }}>◉</span>
        格局识别（严格古书条件）
        <span className="text-[12px] ml-auto" style={{ color: 'var(--t-faint)', opacity: 0.75 }}>{patterns.length}个</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {patterns.map((p, i) => {
          const st = LevelStyle[p.level];
          const palaceTags = dedupePalaceTags(p.palaces);
          const required = p.conditions ? dedupeRequired(p.description, p.conditions.required) : [];
          return (
            <motion.div
              key={`${p.name}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card-inner rounded-lg p-3 min-w-0"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                <span className={`text-[13px] font-medium ${st.label}`}>{p.name}</span>
                <div className="flex gap-1 ml-auto">
                  {palaceTags.map(pa => (
                    <span key={pa} className={`text-[12px] px-1.5 py-px rounded-full border ${st.badge}`}>
                      {pa}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[12px] leading-relaxed pl-3.5 break-words" style={{ color: 'var(--t-text2)' }}>
                {p.description}
              </p>

              {p.conditions && (
                <div className="mt-2 pl-3.5 space-y-0.5">
                  {required.length > 0 && (
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium" style={{ color: 'var(--t-gold)' }}>必须</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {required.join('、')}
                    </div>
                  )}
                  {p.conditions.bonus && p.conditions.bonus.length > 0 && (
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium text-emerald-500">加分</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {p.conditions.bonus.join('、')}
                    </div>
                  )}
                  {p.conditions.breaking && p.conditions.breaking.length > 0 && (
                    <div className="text-[12px] leading-relaxed" style={{ color: 'var(--t-text2)', opacity: 0.85 }}>
                      <span className="font-medium text-orange-500">破格</span>
                      <span style={{ opacity: 0.6 }}> · </span>
                      {p.conditions.breaking.join('、')}
                    </div>
                  )}
                </div>
              )}

              {p.source && (
                <div className="text-[12px] mt-1.5 pl-3.5 break-words" style={{ color: 'var(--t-faint)', opacity: 0.5 }}>
                  出处 · {p.source}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
