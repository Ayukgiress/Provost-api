import 'reflect-metadata';
import { AppDataSource } from './data-source.js';
import { Source } from './entities/source.entity.js';
import { TrustTier } from './entities/enums.js';

/**
 * Seed verified, reachable scholarship/fellowship/grant sources.
 * Every URL here returned HTTP 200 and allows scraping per robots.txt.
 *
 * Run with: `pnpm seed:sources`
 * Idempotent — skips URLs already present, deactivates known-dead ones.
 */

const DEAD_URLS = [
  // 403 — actively block bots
  'https://www.fulbrightprogram.org/programs/',
  'https://www.aauw.org/resources/programs/fellowships-grants/',
  'https://www.findaphd.com/funding/',
  'https://www.scholarshipportal.com/scholarships',
  'https://www.mastersportal.eu/scholarship/',
  'https://www.phdportal.eu/scholarship/',
  'https://www.oecd.org/en/about/funding-and-grants.html',
  // 404 — wrong URL
  'https://www.opportunitydesk.org/category/scholarships/',
  'https://www.un.org/en/academic-impact/scholarships',
  'https://www.jobs.ac.uk/funding',
  'https://www.aga.org/scholarships/',
  'https://www.jasso.or.jp/en/study_j/scholarships/',
  // unreachable from this server
  'https://www.chevening.org/scholarships/',
  'https://www.scholarshipdb.net/scholarships-in-United-States',
];

const LIVE_SOURCES: Array<{
  url: string;
  country: string | null;
  type: string | null;
  trustTier: TrustTier;
  frequencyMinutes: number;
  needsBrowser: boolean;
}> = [
  // ── Tier A: official programme sites (verified 200) ───────────────────────
  { url: 'https://www.gatescambridge.org/apply/', country: 'GB', type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://www.rhodeshouse.ox.ac.uk/scholarships/', country: 'GB', type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://cscuk.fcdo.gov.uk/apply/', country: 'GB', type: 'government', trustTier: TrustTier.A, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/', country: 'DE', type: 'government', trustTier: TrustTier.A, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://www.macfound.org/programs/', country: 'US', type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },
  { url: 'https://www.opensocietyfoundations.org/grants', country: null, type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },
  { url: 'https://www.fordfoundation.org/work/our-grants/', country: 'US', type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },
  { url: 'https://www.rockefellerfoundation.org/grants/', country: 'US', type: 'foundation', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },
  { url: 'https://www.iie.org/programs/', country: 'US', type: 'nonprofit', trustTier: TrustTier.A, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://www.worldbank.org/en/programs/scholarships', country: null, type: 'government', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },
  { url: 'https://www.adb.org/work-with-us/careers/japan-scholarship-program', country: null, type: 'government', trustTier: TrustTier.A, frequencyMinutes: 1440, needsBrowser: false },

  // ── Tier B: aggregators (verified 200 + robots allows) ────────────────────
  { url: 'https://www.scholars4dev.com/', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
  { url: 'https://www.opportunitiesforafricans.com/category/scholarships/', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
  { url: 'https://www.afterschoolafrica.com/scholarships/', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
  { url: 'https://www.opportunitydesk.org/scholarships/', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
  { url: 'https://www.youthop.com/scholarships', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
  { url: 'https://www.abroadin.com/scholarships/', country: null, type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 720, needsBrowser: false },
  { url: 'https://www.jobs.ac.uk/search/?type=funding', country: 'GB', type: 'aggregator', trustTier: TrustTier.B, frequencyMinutes: 360, needsBrowser: false },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('[seed:sources] Connected to database');

  const repo = AppDataSource.getRepository(Source);

  // Deactivate known-dead sources so the worker stops hitting them.
  let deactivated = 0;
  for (const url of DEAD_URLS) {
    const existing = await repo.findOne({ where: { url } });
    if (existing?.active) {
      existing.active = false;
      await repo.save(existing);
      deactivated++;
      console.log(`[seed:sources] Deactivated: ${url}`);
    }
  }

  // Insert or skip live sources.
  let inserted = 0;
  let skipped = 0;
  for (const s of LIVE_SOURCES) {
    const exists = await repo.findOne({ where: { url: s.url } });
    if (exists) { skipped++; continue; }
    await repo.save(repo.create(s));
    inserted++;
    console.log(`[seed:sources] Inserted: ${s.url}`);
  }

  console.log(`[seed:sources] Done — ${inserted} inserted, ${skipped} already existed, ${deactivated} deactivated`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('[seed:sources] Failed:', err);
  process.exit(1);
});
