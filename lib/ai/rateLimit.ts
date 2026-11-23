// AI 解读接口每日限流：同一 IP 每天最多 20 次实际调用（缓存命中不计）。
// 计数放内存 + 落盘 JSON，重启可恢复；丢了也只是当天计数重算。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';

export const DAILY_LIMIT = 20;
export const RATE_LIMIT_MESSAGE = '今日解读次数已用完，明天再来';

const STORE_PATH = path.join(process.cwd(), '.ai-cache', 'rate-limit.json');

type Store = Record<string, Record<string, number>>; // 日期 -> IP -> 次数

let counts: Store = {};
let loaded = false;
let loadPromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 当天日期（北京时间，与用户同一天）。 */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

async function load(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = fs
      .readFile(STORE_PATH, 'utf-8')
      .then((raw) => {
        try {
          counts = JSON.parse(raw) as Store;
        } catch {
          counts = {};
        }
      })
      .catch(() => {
        counts = {};
      })
      .then(() => {
        loaded = true;
      });
  }
  return loadPromise;
}

function saveSoon(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = `${STORE_PATH}.tmp-${process.pid}`;
    fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
      .then(() => fs.writeFile(tmp, JSON.stringify(counts)))
      .then(() => fs.rename(tmp, STORE_PATH))
      .catch(() => {});
  }, 500);
}

/** 真实客户端 IP：经代理访问时取 X-Forwarded-For 的第一段。 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** 记一次实际调用。缓存命中不要调这个。 */
export async function consumeInterpretQuota(
  req: NextRequest
): Promise<{ allowed: boolean; remaining: number; ip: string }> {
  await load();
  const ip = getClientIp(req);
  const day = today();
  const dayCounts = (counts[day] ??= {});
  const used = dayCounts[ip] ?? 0;
  if (used >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0, ip };
  }
  dayCounts[ip] = used + 1;
  // 顺手清掉过期日期，文件不无限长
  for (const d of Object.keys(counts)) {
    if (d !== day) delete counts[d];
  }
  saveSoon();
  return { allowed: true, remaining: DAILY_LIMIT - (used + 1), ip };
}
