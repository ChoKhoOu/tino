import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import {
  ensureBrowser,
  setActivePage,
  closeBrowser,
  takeSnapshot,
  resolveRefToLocator,
  getRefCount,
  getRefsObject,
  fmt,
} from './browser-state.js';

const actRequestSchema = z.object({
  kind: z.enum(['click', 'type', 'press', 'hover', 'scroll', 'wait']).describe('The type of interaction'),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e12)'),
  text: z.string().optional().describe('Text for type action'),
  key: z.string().optional().describe('Key for press action (e.g., Enter, Tab)'),
  direction: z.enum(['up', 'down']).optional().describe('Scroll direction'),
  timeMs: z.number().optional().describe('Wait time in milliseconds'),
});

const schema = z.object({
  action: z.enum(['navigate', 'open', 'snapshot', 'act', 'read', 'close']).describe('The browser action to perform'),
  url: z.string().optional().describe('URL for navigate action'),
  maxChars: z.number().optional().describe('Max characters for snapshot (default 50000)'),
  request: actRequestSchema.optional().describe('Request object for act action'),
});

async function handleAct(request: z.infer<typeof actRequestSchema>): Promise<string> {
  const p = await ensureBrowser();
  const { kind, ref, text, key, direction, timeMs } = request;

  switch (kind) {
    case 'click': {
      if (!ref) return fmt({ error: 'ref is required for click' });
      const locator = resolveRefToLocator(p, ref);
      await locator.click({ timeout: 8000 });
      await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return fmt({ ok: true, clicked: ref, hint: 'Click successful. Call snapshot to see the updated page.' });
    }
    case 'type': {
      if (!ref) return fmt({ error: 'ref is required for type' });
      if (!text) return fmt({ error: 'text is required for type' });
      const locator = resolveRefToLocator(p, ref);
      await locator.fill(text, { timeout: 8000 });
      return fmt({ ok: true, ref, typed: text });
    }
    case 'press': {
      if (!key) return fmt({ error: 'key is required for press' });
      await p.keyboard.press(key);
      await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      return fmt({ ok: true, pressed: key });
    }
    case 'hover': {
      if (!ref) return fmt({ error: 'ref is required for hover' });
      const locator = resolveRefToLocator(p, ref);
      await locator.hover({ timeout: 8000 });
      return fmt({ ok: true, hovered: ref });
    }
    case 'scroll': {
      const scrollDirection = direction ?? 'down';
      await p.mouse.wheel(0, scrollDirection === 'down' ? 500 : -500);
      await p.waitForTimeout(500);
      return fmt({ ok: true, scrolled: scrollDirection });
    }
    case 'wait': {
      const waitTime = Math.min(timeMs ?? 2000, 10000);
      await p.waitForTimeout(waitTime);
      return fmt({ ok: true, waited: waitTime });
    }
    default:
      return fmt({ error: `Unknown act kind: ${kind}` });
  }
}

export default definePlugin({
  id: 'browser',
  domain: 'browser',
  riskLevel: 'safe',
  description:
    'Navigate websites, read content, and interact with pages. Use for accessing company websites, earnings reports, and dynamic content.',
  schema,
  execute: async (raw) => {
    const { action, url, maxChars, request } = schema.parse(raw);

    try {
      switch (action) {
        case 'navigate': {
          if (!url) return fmt({ error: 'url is required for navigate action' });
          const p = await ensureBrowser();
          await p.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
          return fmt({ ok: true, url: p.url(), title: await p.title(), hint: 'Page loaded. Call snapshot to see page structure and find elements to interact with.' });
        }
        case 'open': {
          if (!url) return fmt({ error: 'url is required for open action' });
          const currentPage = await ensureBrowser();
          const newPage = await currentPage.context().newPage();
          await newPage.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
          setActivePage(newPage);
          return fmt({ ok: true, url: newPage.url(), title: await newPage.title(), hint: 'New tab opened. Call snapshot to see page structure and find elements to interact with.' });
        }
        case 'snapshot': {
          const p = await ensureBrowser();
          await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          const { snapshot, truncated } = await takeSnapshot(p, maxChars);
          return fmt({ url: p.url(), title: await p.title(), snapshot, truncated, refCount: getRefCount(), refs: getRefsObject(), hint: 'Use act with kind="click" and ref="eN" to click elements.' });
        }
        case 'act': {
          if (!request) return fmt({ error: 'request is required for act action' });
          return handleAct(request);
        }
        case 'read': {
          const p = await ensureBrowser();
          await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          const content = await p.evaluate(() => {
            const main = document.querySelector('main, article, [role="main"], .content, #content') as HTMLElement | null;
            return (main || document.body).innerText;
          });
          return fmt({ url: p.url(), title: await p.title(), content });
        }
        case 'close': {
          await closeBrowser();
          return fmt({ ok: true, message: 'Browser closed' });
        }
        default:
          return fmt({ error: `Unknown action: ${action}` });
      }
    } catch (err) {
      return fmt({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});
