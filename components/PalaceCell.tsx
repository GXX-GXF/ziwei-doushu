'use client';
import { motion } from 'framer-motion';
import type { Palace, Star } from '@/lib/ziwei/types';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import clsx from 'clsx';

interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  delay?: number;
  /** 入场已播过/已跳过时为 true：直接出盘，不再播星曜归位动画 */
  instant?: boolean;
  /** 叠加四化：星名 → 四化类型（'禄'/'权'/'科'/'忌'） */
  overlayStarSiHua?: Record<string, string>;
  /** 叠加标签：'年'（流年）或 '限'（大限） */
  overlayLabel?: string;
  /** 点击叠加四化 badge 回调 */
  onSiHuaClick?: (starName: string, siHua: string) => void;
}

/** 四化语义色取皮肤 Token（禄绿/权金/科蓝/忌红），只换变量 */
const SIHUA_VARS: Record<string, string> = {
  '禄': 'var(--lu)',
  '权': 'var(--quan)',
  '科': 'var(--ke)',
  '忌': 'var(--ji)',
};

const SiHuaBadge = ({
  siHua,
  overlay,
  label,
  onClick,
}: {
  siHua: string;
  overlay?: boolean;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) => {
  const color = SIHUA_VARS[siHua] ?? 'var(--t-faint)';
  return (
    <span
      className={clsx(
        'inline-flex items-center text-[12px] px-1 rounded-full border leading-none py-px font-bold ml-1 flex-shrink-0',
        overlay && 'border-dashed opacity-80',
        onClick && 'cursor-pointer hover:opacity-100',
      )}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
      onClick={onClick}
    >
      {overlay && label && <span className="mr-px opacity-70">{label}</span>}
      {siHua}
    </span>
  );
};

export default function PalaceCell({
  palace, onClick, onStarClick, isSelected, isSanFang, delay = 0, instant = false,
  overlayStarSiHua, overlayLabel, onSiHuaClick,
}: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const ganzhi = `${STEMS[stem]}${BRANCHES[branch]}`;

  const majorStars = stars.filter(s => s.type === 'major');
  const luckyStars = stars.filter(s => s.type === 'lucky');
  const shaStars = stars.filter(s => s.type === 'sha');

  return (
    <motion.div
      initial={instant ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      onClick={onClick}
      className="palace-cell relative flex flex-col p-1.5 cursor-pointer transition-all duration-200 h-full"
      style={{
        minHeight: '90px',
        background: isSelected
          ? 'color-mix(in srgb, var(--ac) 20%, transparent)'
          : isSanFang
          ? 'color-mix(in srgb, var(--ac2) 16%, transparent)'
          : isCurrentDaXian
          ? 'color-mix(in srgb, var(--ac2) 10%, transparent)'
          : isMingGong
          ? 'color-mix(in srgb, var(--ac) 5%, transparent)'
          : 'var(--t-bg)',
        boxShadow: isSelected
          ? `inset 0 0 0 2px var(--ac), 0 0 26px -4px var(--ac)${isCurrentDaXian ? ', inset 3px 0 0 var(--ac2)' : ''}`
          : isSanFang
          ? `inset 0 0 0 1.5px var(--ac2), 0 0 18px -6px var(--ac2)${isCurrentDaXian ? ', inset 3px 0 0 var(--ac2)' : ''}`
          : isCurrentDaXian
          ? 'inset 3px 0 0 var(--ac2)'
          : 'none',
      }}
    >
      {/* 大限年龄 */}
      {daXianAge && (
        <div
          className="absolute top-1 right-1 text-[12px] font-mono tabular-nums"
          style={{ color: isCurrentDaXian ? 'var(--ac2)' : 'var(--t-faint)', opacity: isCurrentDaXian ? 1 : 0.75 }}
        >
          {daXianAge[0]}–{daXianAge[1]}
        </div>
      )}

      {/* 宫名行 */}
      <div className="flex items-center gap-1 mb-0.5 pr-8">
        <span className={clsx('text-[12px] font-medium tracking-wide',
          isMingGong ? 'text-amber-500' : isShenGong ? 'text-sky-500' : ''
        )}
          style={!isMingGong && !isShenGong ? { color: 'var(--t-faint)' } : undefined}
        >
          {name}
        </span>
        {isMingGong && (
          <span className="text-[12px] text-amber-500/80 border border-amber-500/30 px-0.5 rounded leading-tight">命</span>
        )}
        {isShenGong && (
          <span className="text-[12px] text-sky-500/80 border border-sky-500/30 px-0.5 rounded leading-tight">身</span>
        )}
        {isSelected && (
          <span className="text-[12px] font-bold px-0.5 rounded leading-tight" style={{ color: 'var(--t-gold)', border: '1px solid var(--t-gold)' }}>本宫</span>
        )}
        {isSanFang && (
          <span className="text-[12px] font-bold px-0.5 rounded leading-tight" style={{ color: 'var(--ac2)', border: '1px solid var(--ac2)' }}>三方</span>
        )}
      </div>

      {/* 干支 */}
      <div className="text-[12px] font-mono mb-1" style={{ color: 'var(--t-faint)', opacity: 0.75 }}>{ganzhi}</div>

      {/* 主星 */}
      <div className="flex flex-col gap-0.5 flex-1">
        {majorStars.length === 0 && (
          <span className="text-[12px] italic" style={{ color: 'var(--t-faint)', opacity: 0.6 }}>空宫</span>
        )}
        {majorStars.map((star) => {
          const overlaySiHua = overlayStarSiHua?.[star.name];
          return (
            <div
              key={star.name}
              className="flex items-center"
              onClick={e => { e.stopPropagation(); onStarClick?.(star); }}
            >
              <span
                className={clsx(
                  'text-[13px] leading-tight font-bold tracking-tight cursor-pointer hover:brightness-125 transition-all',
                  !instant && 'palace-star-in',
                  star.brightness === 'bright' ? 'text-amber-300' : star.brightness === 'dim' ? 'text-amber-700/80' : 'text-amber-500',
                )}
                style={!instant ? { animationDelay: `${delay + 0.25}s` } : undefined}
              >
                {star.name}
              </span>
              {star.siHua && <SiHuaBadge siHua={star.siHua} onClick={e => { e.stopPropagation(); onSiHuaClick?.(star.name, star.siHua!); }} />}
              {overlaySiHua && (
                <SiHuaBadge
                  siHua={overlaySiHua}
                  overlay
                  label={overlayLabel}
                  onClick={e => {
                    e.stopPropagation();
                    onSiHuaClick?.(star.name, overlaySiHua);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 吉星 */}
      {luckyStars.length > 0 && (
        <div className="flex flex-wrap gap-x-1 mt-0.5">
          {luckyStars.map(s => {
            const overlaySiHua = overlayStarSiHua?.[s.name];
            return (
              <span key={s.name} className="inline-flex items-center text-[12px] text-sky-500/70 leading-tight">
                {s.name}
                {s.siHua && <SiHuaBadge siHua={s.siHua} onClick={e => { e.stopPropagation(); onSiHuaClick?.(s.name, s.siHua!); }} />}
                {overlaySiHua && (
                  <SiHuaBadge
                    siHua={overlaySiHua}
                    overlay
                    label={overlayLabel}
                    onClick={e => {
                      e.stopPropagation();
                      onSiHuaClick?.(s.name, overlaySiHua);
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* 煞星 */}
      {shaStars.length > 0 && (
        <div className="flex flex-wrap gap-x-1">
          {shaStars.map(s => (
            <span key={s.name} className="text-[12px] text-red-500/60 leading-tight">
              {s.name}{s.siHua && <SiHuaBadge siHua={s.siHua} onClick={e => { e.stopPropagation(); onSiHuaClick?.(s.name, s.siHua!); }} />}
            </span>
          ))}
        </div>
      )}

    </motion.div>
  );
}
