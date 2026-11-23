'use client';
import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import PatternsCard from '@/components/PatternsCard';
import type { TimeView } from '@/components/TimeNav';
import { useSkin, type Skin } from '@/components/ThemeProvider';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这是一个最小可运行示例：用本仓库的排盘引擎 generateChart() 配合基础 UI
 * 组件，渲染一张完整紫微命盘 + 基础解读，并支持本命 / 大限 / 流年切换。
 *
 * 说明：线上商业版的完整交互界面（重设计的新 UI、AI 流式解读、合盘、分享
 * 卡片等）不在开源范围内；但排盘内核——安星算法、四化、格局识别、古籍库——
 * 完全开放（见 lib/ziwei/*），可自由二次开发出你自己的界面。
 */

/** 皮肤切换器：四套皮肤只换 Token，不复制组件 */
const SKINS: Array<{ id: Skin; label: string; dot: string }> = [
  { id: 'zijin', label: '紫金星空', dot: '#D9B96E' },
  { id: 'cyber', label: '赛博霓虹', dot: '#56DDEB' },
  { id: 'jade', label: '翡翠秘境', dot: '#83C9A0' },
  { id: 'paper', label: '宣纸朱墨', dot: '#A83A32' },
];

function SkinSwitcher() {
  const { skin, setSkin, mounted } = useSkin();
  return (
    <div className="skin-switcher" role="group" aria-label="皮肤">
      {SKINS.map(s => (
        <button
          key={s.id}
          type="button"
          aria-pressed={mounted && skin === s.id}
          onClick={() => setSkin(s.id)}
          className="skin-btn"
        >
          <span className="skin-dot" style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** 返回首页按钮：与「重新起盘」同一套描边按钮样式 */
const backBtnStyle: CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--t-border-acc)',
  borderRadius: 12,
  background: 'var(--t-card)',
  color: 'var(--t-gold)',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: 14,
  lineHeight: 1.5,
};

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [palaceNonce, setPalaceNonce] = useState(0); // 同一宫位重复点选也要让面板感知到
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string; view: TimeView } | null>(null);

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/" style={backBtnStyle}>← 返回首页</Link>
        </div>
        <h1 className="zj-gold-title" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>紫微斗数排盘</h1>
        <p style={{ color: 'var(--tx-2)', marginBottom: 24, fontSize: 14, lineHeight: 1.7 }}>
          输入出生年月日时，开源排盘引擎即时生成命盘。
          <br />
          （本页为引擎 Demo，完整商业版界面不在开源范围；排盘内核完全开放。）
        </p>
        <div className="zj-divider-gold" style={{ marginBottom: 28 }} />
        <BirthForm onSubmit={(info: BirthInfo) => setChart(generateChart(info))} />
      </main>
    );
  }

  // ── 已起盘：命盘 + 解读 ──
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/" style={backBtnStyle}>← 返回首页</Link>
        <button
          type="button"
          onClick={() => { setChart(null); setSelectedPalace(null); setSelectedSiHua(null); }}
          style={{
            padding: '6px 14px', cursor: 'pointer',
            border: '1px solid var(--t-border-acc)', borderRadius: 12, background: 'var(--t-card)',
            color: 'var(--t-gold)',
          }}
        >
          ← 重新起盘
        </button>
        <SkinSwitcher />
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        style={{
          gap: 20, marginTop: 16, alignItems: 'start',
        }}
      >
        <div className="min-w-0">
          <ChartBoard chart={chart} onPalaceSelect={(p) => { setSelectedPalace(p); setPalaceNonce(n => n + 1); }} onSiHuaClick={(starName, siHua, view) => setSelectedSiHua({ starName, siHua, view })} />
          <div style={{ marginTop: 20 }}>
            <PatternsCard chart={chart} />
          </div>
        </div>
        <div className="min-w-0">
          <InsightPanel chart={chart} selectedPalace={selectedPalace} selectedSiHua={selectedSiHua} palaceNonce={palaceNonce} />
        </div>
      </div>
    </main>
  );
}
