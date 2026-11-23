'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/** 四套皮肤：只换 Token，不复制组件。暗色皮肤对应 dark，宣纸对应 light。 */
export type Skin = 'zijin' | 'cyber' | 'jade' | 'paper';

const SKINS: Skin[] = ['zijin', 'cyber', 'jade', 'paper'];
const SKIN_THEME: Record<Skin, Theme> = {
  zijin: 'dark',
  cyber: 'dark',
  jade: 'dark',
  paper: 'light',
};

function isSkin(v: string | null): v is Skin {
  return v === 'zijin' || v === 'cyber' || v === 'jade' || v === 'paper';
}

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: 'dark', toggle: () => {} });

const SkinContext = createContext<{
  skin: Skin;
  setSkin: (s: Skin) => void;
  /** 客户端是否已挂载。首绘 / 水合期间为 false：此时服务端与客户端渲染的选中态必须一致（全不选中），真正的选中态只在挂载后的提交里写入 DOM。否则水合残留的服务端 aria-pressed 永远清不掉（2026-11-22 高亮 bug：state 已是 paper，DOM 仍标 zijin 选中）。 */
  mounted: boolean;
}>({ skin: 'zijin', setSkin: () => {}, mounted: false });

function getInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  return 'dark';
}

function getInitialSkin(): Skin {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-skin');
    if (isSkin(attr)) return attr;
  }
  return 'zijin';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [skin, setSkinState] = useState<Skin>(getInitialSkin);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 收敛到“实际应用的皮肤”：首绘脚本已按已存选择把 data-skin 写到 <html> 上，
    // 它就是此刻真正渲染的皮肤；只有它无效时才退到 localStorage。
    // 这样即使初始 state 拿到服务端默认值，挂载后也会立刻纠正，切换器高亮永不与实际皮肤脱节。
    const attrSkin = document.documentElement.getAttribute('data-skin');
    const savedSkin = localStorage.getItem('ziwei-skin');
    const next = isSkin(attrSkin) ? attrSkin : isSkin(savedSkin) ? savedSkin : null;
    if (next) {
      setSkinState(next);
      setTheme(SKIN_THEME[next]);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-skin', skin);
    localStorage.setItem('ziwei-theme', theme);
    localStorage.setItem('ziwei-skin', skin);
  }, [theme, skin, mounted]);

  // 持续对齐：只要 <html> 上的 data-skin 变了（即实际渲染的皮肤变了），
  // state 就跟过去；切换器高亮永远等于实际皮肤，刷新、首次访问、手动切换都一样。
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const root = document.documentElement;
    const ob = new MutationObserver(() => {
      const cur = root.getAttribute('data-skin');
      if (isSkin(cur)) {
        setSkinState((prev) => (prev === cur ? prev : cur));
        setTheme((prev) => {
          const t = SKIN_THEME[cur];
          return prev === t ? prev : t;
        });
      }
    });
    ob.observe(root, { attributes: true, attributeFilter: ['data-skin'] });
    return () => ob.disconnect();
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    // 明暗切换时皮肤跟随：亮色用宣纸，暗色回到当前暗色皮肤（若当前是宣纸则回紫金）
    setSkinState(next === 'light' ? 'paper' : skin === 'paper' ? 'zijin' : skin);
    setTimeout(() => root.classList.remove('theme-transitioning'), 420);
  };

  const setSkin = (s: Skin) => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setSkinState(s);
    setTheme(SKIN_THEME[s]);
    setTimeout(() => root.classList.remove('theme-transitioning'), 420);
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin, mounted }}>
      <ThemeContext.Provider value={{ theme, toggle }}>
        {children}
      </ThemeContext.Provider>
    </SkinContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useSkin = () => useContext(SkinContext);
export { SKINS };
