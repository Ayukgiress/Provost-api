import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@provost/common';

const require = createRequire(import.meta.url);
const parsePdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();
const domainLastRequest = new Map<string, number>();

export interface FetchedPage {
  text: string;
  hash: string;
  links: string[];
  contentType: string;
}

function assertSafeHttpUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only public HTTP(S) source URLs are permitted.');
  }
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(url.hostname)) {
    throw new Error('Private or local network hosts cannot be scraped.');
  }
  return url;
}

async function respectRobots(url: URL, userAgent: string, timeoutMs: number): Promise<void> {
  const origin = url.origin;
  let rules = robotsCache.get(origin);
  if (!rules) {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (response.status === 401 || response.status === 403) throw new Error(`robots.txt denied access (${response.status})`);
    if (!response.ok && response.status !== 404) throw new Error(`robots.txt returned HTTP ${response.status}`);
    rules = robotsParser(`${origin}/robots.txt`, response.ok ? await response.text() : '');
    robotsCache.set(origin, rules);
  }
  if (rules.isAllowed(url.href, userAgent) === false) throw new Error(`Scraping disallowed by robots.txt for ${url.pathname}`);
}

async function rateLimit(host: string, delayMs: number): Promise<void> {
  const now = Date.now();
  const nextAt = Math.max(now, domainLastRequest.get(host) ?? now);
  domainLastRequest.set(host, nextAt + delayMs);
  const wait = nextAt - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function fetchPage(
  rawUrl: string,
  needsBrowser: boolean,
  config: ConfigService<Env, true>,
): Promise<FetchedPage> {
  const url = assertSafeHttpUrl(rawUrl);
  const timeoutMs = config.get('SCRAPER_TIMEOUT_MS', { infer: true });
  const userAgent = `${config.get('SCRAPER_USER_AGENT', { infer: true })} (+mailto:${config.get('SCRAPER_CONTACT_EMAIL', { infer: true })})`;
  await rateLimit(url.hostname, config.get('SCRAPER_DOMAIN_DELAY_MS', { infer: true }));
  await respectRobots(url, userAgent, timeoutMs);

  let bytes: Buffer;
  let contentType: string;
  if (needsBrowser) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ userAgent });
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      const html = await page.content();
      bytes = Buffer.from(html);
      contentType = 'text/html';
    } finally {
      await browser.close();
    }
  } else {
    const response = await fetch(url.href, {
      headers: { 'user-agent': userAgent, accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 20 * 1024 * 1024) throw new Error('Source response exceeds 20 MiB limit');
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('Source response exceeds 20 MiB limit');
    contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  }

  let text: string;
  let links: string[] = [];
  if (contentType.includes('pdf') || bytes.subarray(0, 4).toString() === '%PDF') {
    text = (await parsePdf(bytes)).text;
  } else {
    const $ = cheerio.load(bytes.toString('utf8'));
    $('script, style, noscript, svg, canvas, nav, footer, header, aside, form, iframe').remove();
    links = $('a[href]')
      .map((_, element) => {
        try {
          return new URL($(element).attr('href') ?? '', url).href;
        } catch {
          return null;
        }
      })
      .get()
      .filter((link): link is string => typeof link === 'string');
    text = $('body').text().replace(/[\t\f\v ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (!text) throw new Error('No readable text was extracted from source');
  const hash = createHash('sha256').update(text).digest('hex');
  return { text, hash, links, contentType };
}

export function opportunityLinks(links: string[], sourceUrl: string): string[] {
  const source = new URL(sourceUrl);
  const matched = new Set<string>();
  for (const link of links) {
    try {
      const url = new URL(link);
      if (url.hostname !== source.hostname || !['http:', 'https:'].includes(url.protocol)) continue;
      if (/scholarship|fellowship|grant|funding|opportunit|award| bursary/i.test(`${url.pathname} ${url.search}`)) {
        url.hash = '';
        matched.add(url.href);
      }
    } catch {
      // Ignore malformed links.
    }
  }
  return matched.size ? [...matched] : [source.href];
}
