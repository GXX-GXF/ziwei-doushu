'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import StarField from '@/components/StarField';
import { useSkin, type Skin } from '@/components/ThemeProvider';

/**
 * 首页（极简版）：全屏 3D 星盘背景 + 背景主视觉，大标题只写“紫微命盘”，
 * 四套皮肤切换器，两个按钮：单人起盘（进 /chart）、双人合盘（进 /heming）。
 * 无滚动、无其他内容。3D 组件只在客户端加载（ssr:false）。
 */
const Chart3DBackground = dynamic(() => import('@/components/Chart3DBackground'), { ssr: false });

const SKINS: Array<{ id: Skin; label: string; dot: string }> = [
  { id: 'zijin', label: '紫金星空', dot: '#D9B96E' },
  { id: 'cyber', label: '赛博霓虹', dot: '#56DDEB' },
  { id: 'jade', label: '翡翠秘境', dot: '#83C9A0' },
  { id: 'paper', label: '宣纸朱墨', dot: '#A83A32' },
];

export default function HomePage() {
  const { skin, setSkin, mounted } = useSkin();

  return (
    <div className="home-root">
      {/* 背景主视觉（每套皮肤只留一个） */}
      <StarField />
      {/* 全屏 3D 星盘 */}
      <Chart3DBackground skin={skin} />
      {/* 四角暗角（在 3D 之上、前景之下） */}
      <div className="home-vignette" aria-hidden="true" />

      <main className="home-front">
        <h1 className="home-title">紫微命盘</h1>

        <div className="skin-switcher home-themes" role="group" aria-label="皮肤">
          <span className="home-themes-label">皮肤</span>
          {SKINS.map((s) => (
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

        <div className="home-spacer" />

        <div className="home-actions">
          <Link href="/chart" className="home-btn primary">
            单人起盘
          </Link>
          <Link href="/heming" className="home-btn">
            双人合盘
          </Link>
        </div>
      </main>
    </div>
  );
}
