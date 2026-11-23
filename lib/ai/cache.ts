// AI 解读结果磁盘缓存：同一组请求只调一次 DeepSeek，命中直接回上次结果。
// 只包在解读接口外面，不动任何 DeepSeek 调用逻辑。
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.join(process.cwd(), '.ai-cache', 'interpret');
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/** 对请求内容做哈希：完全相同的请求才命中，不同样本不撞 key。 */
export function cacheKey(parts: string[]): string {
  const h = createHash('sha256');
  h.update(['ai-cache-v1', ...parts].join('\n'));
  return h.digest('hex');
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, `${key}.json`), 'utf-8');
    const data = JSON.parse(raw) as { createdAt: number; text: string };
    if (!data || typeof data.text !== 'string' || typeof data.createdAt !== 'number') return null;
    if (Date.now() - data.createdAt > TTL_MS) {
      await fs.unlink(path.join(CACHE_DIR, `${key}.json`)).catch(() => {});
      return null;
    }
    return data.text;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, text: string): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const tmp = path.join(CACHE_DIR, `${key}.tmp-${process.pid}`);
    await fs.writeFile(tmp, JSON.stringify({ createdAt: Date.now(), text }));
    await fs.rename(tmp, path.join(CACHE_DIR, `${key}.json`));
  } catch (e) {
    console.error('[ai-cache] write failed', e);
  }
}

/** 把一段完整解读文本包成前端能读的 SSE（与 DeepSeek 流同一格式）。 */
export function sseFromText(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\ndata: [DONE]\n\n`;
}
