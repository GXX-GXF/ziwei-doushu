'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import PalaceCell from './PalaceCell';
import TimeNav, { type TimeView, getYearStemIndex, buildSiHuaOverlay } from './TimeNav';

interface ChartBoardProps {
  chart: ZiweiChart;
  onStarSelect?: (star: Star, palace: Palace) => void;
  onPalaceSelect?: (palace: Palace) => void;
  onSiHuaClick?: (starName: string, siHua: string, view: TimeView) => void;
}

const BRANCH_GRID_POS: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

// 每个地支宫位在网格中的中心坐标（百分比）
const BRANCH_SVG_POS: Record<number, [number, number]> = {
  5: [12.5, 12.5], 6: [37.5, 12.5], 7: [62.5, 12.5], 8: [87.5, 12.5],
  4: [12.5, 37.5],                                      9: [87.5, 37.5],
  3: [12.5, 62.5],                                     10: [87.5, 62.5],
  2: [12.5, 87.5], 1: [37.5, 87.5], 0: [62.5, 87.5], 11: [87.5, 87.5],
};

// 绕盘面顺时针排列（用于三方四正四边形排序）
const CLOCKWISE_INDEX: Record<number, number> = {
  5: 0, 6: 1, 7: 2, 8: 3,
  9: 4, 10: 5,
  11: 6, 0: 7, 1: 8, 2: 9,
  3: 10, 4: 11,
};

function sortClockwise(branches: number[]): number[] {
  return [...branches].sort((a, b) => CLOCKWISE_INDEX[a] - CLOCKWISE_INDEX[b]);
}

/** 三方四正：本宫 + 对宫 + 两个三合宫 */
function getSanFangSiZheng(branch: number): [number, number, number, number] {
  return [
    branch,
    (branch + 6) % 12,   // 对宫
    (branch + 4) % 12,   // 三合1
    (branch + 8) % 12,   // 三合2
  ];
}

const ANIMATION_ORDER = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

/** 入场动画只播一次（同会话二次查看直接出盘） */
const INTRO_KEY = 'ziwei-intro-played';

/** 四化流光颜色（皮肤 Token） */
const SIHUA_VAR: Record<string, string> = {
  '禄': 'var(--lu)',
  '权': 'var(--quan)',
  '科': 'var(--ke)',
  '忌': 'var(--ji)',
};

export default function ChartBoard({ chart, onStarSelect, onPalaceSelect, onSiHuaClick }: ChartBoardProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState<number>(new Date().getFullYear());
  const reduceMotion = useReducedMotion();

  // ── 入场：星曜归位（1.5s 左右，可跳过；同会话二次查看直接出盘） ──
  const [instant, setInstant] = useState<boolean>(() => {
    if (typeof window === 'undefined' || reduceMotion) return true;
    try { return sessionStorage.getItem(INTRO_KEY) === '1'; } catch { return false; }
  });
  const [introKey, setIntroKey] = useState(0);
  const [introPlaying, setIntroPlaying] = useState<boolean>(() => {
    if (typeof window === 'undefined' || reduceMotion) return false;
    try { return sessionStorage.getItem(INTRO_KEY) !== '1'; } catch { return true; }
  });

  useEffect(() => {
    if (instant) return;
    const t = setTimeout(() => {
      setIntroPlaying(false);
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* 忽略 */ }
    }, 1700);
    return () => clearTimeout(t);
  }, [instant, introKey]);

  const skipIntro = () => {
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* 忽略 */ }
    setInstant(true);
    setIntroPlaying(false);
    setIntroKey(k => k + 1); // 重挂载宫格，直接出盘
  };

  const replayIntro = () => {
    setInstant(false);
    setIntroPlaying(true);
    setIntroKey(k => k + 1);
  };

  // ── 盘面 3D 轻倾斜：跟随鼠标，细腻透视；触屏与减弱动效下关闭 ──
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const sTiltX = useSpring(tiltX, { stiffness: 140, damping: 18 });
  const sTiltY = useSpring(tiltY, { stiffness: 140, damping: 18 });
  const [canTilt] = useState(
    () => typeof window !== 'undefined' && !reduceMotion && window.matchMedia('(pointer: fine)').matches,
  );
  const handleTiltMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canTilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tiltY.set(px * 6);
    tiltX.set(-py * 6);
  };
  const resetTilt = () => { tiltX.set(0); tiltY.set(0); };

  // ── 四化飞星流光：中宫 → 落宫 ──
  const [flight, setFlight] = useState<{ branch: number; siHua: string; starName: string; key: number } | null>(null);
  useEffect(() => {
    if (!flight) return;
    const t = setTimeout(() => setFlight(null), 3600);
    return () => clearTimeout(t);
  }, [flight]);

  const triggerFlight = (starName: string, siHua: string) => {
    // 星名在盘中唯一：按星名找到落宫（只读现有排盘数据，不重算四化）
    const p = chart.palaces.find(pp => pp.stars.some(s => s.name === starName));
    if (!p) return;
    setFlight({ branch: p.branch, siHua, starName, key: Date.now() });
  };

  const triggerBirthSiHua = (siHua: string) => {
    // 生年四化：按四化类型在盘中找到对应星曜（只读排盘数据），落宫即星曜本宫；
    // 即使起点=落宫，也要给落宫脉冲 + 光束 + 标签反馈，不能静默无事
    const p = chart.palaces.find(pp => pp.stars.some(s => s.siHua === siHua));
    const star = p?.stars.find(s => s.siHua === siHua);
    if (!p || !star) return;
    setFlight({ branch: p.branch, siHua, starName: star.name, key: Date.now() });
  };

  // ── 天象扫描 ──
  const [scanKey, setScanKey] = useState<number | null>(null);

  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });

  // 计算当前叠加四化数据（大限或流年）
  const currentDx = chart.daXians[chart.currentDaXianIndex];
  const overlayData: Record<string, string> = (() => {
    if (timeView === 'daxian' && currentDx) {
      const dxPalace = chart.palaces.find(p => p.branch === currentDx.palaceBranch);
      if (dxPalace) return buildSiHuaOverlay(dxPalace.stem);
    }
    if (timeView === 'liunian') {
      return buildSiHuaOverlay(getYearStemIndex(liunianYear));
    }
    return {};
  })();
  const overlayLabel = timeView === 'daxian' ? '限' : timeView === 'liunian' ? '年' : undefined;

  const handlePalaceClick = (branch: number) => {
    const isDeselecting = selectedBranch === branch;
    setSelectedBranch(prev => prev === branch ? null : branch);
    if (!isDeselecting) {
      const palace = palaceMap[branch];
      if (palace) onPalaceSelect?.(palace);
    }
  };

  const handleStarClick = (star: Star, palace: Palace) => {
    // /chart 页没有星曜详情面板：点星名也要选中本宫，否则三方四正死活点不出来
    handlePalaceClick(palace.branch);
    onStarSelect?.(star, palace);
  };

  const handleSiHuaClick = (starName: string, siHua: string) => {
    triggerFlight(starName, siHua);
    onSiHuaClick?.(starName, siHua, timeView);
  };

  // 三方四正
  const sanFangBranches = selectedBranch !== null ? getSanFangSiZheng(selectedBranch) : null;
  const sanFangSet = sanFangBranches ? new Set(sanFangBranches) : null;

  // 飞星路径：中宫 (50,50) → 落宫中心，向上微弯
  const flightD = (() => {
    if (!flight) return '';
    const [tx, ty] = BRANCH_SVG_POS[flight.branch];
    const mx = (50 + tx) / 2;
    const my = Math.min(50, ty) - 14;
    return `M 50 50 Q ${mx} ${my} ${tx} ${ty}`;
  })();
  const flightColor = flight ? (SIHUA_VAR[flight.siHua] ?? 'var(--t-gold)') : 'var(--t-gold)';

  return (
    <div className="w-full select-none">
      {/* 时间导航轴 */}
      <TimeNav
        chart={chart}
        view={timeView}
        liunianYear={liunianYear}
        onViewChange={setTimeView}
        onYearChange={setLiunianYear}
      />

      {/* 命盘标题 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3"
      >
        <div className="text-[12px] tracking-[0.5em] uppercase mb-1" style={{ color: 'var(--t-faint)' }}>
          Zi Wei Dou Shu
        </div>
        <h2 className="text-sm tracking-[0.25em] font-medium" style={{ color: 'var(--t-gold)' }}>
          {chart.birthInfo.name ? `${chart.birthInfo.name} · ` : ''}紫微斗数命盘
        </h2>
      </motion.div>

      {/* 4x4 命盘网格（含 SVG 叠加层） */}
      <motion.div
        onMouseMove={handleTiltMove}
        onMouseLeave={resetTilt}
        style={canTilt ? { rotateX: sTiltX, rotateY: sTiltY, transformPerspective: 1000 } : undefined}
      >
        <div
          key={introKey}
          className="grid rounded-xl overflow-hidden relative"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(4, auto)',
            gap: '1px',
            background: 'var(--t-border)',
            border: '1px solid var(--t-border)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.15), 0 0 40px -18px var(--t-gold)',
          }}
        >
          {ANIMATION_ORDER.map((branch, i) => {
            const [row, col] = BRANCH_GRID_POS[branch];
            const palace = palaceMap[branch];
            if (!palace) return null;
            const linked = selectedBranch !== null && !!sanFangSet?.has(branch);
            return (
              <div
                key={branch}
                className={`palace-wrap${flight?.branch === branch ? ' hua-target-wrap' : ''}`}
                style={{
                  gridRow: row,
                  gridColumn: col,
                  background: 'var(--t-bg)',
                  opacity: selectedBranch !== null && !linked ? 0.38 : 1,
                }}
              >
                <PalaceCell
                  palace={palace}
                  onClick={() => handlePalaceClick(branch)}
                  onStarClick={(star) => handleStarClick(star, palace)}
                  isSelected={selectedBranch === branch}
                  isSanFang={!!(sanFangSet?.has(branch) && selectedBranch !== branch)}
                  delay={instant ? 0 : i * 0.09}
                  instant={instant}
                  overlayStarSiHua={Object.keys(overlayData).length > 0 ? overlayData : undefined}
                  overlayLabel={overlayLabel}
                  onSiHuaClick={(starName, siHua) => handleSiHuaClick(starName, siHua)}
                />
              </div>
            );
          })}

          {/* 中央信息区：星核视觉 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: instant ? 0 : 0.5 }}
            className="palace-center-tile flex flex-col items-center justify-center p-4 gap-3"
            style={{ gridRow: '2 / 4', gridColumn: '2 / 4', background: 'var(--t-bg)' }}
          >
            <div className="center-core" aria-hidden="true">
              <span className="center-orbit" />
              <span className="center-orbit center-orbit-2" />
              <span className="center-star">✦</span>
            </div>

            <div className="text-center space-y-1">
              <div className="text-[12px] tracking-[0.3em] font-medium" style={{ color: 'var(--t-gold)' }}>紫微斗数</div>
              <div className="text-[12px] space-y-0.5" style={{ color: 'var(--t-faint)' }}>
                <div>命宫 <span style={{ color: 'var(--t-gold)', opacity: 0.7 }}>{BRANCHES[chart.mingGongBranch]}</span></div>
                <div>身宫 <span className="text-sky-500/70">{BRANCHES[chart.shenGongBranch]}</span></div>
                <div className="text-[12px]" style={{ color: 'var(--t-gold)', opacity: 0.75 }}>{chart.wuxingJuName}</div>
              </div>
            </div>

            {chart.currentDaXianIndex >= 0 && (() => {
              const dx = chart.daXians[chart.currentDaXianIndex];
              return (
                <div className="border rounded-lg px-3 py-1.5 text-center"
                  style={{ borderColor: 'color-mix(in srgb, var(--ac2) 40%, transparent)', background: 'color-mix(in srgb, var(--ac2) 8%, transparent)' }}>
                  <div className="text-[12px] mb-0.5 tracking-wider" style={{ color: 'var(--ac2)' }}>当前大限</div>
                  <div className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--ac2)' }}>{dx.startAge}–{dx.endAge}岁</div>
                  <div className="text-[12px]" style={{ color: 'var(--ac2)', opacity: 0.7 }}>{dx.palaceName}</div>
                </div>
              );
            })()}

            <div className="text-[12px] text-center leading-relaxed font-mono" style={{ color: 'var(--t-faint)', opacity: 0.75 }}>
              {chart.lunarInfo.lunarYear}·{chart.lunarInfo.isLeapMonth ? '闰' : ''}
              {chart.lunarInfo.lunarMonth}·{chart.lunarInfo.lunarDay}
            </div>
          </motion.div>

          {/* ── 三方四正 SVG 连线（金紫流光，绝对定位在 grid 内部） ── */}
          <AnimatePresence>
            {sanFangBranches !== null && (
              <motion.div
                key={`sf-${selectedBranch}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 20,
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block', filter: 'drop-shadow(0 0 8px var(--t-gold))' }}
                >
                  {(() => {
                    // 三角形（三方）+ 一条直线（对宫）
                    const p0 = BRANCH_SVG_POS[sanFangBranches[0]]; // 本宫
                    const p1 = BRANCH_SVG_POS[sanFangBranches[1]]; // 对宫
                    const p2 = BRANCH_SVG_POS[sanFangBranches[2]]; // 三合1
                    const p3 = BRANCH_SVG_POS[sanFangBranches[3]]; // 三合2
                    const dash = '9 5';
                    const sw = '3';
                    const lineStyle = { stroke: 'var(--t-gold)' } as React.CSSProperties;
                    return (
                      <>
                        {/* 对宫直线：本宫 ↔ 对宫（穿过中心） */}
                        <line
                          className="sf-line"
                          x1={`${p0[0]}%`} y1={`${p0[1]}%`}
                          x2={`${p1[0]}%`} y2={`${p1[1]}%`}
                          style={lineStyle} strokeWidth={sw}
                          strokeDasharray={dash} strokeLinecap="round"
                        />
                        {/* 三合三角形：本宫 → 三合1 → 三合2 → 本宫 */}
                        <line
                          className="sf-line"
                          x1={`${p0[0]}%`} y1={`${p0[1]}%`}
                          x2={`${p2[0]}%`} y2={`${p2[1]}%`}
                          style={lineStyle} strokeWidth={sw}
                          strokeDasharray={dash} strokeLinecap="round"
                        />
                        <line
                          className="sf-line"
                          x1={`${p2[0]}%`} y1={`${p2[1]}%`}
                          x2={`${p3[0]}%`} y2={`${p3[1]}%`}
                          style={lineStyle} strokeWidth={sw}
                          strokeDasharray={dash} strokeLinecap="round"
                        />
                        <line
                          className="sf-line"
                          x1={`${p3[0]}%`} y1={`${p3[1]}%`}
                          x2={`${p0[0]}%`} y2={`${p0[1]}%`}
                          style={lineStyle} strokeWidth={sw}
                          strokeDasharray={dash} strokeLinecap="round"
                        />
                        {/* 四个宫位中心标记点 */}
                        {[p0, p1, p2, p3].map((p, i) => (
                          <circle
                            key={i}
                            className="sf-dot"
                            cx={`${p[0]}%`} cy={`${p[1]}%`}
                            r="5"
                            style={{ fill: i === 0 ? 'var(--t-gold)' : 'var(--ac2)' }}
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 四化飞星流光：中宫 → 落宫 ── */}
          {flight && (
            <svg
              key={flight.key}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none"
              style={{ position: 'absolute', inset: 0, zIndex: 25, width: '100%', height: '100%', display: 'block' }}
            >
              <defs>
                <marker id="fly-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" style={{ fill: flightColor }} />
                </marker>
              </defs>
              <path d={flightD} fill="none" stroke={flightColor} strokeWidth={9} strokeLinecap="round" opacity={0.22} />
              <motion.path
                d={flightD}
                fill="none"
                stroke={flightColor}
                strokeWidth={3.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 6px ${flightColor})` }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
                markerEnd="url(#fly-arrow)"
              />
              <circle r="2.2" style={{ fill: flightColor }}>
                <animateMotion dur="0.9s" fill="freeze" path={flightD} />
              </circle>
              {/* 落宫扩散环：起点=落宫（生年四化）时也有可见脉冲 */}
              <motion.circle
                cx={`${BRANCH_SVG_POS[flight.branch][0]}%`}
                cy={`${BRANCH_SVG_POS[flight.branch][1]}%`}
                fill="none"
                stroke={flightColor}
                strokeWidth={2}
                initial={{ r: 6, opacity: 0.9 }}
                animate={{ r: 18, opacity: 0 }}
                transition={{ duration: 1.1, repeat: 2, ease: 'easeOut' }}
              />
            </svg>
          )}
          {flight && (
            <div
              className="flight-label"
              style={{ left: `${BRANCH_SVG_POS[flight.branch][0]}%`, top: `${BRANCH_SVG_POS[flight.branch][1]}%`, borderColor: flightColor, color: flightColor }}
            >
              {flight.starName}化{flight.siHua}
            </div>
          )}

          {/* ── 天象扫描光束 ── */}
          {scanKey !== null && (
            <div key={scanKey} className="scanbeam run" onAnimationEnd={() => setScanKey(null)} />
          )}
        </div>
      </motion.div>

      {/* 图例 + 操作 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-3 flex items-center justify-center gap-2 text-[12px] flex-wrap"
      >
        {[
          { h: '化禄', c: 'var(--lu)' },
          { h: '化权', c: 'var(--quan)' },
          { h: '化科', c: 'var(--ke)' },
          { h: '化忌', c: 'var(--ji)' },
        ].map(({ h, c }) => (
          <button
            key={h}
            type="button"
            title={`点击看${h}飞星`}
            aria-pressed={flight?.siHua === h}
            onClick={() => triggerBirthSiHua(h)}
            className="border px-1.5 py-0.5 rounded-full font-medium cursor-pointer"
            style={{ color: c, borderColor: `color-mix(in srgb, ${c} 35%, transparent)`, background: flight?.siHua === h ? `color-mix(in srgb, ${c} 18%, transparent)` : 'transparent' }}
          >{h}</button>
        ))}
        <span className="px-1.5 py-0.5 rounded-full" style={{ color: 'var(--t-faint)', border: '1px solid var(--t-border)' }}>
          点击宫位看三方四正
        </span>
        <button
          type="button"
          onClick={() => setScanKey(Date.now())}
          className="px-1.5 py-0.5 rounded-full border font-medium"
          style={{ color: 'var(--t-gold)', borderColor: 'var(--t-border-acc)' }}
        >
          ✦ 天象扫描
        </button>
        <button
          type="button"
          onClick={replayIntro}
          className="px-1.5 py-0.5 rounded-full border font-medium"
          style={{ color: 'var(--t-gold)', borderColor: 'var(--t-border-acc)' }}
        >
          ⟳ 星曜归位
        </button>
        {introPlaying && !instant && (
          <button
            type="button"
            onClick={skipIntro}
            className="px-1.5 py-0.5 rounded-full border font-medium"
            style={{ color: 'var(--t-faint)', borderColor: 'var(--t-border)' }}
          >
            跳过入场 ▸
          </button>
        )}
      </motion.div>
    </div>
  );
}
