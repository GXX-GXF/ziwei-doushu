'use client';
import { useEffect, useRef } from 'react';
import { useSkin } from './ThemeProvider';

/**
 * 首页背景主视觉（2D Canvas，每套皮肤只留一个主视觉，直搬原型 bgfx 定版画法）。
 * 紫金星空：右上螺旋星系 + 稀疏静态星点；赛博霓虹：底部透视网格 + 稀疏青白星点；
 * 翡翠秘境：顶部极光波带（缓慢起伏）+ 稀疏玉绿星点；宣纸朱墨：朱红落日 + 水墨远山（无星点）。
 * 星点层随皮肤变：颜色、密度、大小、亮度各套不同。
 */
export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { skin } = useSkin();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let raf = 0;
    let stopped = false;

    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * DPR));
      canvas.height = Math.max(1, Math.floor(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const drawZijin = () => {
      const bgG = ctx.createLinearGradient(0, 0, 0, H);
      bgG.addColorStop(0, '#150C2C');
      bgG.addColorStop(0.48, '#0E0820');
      bgG.addColorStop(1, '#080510');
      ctx.fillStyle = bgG;
      ctx.fillRect(0, 0, W, H);
      // 稀疏静态星点：42 颗，位置与亮度固定，不闪烁
      for (let s = 0; s < 42; s++) {
        const sx = (((s * 173.3) % 100) / 100) * W;
        const sy = (((s * 97.7) % 100) / 100) * H;
        ctx.globalAlpha = s % 7 === 0 ? 0.34 : 0.18;
        ctx.fillStyle = s % 9 === 0 ? '#F6E7BB' : '#EDE6FF';
        ctx.beginPath();
        ctx.arc(sx, sy, s % 7 === 0 ? 1.5 : 1.0, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 螺旋星系（右上）：亮核 30%～38%，旋臂星 135 颗（70% 暗 / 20% 普通 / 10% 高亮）
      const gx = W * 0.8;
      const gy = H * 0.22;
      const gr = Math.min(W, H) * 0.21;
      const core = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.55);
      core.addColorStop(0, 'rgba(246,231,187,.34)');
      core.addColorStop(0.35, 'rgba(155,123,224,.17)');
      core.addColorStop(1, 'rgba(155,123,224,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 0.55, 0, 7);
      ctx.fill();
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(0.6);
      ctx.scale(1, 0.46);
      for (let i = 0; i < 135; i++) {
        const arm = i % 3;
        const k = i / 135;
        const ang = arm * 2.09 + k * 5.0;
        const rad = k * gr;
        const px = Math.cos(ang) * rad + Math.sin(i * 12.9) * gr * 0.03;
        const py = Math.sin(ang) * rad + Math.cos(i * 7.3) * gr * 0.03;
        const tier = i % 10;
        ctx.globalAlpha = (tier < 7 ? 0.2 : tier < 9 ? 0.42 : 0.68) * (1 - k * 0.55);
        ctx.fillStyle = tier >= 9 ? '#F6E7BB' : i % 3 === 0 ? '#B4A6D9' : '#8D7FB8';
        ctx.beginPath();
        ctx.arc(px, py, (tier >= 9 ? 1.9 : 1.4) * (1 - k) + 0.6, 0, 7);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFF3D0';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(gx, gy, 2.4, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawCyber = () => {
      const bgG2 = ctx.createLinearGradient(0, 0, 0, H);
      bgG2.addColorStop(0, '#092028');
      bgG2.addColorStop(0.55, '#07161D');
      bgG2.addColorStop(1, '#040E14');
      ctx.fillStyle = bgG2;
      ctx.fillRect(0, 0, W, H);
      // 底部透视网格：线色 #28717A、8%～12%，垂直渐变蒙版（底部往上消失），静态
      const horizon = H * 0.68;
      const gridGrad = ctx.createLinearGradient(0, H, 0, horizon);
      gridGrad.addColorStop(0, 'rgba(40,113,122,.18)');
      gridGrad.addColorStop(0.55, 'rgba(40,113,122,.09)');
      gridGrad.addColorStop(1, 'rgba(40,113,122,0)');
      ctx.strokeStyle = gridGrad;
      ctx.lineWidth = 0.7;
      for (let i = 0; i <= 18; i++) {
        const x = (i / 18) * W;
        ctx.beginPath();
        ctx.moveTo(W / 2 + (x - W / 2) * 0.18, horizon);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let r = 0; r < 7; r++) {
        const y = horizon + Math.pow(r / 7, 1.6) * (H - horizon);
        if (y > H) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // 青白冷色星点：偏稀疏（60 颗，只在网格上方），方形像素点带轻微数字感
      for (let s = 0; s < 60; s++) {
        const sx = (((s * 211.7) % 100) / 100) * W;
        const sy = (((s * 131.3) % 100) / 100) * H * 0.62;
        ctx.globalAlpha = s % 5 === 0 ? 0.3 : 0.14;
        ctx.fillStyle = s % 4 === 0 ? '#E6FBFF' : '#B5F9FF';
        if (s % 5 === 0) {
          ctx.fillRect(sx, sy, 1.8, 1.8);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, s % 7 === 0 ? 1.5 : 1.0, 0, 7);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawJade = (t: number) => {
      const bgG3 = ctx.createLinearGradient(0, 0, 0, H);
      bgG3.addColorStop(0, '#0C2A1E');
      bgG3.addColorStop(0.5, '#081E15');
      bgG3.addColorStop(1, '#061711');
      ctx.fillStyle = bgG3;
      ctx.fillRect(0, 0, W, H);
      // 顶部极光波带：主色 #477C65 的透明渐变（10%～16%），横向覆盖约 70%，缓慢起伏
      for (let band = 0; band < 4; band++) {
        ctx.beginPath();
        const baseY = H * (0.02 + band * 0.05);
        let firstPt = true;
        for (let x = W * 0.14; x <= W * 0.86; x += 12) {
          const y =
            baseY + Math.sin(x * 0.005 + t * 0.0005 + band * 1.6) * 18 + Math.sin(x * 0.011 - t * 0.0003 + band) * 7;
          if (firstPt) {
            ctx.moveTo(x, y);
            firstPt = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        for (let x2 = W * 0.86; x2 >= W * 0.14; x2 -= 12) {
          const y2 = baseY + 44 + band * 11 + Math.sin(x2 * 0.005 + t * 0.0005 + band * 1.6) * 13;
          ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        const ag = ctx.createLinearGradient(0, baseY, 0, baseY + 62 + band * 11);
        if (band === 2) {
          ag.addColorStop(0, 'rgba(198,167,106,.10)');
          ag.addColorStop(1, 'rgba(198,167,106,0)');
        } else {
          ag.addColorStop(0, 'rgba(71,124,101,.16)');
          ag.addColorStop(0.55, 'rgba(71,124,101,.09)');
          ag.addColorStop(1, 'rgba(71,124,101,0)');
        }
        ctx.fillStyle = ag;
        ctx.fill();
        ctx.strokeStyle = band === 2 ? 'rgba(228,200,127,.14)' : 'rgba(131,201,160,.16)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // 玉绿柔光星点：偏稀疏、偏暗（55 颗）
      for (let s = 0; s < 55; s++) {
        const sx = (((s * 197.3) % 100) / 100) * W;
        const sy = (((s * 113.9) % 100) / 100) * H * 0.7;
        ctx.globalAlpha = s % 6 === 0 ? 0.2 : 0.1;
        ctx.fillStyle = s % 4 === 0 ? '#D2E9D5' : '#A9CFA5';
        ctx.beginPath();
        ctx.arc(sx, sy, s % 6 === 0 ? 1.4 : 1.0, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawPaper = () => {
      const bgG4 = ctx.createLinearGradient(0, 0, 0, H);
      bgG4.addColorStop(0, '#F6F1E6');
      bgG4.addColorStop(0.6, '#F4EFE4');
      bgG4.addColorStop(1, '#EBDFC6');
      ctx.fillStyle = bgG4;
      ctx.fillRect(0, 0, W, H);
      // 朱红落日：低饱和朱砂 #B96B5D，柔光晕
      const sx = W * 0.82;
      const sy = H * 0.2;
      const sr = Math.min(W, H) * 0.07;
      const halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.4);
      halo.addColorStop(0, 'rgba(185,107,93,.10)');
      halo.addColorStop(1, 'rgba(185,107,93,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 2.4, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 0.66;
      const sunG = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.15, sx, sy, sr);
      sunG.addColorStop(0, '#C9826F');
      sunG.addColorStop(0.7, '#B96B5D');
      sunG.addColorStop(1, '#A85D52');
      ctx.fillStyle = sunG;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 水墨远山：三层递减（远约 10% / 中约 13% / 近约 17%），近浓远淡但整体很轻
      const layers = [
        { base: 0.86, amp: 0.045, col: 'rgba(112,96,74,.10)', f: 0.0032, ph: 0 },
        { base: 0.9, amp: 0.053, col: 'rgba(84,70,52,.13)', f: 0.0044, ph: 1.8 },
        { base: 0.945, amp: 0.041, col: 'rgba(52,42,30,.17)', f: 0.0058, ph: 3.6 },
      ];
      layers.forEach((L) => {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) {
          const y =
            H * L.base - Math.abs(Math.sin(x * L.f + L.ph)) * H * L.amp - Math.sin(x * 0.0016 + L.ph) * H * 0.018;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = L.col;
        ctx.fill();
      });
    };

    const frame = (now: number) => {
      if (stopped) return;
      ctx.clearRect(0, 0, W, H);
      if (skin === 'zijin') drawZijin();
      else if (skin === 'cyber') drawCyber();
      else if (skin === 'jade') drawJade(now);
      else drawPaper();
      // 只有翡翠的极光主视觉需要逐帧起伏；其余三套静态，只在切换 / 尺寸变化时重绘
      if (!reduced && skin === 'jade') raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      resize();
      frame(600);
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', onResize);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
