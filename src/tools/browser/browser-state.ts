import { chromium, type Browser, type Page } from 'playwright';
import { formatToolResult } from '../types.js';

let browser: Browser | null = null;
let page: Page | null = null;

let currentRefs: Map<string, { role: string; name?: string; nth?: number }> = new Map();

interface SnapshotForAIResult {
  full?: string;
}

interface PageWithSnapshotForAI extends Page {
  _snapshotForAI?: (opts: { timeout: number; track: string }) => Promise<SnapshotForAIResult>;
}

/** Ensure browser and page are initialized. Lazily launches headless Chromium. */
export async function ensureBrowser(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({ headless: false });
  }
  if (!page) {
    const context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

export function setActivePage(p: Page): void {
  page = p;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    currentRefs.clear();
  }
}

export function getRefCount(): number {
  return currentRefs.size;
}

export function getRefsObject(): Record<string, { role: string; name?: string; nth?: number }> {
  return Object.fromEntries(currentRefs);
}

/** Parse refs from the AI snapshot format. Extracts [ref=eN] patterns. */
function parseRefsFromSnapshot(snapshot: string): Map<string, { role: string; name?: string; nth?: number }> {
  const refs = new Map<string, { role: string; name?: string; nth?: number }>();

  for (const line of snapshot.split('\n')) {
    const refMatch = line.match(/\[ref=(e\d+)\]/);
    if (!refMatch) continue;

    const ref = refMatch[1];
    const roleMatch = line.match(/^\s*-\s*(\w+)/);
    const role = roleMatch ? roleMatch[1] : 'generic';
    const nameMatch = line.match(/"([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : undefined;
    const nthMatch = line.match(/\[nth=(\d+)\]/);
    const nth = nthMatch ? parseInt(nthMatch[1], 10) : undefined;

    refs.set(ref, { role, name, nth });
  }

  return refs;
}

/** Resolve a ref to a Playwright locator using stored ref data. */
export function resolveRefToLocator(p: Page, ref: string): ReturnType<Page['locator']> {
  const refData = currentRefs.get(ref);

  if (!refData) {
    return p.locator(`aria-ref=${ref}`);
  }

  const options: { name?: string | RegExp; exact?: boolean } = {};
  if (refData.name) {
    options.name = refData.name;
    options.exact = true;
  }

  let locator = p.getByRole(refData.role as Parameters<Page['getByRole']>[0], options);

  if (typeof refData.nth === 'number' && refData.nth > 0) {
    locator = locator.nth(refData.nth);
  }

  return locator;
}

/** Take an AI-optimized snapshot. Falls back to ariaSnapshot if _snapshotForAI unavailable. */
export async function takeSnapshot(p: Page, maxChars?: number): Promise<{ snapshot: string; truncated: boolean }> {
  const pageWithSnapshot = p as PageWithSnapshotForAI;

  let snapshot: string;

  if (pageWithSnapshot._snapshotForAI) {
    const result = await pageWithSnapshot._snapshotForAI({ timeout: 10000, track: 'response' });
    snapshot = String(result?.full ?? '');
  } else {
    snapshot = await p.locator(':root').ariaSnapshot();
  }

  currentRefs = parseRefsFromSnapshot(snapshot);

  let truncated = false;
  const limit = maxChars ?? 50000;
  if (snapshot.length > limit) {
    snapshot = `${snapshot.slice(0, limit)}\n\n[...TRUNCATED - page too large, use read action for full text]`;
    truncated = true;
  }

  return { snapshot, truncated };
}

export function fmt(data: unknown): string {
  return formatToolResult(data);
}
