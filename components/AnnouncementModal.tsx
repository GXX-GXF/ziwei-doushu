'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 公告版本号——以后想再弹新公告，改这里就行（旧版 key 失效，新版重新弹一次）
const ANNOUNCEMENT_VERSION = '2026-05-01';
const STORAGE_KEY = `announcement_seen_${ANNOUNCEMENT_VERSION}`;

export default function AnnouncementModal() {
  // 默认不开，client 端 useEffect 检查 localStorage 后立即决定是否弹出。
  // 没看过 → 立即覆盖首页；看过 → 不再弹。
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState(false); // hydration 完成标志

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch { /* localStorage 可能被禁，忽略 */ }
    setDecided(true);
  }, []);

  // 公告打开时锁住 body 滚动，防止背后首页可滚（仪式感更强）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* skip */ }
  };

  if (!decided) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          // 不点击外部关闭——强制用户按"我知道了"按钮才能进入首页
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(6,2,15,0.88)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--t-card)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: 'min(85vh, 760px)',
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px -10px color-mix(in srgb, var(--ac) 40%, transparent)',
              border: '1px solid var(--t-border)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
            }}
          >
            {/* 顶部装饰 + 关闭按钮 */}
            <div style={{
              padding: '22px 28px 14px',
              borderBottom: '1px solid color-mix(in srgb, var(--ac) 25%, transparent)',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--ac) 8%, transparent) 0%, transparent 100%)',
              flexShrink: 0,
              position: 'relative',
            }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.4em', color: 'var(--ac)', opacity: 0.7, marginBottom: '6px' }}>
                A LETTER TO USERS
              </div>
              <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--ac)', letterSpacing: '0.08em', margin: 0 }}>
                致正在使用这个平台的你
              </h2>
              <button
                onClick={close}
                aria-label="关闭"
                style={{
                  position: 'absolute', top: '14px', right: '16px',
                  width: '28px', height: '28px',
                  background: 'color-mix(in srgb, var(--ac) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--ac) 30%, transparent)',
                  borderRadius: '50%',
                  color: 'var(--ac)', fontSize: '14px',
                  cursor: 'pointer', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* 限时免费 banner（最关键信息，置顶强调）*/}
            <div style={{
              margin: '14px 22px 0',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(157,107,255,0.14) 0%, color-mix(in srgb, var(--ac) 10%, transparent) 100%)',
              border: '1.5px dashed color-mix(in srgb, var(--ac) 50%, transparent)',
              borderRadius: '12px',
              flexShrink: 0,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'var(--ac)', marginBottom: '4px', fontWeight: 600 }}>
                LIMITED TIME · 限时回馈
              </div>
              <div style={{ fontSize: '14px', color: '#efe9dc', fontWeight: 600, lineHeight: 1.6 }}>
                <span style={{ fontSize: '16px', color: 'var(--ac)', fontWeight: 700 }}>5 月 1 日 — 5 月 8 日</span>
                <br />
                平台全部功能 + AI 提问 全部免费开放
              </div>
            </div>

            {/* 正文（可滚动）*/}
            <div style={{
              padding: '18px 28px 24px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: 1.85,
              color: '#efe9dc',
              flex: 1,
            }}>
              <p style={{ margin: '0 0 12px' }}>
                说实话，我真的没想到会有这么大的流量。
              </p>
              <p style={{ margin: '0 0 12px' }}>
                最开始做这个平台，我的初心其实很简单：在 AI 时代，把倪师这套原本复杂、门槛很高的体系，尽量做得更简单、更高效、更容易理解。
              </p>
              <p style={{ margin: '0 0 12px' }}>
                不一定每个人都要先学很久、看很多书，才能接触这些内容。我们希望通过这个平台，让大家用更轻松的方式，获得一些对自我、人生阶段、选择方向的参考和启发。
              </p>
              <p style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                background: 'color-mix(in srgb, var(--ac) 8%, transparent)',
                borderLeft: '3px solid color-mix(in srgb, var(--ac) 50%, transparent)',
                borderRadius: '0 8px 8px 0',
                fontStyle: 'italic',
                color: 'color-mix(in srgb, var(--ac) 85%, transparent)',
              }}>
                倪师曾说过一句话：人怎么可能发明出完全没有用的东西呢？
              </p>
              <p style={{ margin: '0 0 12px' }}>
                我一直觉得，易经如此，紫微斗数也是如此。它们真正有价值的地方，不是让人被某个结果困住，而是让我们更早看见自己的性格惯性、人生课题和选择方向。看见之后，才有机会调整；理解之后，才有机会变得更好。
              </p>
              <p style={{ margin: '0 0 12px' }}>
                至于那些说&ldquo;你当下在看这些，其实也是命运的一部分&rdquo;之类的话，我就不多评价了。
              </p>
              <p style={{ margin: '0 0 12px' }}>
                这几天账号被小红书抬走了，<strong style={{ color: 'var(--ac)' }}>5 月 3 号开始恢复正常更新。</strong>
              </p>
              <p style={{ margin: '0 0 16px', color: 'var(--ac)', fontWeight: 500 }}>
                最后，真心祝愿大家都能越来越了解自己，越来越爱自己，也越来越有能力爱身边的人。
              </p>
              <p style={{ margin: 0, textAlign: 'right', fontSize: '13px', color: 'color-mix(in srgb, var(--ac) 80%, transparent)' }}>
                ——谢谢大家 🙏
              </p>
            </div>

            {/* 底部按钮 */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid color-mix(in srgb, var(--ac) 25%, transparent)',
              background: 'color-mix(in srgb, var(--ac) 6%, transparent)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              flexShrink: 0,
            }}>
              <button
                onClick={close}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #b8860b 0%, #f6d47c 55%, var(--ac) 100%)',
                  color: '#1a0f00',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px color-mix(in srgb, var(--ac) 40%, transparent)',
                }}
              >
                我知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
