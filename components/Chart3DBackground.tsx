'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Skin } from './ThemeProvider';

/**
 * 首页全屏 Three.js 3D 星盘背景，直搬原型定版场景：
 * 三环 TorusGeometry、十二宫球体节点带宫名、中央线框二十面体星核、
 * 星野 / 星云 / 盘内浮尘、拖拽惯性、滚轮 / 双指缩放、点宫选中（三方四正连线）。
 * 无 WebGL 时 2D 回退（同心圆 + 宫位节点 + 宫名）。
 * 只搬样式与场景结构，不搬原型安星诀 JS；排盘仍走真站 iztro 引擎。
 *
 * 皮肤配色（任务定版，只换材质 Token，模型共用）：
 * 紫金：香槟金 + 紫轮廓光；赛博：钛银 + 青刻度；
 * 翡翠：暖金 + 玉绿内核；宣纸：古铜金 + 朱砂细节。
 */

const PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

type StarLayer = { n: number; size: number; op: number };
type StarCfg = {
  a: StarLayer;
  b: StarLayer;
  starB: number;
  twinkle: number;
  dustOp: number;
  nebulaOp: number;
  fbStars: number;
};

type Theme3D = {
  accent: number;
  accent2: number;
  star: number;
  nebula: [number, number, number];
  label: string;
  stars: StarCfg;
};

/**
 * 每套皮肤的星野配置（只改星点层，不动星盘主体）：
 * 紫金：紫金色星点、偏密、带金色亮星；赛博：青白冷色星点、偏稀疏、方形像素点；
 * 翡翠：玉绿柔光星点、偏稀疏、偏暗；宣纸：无星点（只留落日远山，盘内浮尘压到极淡作纸面微粒）。
 */
const THEMES: Record<Skin, Theme3D> = {
  zijin: {
    accent: 0xd9b96e, accent2: 0x9b7be0, star: 0xede6ff, nebula: [0x514267, 0x4a3a63, 0xb58b45], label: '#F0E8D8',
    stars: { a: { n: 780, size: 0.6, op: 0.95 }, b: { n: 320, size: 1.0, op: 0.95 }, starB: 0xf6e7bb, twinkle: 0.28, dustOp: 0.55, nebulaOp: 0.16, fbStars: 200 },
  },
  cyber: {
    accent: 0xc9d4d8, accent2: 0x56ddeb, star: 0xb5f9ff, nebula: [0x28717a, 0x155e75, 0xe16bd2], label: '#F0F7F8',
    stars: { a: { n: 380, size: 0.5, op: 0.8 }, b: { n: 130, size: 0.85, op: 0.85 }, starB: 0xb5f9ff, twinkle: 0.12, dustOp: 0.4, nebulaOp: 0.12, fbStars: 90 },
  },
  jade: {
    accent: 0xc6a76a, accent2: 0x83c9a0, star: 0xd2e9d5, nebula: [0x477c65, 0x2e5c48, 0xc6a76a], label: '#F0F2E8',
    stars: { a: { n: 420, size: 0.55, op: 0.55 }, b: { n: 150, size: 0.9, op: 0.6 }, starB: 0xd2e9d5, twinkle: 0.18, dustOp: 0.45, nebulaOp: 0.12, fbStars: 100 },
  },
  paper: {
    accent: 0xa27a3f, accent2: 0xb96b5d, star: 0x8a6a3a, nebula: [0xd9c9a3, 0xcbb489, 0xb96b5d], label: '#30291F',
    stars: { a: { n: 0, size: 0.5, op: 0 }, b: { n: 0, size: 0.85, op: 0 }, starB: 0x8a6a3a, twinkle: 0, dustOp: 0.12, nebulaOp: 0.05, fbStars: 0 },
  },
};

function themeHex(t: Theme3D): { accent: string; accent2: string; ink: string } {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  return { accent: hex(t.accent), accent2: hex(t.accent2), ink: t.label };
}

export default function Chart3DBackground({ skin }: { skin: Skin }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ setTheme: (s: Skin) => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let theme = THEMES[skin] ?? THEMES.zijin;
    let selected = 0;
    let raf = 0;
    let disposed = false;
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(v: T): T => {
      disposables.push(v);
      return v;
    };

    /* ---------- 2D 回退：无 WebGL 时画同心圆 + 宫位节点 + 宫名 ---------- */
    const fallback2D = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const draw = () => {
        if (disposed) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (!w || !h) {
          raf = requestAnimationFrame(draw);
          return;
        }
        if (canvas.width !== w * 2) {
          canvas.width = w * 2;
          canvas.height = h * 2;
        }
        ctx.setTransform(2, 0, 0, 2, 0, 0);
        const { accent, accent2, ink } = themeHex(theme);
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) * 0.36;
        const rot = performance.now() * 0.00004;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.8;
        [1, 0.68, 0.34].forEach((k) => {
          ctx.beginPath();
          ctx.arc(cx, cy, R * k, 0, 7);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
        for (let i = 0; i < theme.stars.fbStars; i++) {
          const sx = (i * 97.3) % w;
          const sy = (i * 57.7) % h;
          ctx.fillStyle = ink;
          ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
          ctx.fillRect(sx, sy, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
        for (let n = 0; n < 12; n++) {
          const a = Math.PI / 2 - (n / 12) * Math.PI * 2 + rot;
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          ctx.beginPath();
          ctx.arc(x, y, n === selected ? 9 : 6, 0, 7);
          ctx.fillStyle = n === selected ? accent : accent2;
          ctx.fill();
          ctx.font = "600 13px 'Noto Serif SC', serif";
          ctx.fillStyle = ink;
          ctx.textAlign = 'center';
          ctx.fillText(PALACE_NAMES[n], cx + Math.cos(a) * (R + 24), cy + Math.sin(a) * (R + 24) + 4);
        }
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, 7);
        ctx.fillStyle = accent;
        ctx.fill();
        raf = requestAnimationFrame(draw);
      };
      draw();
      apiRef.current = {
        setTheme: (s: Skin) => {
          theme = THEMES[s] ?? THEMES.zijin;
        },
      };
    };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      fallback2D();
      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        apiRef.current = null;
      };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);
    camera.position.set(0, 2.5, 31);

    const glowTexture = (): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
      }
      return track(new THREE.CanvasTexture(c));
    };
    const glowTex = glowTexture();
    // 方形像素贴图：赛博皮肤的星点用方形像素，带轻微数字感
    const squareTexture = (): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = 'rgba(255,255,255,1)';
        g.fillRect(14, 14, 36, 36);
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(8, 8, 48, 48);
      }
      return track(new THREE.CanvasTexture(c));
    };
    const squareTex = squareTexture();
    // 星野随皮肤变：数量（drawRange）、大小、透明度、闪烁幅度、亮星颜色、方形像素
    let starBaseA = 0.95;
    let starBaseB = 0.95;
    let starTwinkle = 0.28;
    const applyStarLayers = (t: Theme3D, name: Skin) => {
      const cfg = t.stars;
      starsA.geo.setDrawRange(0, cfg.a.n);
      starsA.mat.size = cfg.a.size;
      starsA.mat.color.set(t.star);
      starsA.mat.map = name === 'cyber' ? squareTex : glowTex;
      starsA.mat.needsUpdate = true;
      starsA.pts.visible = cfg.a.n > 0;
      starsB.geo.setDrawRange(0, cfg.b.n);
      starsB.mat.size = cfg.b.size;
      starsB.mat.color.set(cfg.starB);
      starsB.mat.map = name === 'cyber' ? squareTex : glowTex;
      starsB.mat.needsUpdate = true;
      starsB.pts.visible = cfg.b.n > 0;
      starBaseA = cfg.a.op;
      starBaseB = cfg.b.op;
      starTwinkle = cfg.twinkle;
      starsA.mat.opacity = starBaseA;
      starsB.mat.opacity = starBaseB;
    };

    /* ---- 背景星野 ---- */
    const makeStars = (count: number, rMin: number, rMax: number, size: number) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
        pos[i * 3 + 2] = r * Math.cos(ph) - 18;
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = track(
        new THREE.PointsMaterial({
          size,
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: theme.star,
          opacity: 0.9,
        }),
      );
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return { pts, mat, geo };
    };
    const starsA = makeStars(800, 26, 70, 0.55);
    const starsB = makeStars(340, 20, 55, 0.95);
    applyStarLayers(theme, skin);

    /* ---- 星云 ---- */
    const nebulas: THREE.SpriteMaterial[] = [];
    [
      [-16, 7, -22, 34],
      [17, -6, -26, 40],
      [4, 13, -30, 30],
      [-8, -13, -24, 26],
    ].forEach((cfg, i) => {
      const mat = track(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: theme.nebula[i % 3],
          opacity: theme.stars.nebulaOp,
        }),
      );
      const sp = new THREE.Sprite(mat);
      sp.position.set(cfg[0], cfg[1], cfg[2]);
      sp.scale.set(cfg[3], cfg[3], 1);
      scene.add(sp);
      nebulas.push(mat);
    });

    /* ---- 星盘主体 ---- */
    const rig = new THREE.Group();
    rig.position.y = 1.5;
    scene.add(rig);
    const tilt = new THREE.Group();
    tilt.rotation.x = -0.88;
    rig.add(tilt);
    const spin = new THREE.Group();
    tilt.add(spin);
    const R = 10;

    const ringMat = track(
      new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.85 }),
    );
    const ring2Mat = track(
      new THREE.MeshBasicMaterial({ color: theme.accent2, transparent: true, opacity: 0.5 }),
    );
    const ring1 = new THREE.Mesh(track(new THREE.TorusGeometry(R, 0.07, 10, 128)), ringMat);
    spin.add(ring1);
    const ring2 = new THREE.Mesh(track(new THREE.TorusGeometry(R * 0.68, 0.045, 10, 110)), ring2Mat);
    spin.add(ring2);
    const ring3Mat = track(ringMat.clone());
    const ring3 = new THREE.Mesh(track(new THREE.TorusGeometry(R * 0.34, 0.04, 10, 80)), ring3Mat);
    spin.add(ring3);

    /* 宫位分隔线 */
    const divPts: THREE.Vector3[] = [];
    for (let d = 0; d < 12; d++) {
      const a = (d / 12) * Math.PI * 2 + Math.PI / 12;
      divPts.push(new THREE.Vector3(Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, 0));
      divPts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0));
    }
    const divGeo = track(new THREE.BufferGeometry().setFromPoints(divPts));
    const divMat = track(
      new THREE.LineBasicMaterial({ color: theme.accent2, transparent: true, opacity: 0.4 }),
    );
    spin.add(new THREE.LineSegments(divGeo, divMat));

    /* 盘内浮尘 */
    const dustGeo = track(new THREE.BufferGeometry());
    const dustPos = new Float32Array(240 * 3);
    for (let j = 0; j < 240; j++) {
      const rr = Math.sqrt(Math.random()) * R * 0.95;
      const aa = Math.random() * Math.PI * 2;
      dustPos[j * 3] = Math.cos(aa) * rr;
      dustPos[j * 3 + 1] = Math.sin(aa) * rr;
      dustPos[j * 3 + 2] = (Math.random() - 0.5) * 0.7;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = track(
      new THREE.PointsMaterial({
        size: 0.32,
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: theme.accent,
        opacity: theme.stars.dustOp,
      }),
    );
    spin.add(new THREE.Points(dustGeo, dustMat));

    /* 宫名标签 */
    const makeLabel = (text: string): THREE.Sprite => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 112;
      const g = c.getContext('2d');
      if (g) {
        g.font = "900 62px 'Noto Serif SC', serif";
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,.55)';
        g.shadowBlur = 10;
        g.fillStyle = theme.label;
        g.fillText(text, 128, 58);
      }
      const tex = track(new THREE.CanvasTexture(c));
      const sp = new THREE.Sprite(
        track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })),
      );
      sp.scale.set(3.3, 1.45, 1);
      return sp;
    };

    /* 十二宫节点 */
    const nodes: THREE.Mesh[] = [];
    const nodeMats: THREE.MeshBasicMaterial[] = [];
    const glowSprites: THREE.Sprite[] = [];
    const labelSprites: THREE.Sprite[] = [];
    const nodeGeo = track(new THREE.SphereGeometry(0.52, 24, 24));
    for (let n = 0; n < 12; n++) {
      const ang = Math.PI / 2 - (n / 12) * Math.PI * 2; // 命宫在顶部，逆时针排布
      const x = Math.cos(ang) * R;
      const y = Math.sin(ang) * R;
      const mat = track(new THREE.MeshBasicMaterial({ color: theme.accent2 }));
      const m = new THREE.Mesh(nodeGeo, mat);
      m.position.set(x, y, 0);
      m.userData.idx = n;
      spin.add(m);
      nodes.push(m);
      nodeMats.push(mat);
      const gs = new THREE.Sprite(
        track(
          new THREE.SpriteMaterial({
            map: glowTex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            color: theme.accent2,
            opacity: 0.75,
          }),
        ),
      );
      gs.scale.set(3.1, 3.1, 1);
      gs.position.set(x, y, -0.2);
      spin.add(gs);
      glowSprites.push(gs);
      const lb = makeLabel(PALACE_NAMES[n]);
      lb.position.set(Math.cos(ang) * (R + 1.7), Math.sin(ang) * (R + 1.7), 0);
      tilt.add(lb);
      labelSprites.push(lb);
    }

    /* 中宫核心 */
    const coreGroup = new THREE.Group();
    tilt.add(coreGroup);
    const coreMat = track(
      new THREE.MeshBasicMaterial({ color: theme.accent, wireframe: true, transparent: true, opacity: 0.85 }),
    );
    const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.85, 1)), coreMat);
    coreGroup.add(core);
    const coreInnerMat = track(
      new THREE.MeshBasicMaterial({ color: theme.accent2, transparent: true, opacity: 0.9 }),
    );
    const coreInner = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 20, 20)), coreInnerMat);
    coreGroup.add(coreInner);
    const coreGlow = new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: theme.accent,
          opacity: 0.8,
        }),
      ),
    );
    coreGlow.scale.set(7.5, 7.5, 1);
    coreGroup.add(coreGlow);

    /* 三方四正连线（盘面内） */
    const linkMat = track(
      new THREE.LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.95 }),
    );
    const linkGeo = track(new THREE.BufferGeometry());
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 2 * 3), 3));
    const linkLines = new THREE.LineSegments(linkGeo, linkMat);
    linkLines.position.z = 0.25;
    spin.add(linkLines);
    const updateLinkLines = (sel: number) => {
      const idxs = [sel, (sel + 4) % 12, (sel + 8) % 12, (sel + 6) % 12];
      const pairs: Array<[number, number]> = [
        [0, 1],
        [1, 3],
        [3, 2],
        [2, 0],
        [0, 3],
      ];
      const arr = (linkGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      pairs.forEach((pr, k) => {
        const A = nodes[idxs[pr[0]]].position;
        const B = nodes[idxs[pr[1]]].position;
        arr[k * 6] = A.x;
        arr[k * 6 + 1] = A.y;
        arr[k * 6 + 2] = 0;
        arr[k * 6 + 3] = B.x;
        arr[k * 6 + 4] = B.y;
        arr[k * 6 + 5] = 0;
      });
      linkGeo.attributes.position.needsUpdate = true;
    };

    const selectNode = (sel: number) => {
      selected = sel;
      updateLinkLines(sel);
      nodeMats.forEach((mat, j) => {
        const linked = j === (sel + 4) % 12 || j === (sel + 8) % 12 || j === (sel + 6) % 12;
        if (j === sel) mat.color.set(theme.accent);
        else if (linked) mat.color.set(theme.accent2);
        else mat.color.set(theme.star);
        glowSprites[j].material.color.set(j === sel ? theme.accent : linked ? theme.accent2 : theme.star);
        glowSprites[j].material.opacity = j === sel ? 1 : linked ? 0.8 : 0.35;
        nodes[j].userData.targetScale = j === sel ? 1.65 : linked ? 1.25 : 1;
      });
    };

    /* ---- 交互：拖拽 / 点击 / 缩放 ---- */
    let baseZ = 31;
    let zoomDelta = 0;
    let autoRotate = !reducedMotion;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let velY = 0;
    let velX = 0;
    const pointers: Record<number, { x: number; y: number }> = {};
    let pinchDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 2) {
        const ps = Object.values(pointers);
        pinchDist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        dragging = false;
      } else {
        dragging = true;
        moved = 0;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 2) {
        const ps2 = Object.values(pointers);
        const dNow = Math.hypot(ps2[0].x - ps2[1].x, ps2[0].y - ps2[1].y);
        if (pinchDist > 0) {
          zoomDelta = Math.max(-9, Math.min(14, zoomDelta + (pinchDist - dNow) * 0.03));
          camera.position.z = baseZ + zoomDelta;
        }
        pinchDist = dNow;
        moved += 10;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX;
      lastY = e.clientY;
      rig.rotation.y += dx * 0.006;
      rig.rotation.x += dy * 0.004;
      rig.rotation.x = Math.max(-0.55, Math.min(0.55, rig.rotation.x));
      velY = dx * 0.006;
      velX = dy * 0.004;
    };
    const endDrag = (e: PointerEvent) => {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchDist = 0;
      if (!dragging) return;
      dragging = false;
      if (moved < 7) {
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObjects(nodes);
        if (hits.length) {
          selectNode((hits[0].object as THREE.Mesh).userData.idx as number);
        }
      }
    };
    const onPointerCancel = (e: PointerEvent) => {
      delete pointers[e.pointerId];
      pinchDist = 0;
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomDelta = Math.max(-9, Math.min(14, zoomDelta + e.deltaY * 0.02));
      camera.position.z = baseZ + zoomDelta;
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    /* ---- 对外接口：皮肤切换换材质色 + 星野配置 ---- */
    apiRef.current = {
      setTheme: (name: Skin) => {
        theme = THEMES[name] ?? THEMES.zijin;
        renderer.setClearColor(theme.accent, 0);
        ringMat.color.set(theme.accent);
        ring2Mat.color.set(theme.accent2);
        ring3Mat.color.set(theme.accent);
        divMat.color.set(theme.accent2);
        dustMat.color.set(theme.accent);
        applyStarLayers(theme, name);
        nebulas.forEach((m, i) => {
          m.color.set(theme.nebula[i % 3]);
          m.opacity = theme.stars.nebulaOp;
        });
        dustMat.opacity = theme.stars.dustOp;
        coreMat.color.set(theme.accent);
        coreInnerMat.color.set(theme.accent2);
        coreGlow.material.color.set(theme.accent);
        linkMat.color.set(theme.accent);
        labelSprites.forEach((lb, i) => {
          tilt.remove(lb);
          lb.material.map?.dispose();
          lb.material.dispose();
          const fresh = makeLabel(PALACE_NAMES[i]);
          fresh.position.copy(lb.position);
          tilt.add(fresh);
          labelSprites[i] = fresh;
        });
        selectNode(selected);
      },
    };
    renderer.setClearColor(theme.accent, 0);
    selectNode(0);

    /* ---- 尺寸（按较小一边视场反推距离，横竖屏都让星盘连宫名完整入画） ---- */
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      baseZ = (R + 2.9) / Math.tan(Math.min(vFov, hFov) / 2);
      camera.position.z = baseZ + zoomDelta;
      camera.updateProjectionMatrix();
    };
    const onOrientation = () => {
      window.setTimeout(resize, 60);
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', onOrientation);
    resize();

    /* ---- 主循环 ---- */
    const clock = new THREE.Clock();
    const bornAt = performance.now();
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const now = performance.now();
      if (autoRotate && !dragging) spin.rotation.z -= 0.0016;
      if (!dragging && Math.abs(velY) > 0.0001) {
        rig.rotation.y += velY;
        rig.rotation.x += velX;
        rig.rotation.x = Math.max(-0.55, Math.min(0.55, rig.rotation.x));
        velY *= 0.94;
        velX *= 0.94;
      }
      rig.rotation.y += Math.sin(t * 0.12) * 0.00035;
      core.rotation.y = t * 0.5;
      core.rotation.x = t * 0.22;
      coreInner.scale.setScalar(1 + Math.sin(t * 2.2) * 0.13);
      coreGlow.material.opacity = 0.62 + Math.sin(t * 1.7) * 0.16;
      starsA.pts.rotation.z = t * 0.004;
      starsB.pts.rotation.z = -t * 0.003;
      if (!reducedMotion && starTwinkle > 0) {
        starsA.mat.opacity = starBaseA * (1 + starTwinkle * Math.sin(t * 1.4));
        starsB.mat.opacity = starBaseB * (1 + starTwinkle * Math.sin(t * 1.1 + 2.1));
      }
      nodes.forEach((m, j) => {
        const appear = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - bornAt - j * 95) / 420));
        const ease = 1 - Math.pow(1 - appear, 3);
        const target =
          ((m.userData.targetScale as number | undefined) ?? 1) *
          (j === selected ? 1 + Math.sin(t * 2.6) * 0.09 : 1);
        const s = Math.max(0.001, ease * target);
        m.scale.setScalar(s);
        glowSprites[j].scale.setScalar(3.1 * Math.max(0.2, ease) * (j === selected ? 1.35 : 1));
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      autoRotate = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', onOrientation);
      renderer.dispose();
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          /* 忽略已释放资源的重复 dispose */
        }
      });
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.setTheme(skin);
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full z-[1]"
      style={{ touchAction: 'none', cursor: 'grab' }}
      aria-label="紫微命盘 3D 星盘背景，可拖拽旋转"
    />
  );
}
