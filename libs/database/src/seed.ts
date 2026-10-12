import 'reflect-metadata';
import { AppDataSource } from './data-source.js';
import { Funder } from './entities/funder.entity.js';
import { Opportunity } from './entities/opportunity.entity.js';
import {
  OpportunityStatus,
  OpportunityType,
  TrustTier,
} from './entities/enums.js';
import type { OpportunityEligibility } from './entities/opportunity.entity.js';

/**
 * Seed script — inserts 5 sample funders and 15 realistic (clearly fake)
 * sample opportunities into the database.
 *
 * Run with: `pnpm seed`
 *
 * The script is idempotent-ish: it truncates opportunities and funders
 * before inserting, so running it repeatedly gives a clean slate.
 */

interface SeedFunder {
  name: string;
  website: string | null;
  country: string | null;
  type: string | null;
  trustTier: TrustTier;
}

interface SeedOpportunity {
  title: string;
  funderName: string;
  type: OpportunityType;
  amount: string | null;
  currency: string | null;
  deadline: string | null; // YYYY-MM-DD
  eligibility: OpportunityEligibility | null;
  requirements: string | null;
  documentsNeeded: string[] | null;
  applyUrl: string | null;
  sourceUrl: string | null;
  summary: string | null;
  status: OpportunityStatus;
  trustScore: number;
  slug: string;
}

// ── 5 sample funders ───────────────────────────────────────────────────────
const funders: SeedFunder[] = [
  {
    name: 'Northgate University',
    website: 'https://northgate.example.edu',
    country: 'United States',
    type: 'university',
    trustTier: TrustTier.A,
  },
  {
    name: 'Global Scholars Foundation',
    website: 'https://globalscholars.example.org',
    country: 'Switzerland',
    type: 'foundation',
    trustTier: TrustTier.A,
  },
  {
    name: 'Meridian Research Council',
    website: 'https://meridian.example.gov',
    country: 'Canada',
    type: 'government',
    trustTier: TrustTier.B,
  },
  {
    name: 'Helix Tech Institute',
    website: 'https://helix.example.edu',
    country: 'United States',
    type: 'university',
    trustTier: TrustTier.B,
  },
  {
    name: 'Atlas Cultural Exchange',
    website: 'https://atlas.example.org',
    country: 'United Kingdom',
    type: 'nonprofit',
    trustTier: TrustTier.C,
  },
];

// ── 15 sample opportunities ────────────────────────────────────────────────
const opportunities: SeedOpportunity[] = [
  {
    title: 'Northgate Presidential Scholarship 2026',
    funderName: 'Northgate University',
    type: OpportunityType.Scholarship,
    amount: '50000.00',
    currency: 'USD',
    deadline: '2026-01-15',
    eligibility: {
      countries: ['US', 'CA'],
      levels: ['bachelor'],
      fields: ['computer science', 'engineering', 'mathematics'],
      minGpa: 3.5,
    },
    requirements:
      'Full tuition and stipend for incoming undergraduates demonstrating academic excellence and leadership.',
    documentsNeeded: ['transcript', 'essay', 'lor'],
    applyUrl: 'https://northgate.example.edu/scholarships/presidential',
    sourceUrl: 'https://northgate.example.edu/scholarships',
    summary:
      'Merit-based full-ride scholarship for high-achieving undergraduates in STEM fields.',
    status: OpportunityStatus.Published,
    trustScore: 95,
    slug: 'northgate-presidential-scholarship-2026',
  },
  {
    title: 'Global Scholars Masters Fellowship',
    funderName: 'Global Scholars Foundation',
    type: OpportunityType.Fellowship,
    amount: '35000.00',
    currency: 'USD',
    deadline: '2026-03-01',
    eligibility: {
      levels: ['master'],
      fields: ['public policy', 'international relations'],
      minExperience: 2,
      languages: ['english'],
    },
    requirements:
      'One-year fellowship for early-career professionals pursuing a masters in public policy.',
    documentsNeeded: ['transcript', 'cv', 'essay', 'lor'],
    applyUrl: 'https://globalscholars.example.org/fellowship',
    sourceUrl: 'https://globalscholars.example.org/programs',
    summary:
      'Supports emerging leaders pursuing graduate study in public policy with a living stipend and mentorship.',
    status: OpportunityStatus.Published,
    trustScore: 92,
    slug: 'global-scholars-masters-fellowship',
  },
  {
    title: 'Meridian Doctoral Research Grant',
    funderName: 'Meridian Research Council',
    type: OpportunityType.Grant,
    amount: '75000.00',
    currency: 'CAD',
    deadline: '2026-02-28',
    eligibility: {
      levels: ['phd'],
      fields: ['environmental science', 'climate studies'],
      minGpa: 3.7,
    },
    requirements:
      'Three-year research grant for PhD students conducting climate-related field research.',
    documentsNeeded: ['research-proposal', 'transcript', 'lor'],
    applyUrl: 'https://meridian.example.gov/grants/climate',
    sourceUrl: 'https://meridian.example.gov/funding',
    summary:
      'Funds doctoral research in environmental and climate science at Canadian institutions.',
    status: OpportunityStatus.Published,
    trustScore: 88,
    slug: 'meridian-doctoral-research-grant',
  },
  {
    title: 'Helix AI Research Fellowship',
    funderName: 'Helix Tech Institute',
    type: OpportunityType.Fellowship,
    amount: '60000.00',
    currency: 'USD',
    deadline: '2026-04-10',
    eligibility: {
      levels: ['phd', 'master'],
      fields: ['computer science', 'artificial intelligence'],
      minGpa: 3.5,
    },
    requirements:
      'Year-long fellowship at Helix Labs for graduate students in AI/ML.',
    documentsNeeded: ['cv', 'research-statement', 'lor'],
    applyUrl: 'https://helix.example.edu/fellowships/ai',
    sourceUrl: 'https://helix.example.edu/research/fellowships',
    summary:
      'Immersive AI research fellowship with access to Helix compute clusters and industry mentors.',
    status: OpportunityStatus.Published,
    trustScore: 85,
    slug: 'helix-ai-research-fellowship',
  },
  {
    title: 'Atlas Cultural Exchange Grant',
    funderName: 'Atlas Cultural Exchange',
    type: OpportunityType.Grant,
    amount: '5000.00',
    currency: 'GBP',
    deadline: '2026-05-20',
    eligibility: {
      countries: ['GB', 'US', 'DE', 'FR'],
      fields: ['arts', 'humanities'],
      maxAge: 35,
    },
    requirements:
      'Small grant for cross-cultural arts projects between partner countries.',
    documentsNeeded: ['project-proposal', 'budget'],
    applyUrl: 'https://atlas.example.org/grants/cultural',
    sourceUrl: 'https://atlas.example.org/opportunities',
    summary:
      'Supports grassroots cultural exchange projects in the arts and humanities.',
    status: OpportunityStatus.Published,
    trustScore: 70,
    slug: 'atlas-cultural-exchange-grant',
  },
  {
    title: 'Northgate Women in Engineering Scholarship',
    funderName: 'Northgate University',
    type: OpportunityType.Scholarship,
    amount: '25000.00',
    currency: 'USD',
    deadline: '2026-01-30',
    eligibility: {
      countries: ['US'],
      levels: ['bachelor'],
      fields: ['engineering'],
      minGpa: 3.0,
    },
    requirements:
      'Scholarship for women pursuing undergraduate engineering degrees.',
    documentsNeeded: ['transcript', 'essay', 'lor'],
    applyUrl: 'https://northgate.example.edu/scholarships/women-engineering',
    sourceUrl: 'https://northgate.example.edu/scholarships',
    summary:
      'Encourages women in engineering with tuition support and a peer mentorship program.',
    status: OpportunityStatus.Published,
    trustScore: 94,
    slug: 'northgate-women-engineering-scholarship',
  },
  {
    title: 'Global Scholars PhD Fellowship in Sustainability',
    funderName: 'Global Scholars Foundation',
    type: OpportunityType.Fellowship,
    amount: '40000.00',
    currency: 'USD',
    deadline: '2026-06-01',
    eligibility: {
      levels: ['phd'],
      fields: ['sustainability', 'environmental science'],
      languages: ['english', 'french', 'spanish'],
    },
    requirements:
      'International PhD fellowship for research in sustainability and green technology.',
    documentsNeeded: ['research-proposal', 'cv', 'lor', 'transcript'],
    applyUrl: 'https://globalscholars.example.org/phd-sustainability',
    sourceUrl: 'https://globalscholars.example.org/programs',
    summary:
      'Fully funded PhD fellowship for sustainability research, open to candidates worldwide.',
    status: OpportunityStatus.Published,
    trustScore: 90,
    slug: 'global-scholars-phd-sustainability',
  },
  {
    title: 'Helix Undergraduate Research Award',
    funderName: 'Helix Tech Institute',
    type: OpportunityType.Grant,
    amount: '4000.00',
    currency: 'USD',
    deadline: '2026-03-15',
    eligibility: {
      levels: ['bachelor'],
      fields: ['computer science', 'engineering'],
      minGpa: 3.2,
    },
    requirements:
      'Summer research stipend for undergraduates working on faculty-led projects.',
    documentsNeeded: ['project-proposal', 'faculty-endorsement'],
    applyUrl: 'https://helix.example.edu/awards/undergrad-research',
    sourceUrl: 'https://helix.example.edu/research/awards',
    summary:
      'Paid summer research opportunity for undergraduate CS and engineering students.',
    status: OpportunityStatus.Published,
    trustScore: 83,
    slug: 'helix-undergraduate-research-award',
  },
  {
    title: 'Meridian Indigenous Studies Bursary',
    funderName: 'Meridian Research Council',
    type: OpportunityType.Scholarship,
    amount: '15000.00',
    currency: 'CAD',
    deadline: '2026-02-10',
    eligibility: {
      countries: ['CA'],
      levels: ['bachelor', 'master'],
      fields: ['indigenous studies', 'anthropology'],
    },
    requirements:
      'Bursary for Indigenous students pursuing degrees in Indigenous studies or related fields.',
    documentsNeeded: ['transcript', 'personal-statement'],
    applyUrl: 'https://meridian.example.gov/bursaries/indigenous',
    sourceUrl: 'https://meridian.example.gov/funding',
    summary:
      'Supports Indigenous students in Canada pursuing higher education in Indigenous studies.',
    status: OpportunityStatus.Published,
    trustScore: 87,
    slug: 'meridian-indigenous-studies-bursary',
  },
  {
    title: 'Atlas Youth Leadership Program',
    funderName: 'Atlas Cultural Exchange',
    type: OpportunityType.Fellowship,
    amount: '2000.00',
    currency: 'GBP',
    deadline: '2026-04-01',
    eligibility: {
      countries: ['GB', 'US'],
      levels: ['high_school', 'bachelor'],
      maxAge: 25,
    },
    requirements:
      'Six-month leadership development program with a small stipend.',
    documentsNeeded: ['application-form', 'reference'],
    applyUrl: 'https://atlas.example.org/programs/youth-leadership',
    sourceUrl: 'https://atlas.example.org/opportunities',
    summary:
      'Leadership fellowship for young adults with a focus on civic engagement and community impact.',
    status: OpportunityStatus.Published,
    trustScore: 68,
    slug: 'atlas-youth-leadership-program',
  },
  {
    title: 'Northgate International Student Grant',
    funderName: 'Northgate University',
    type: OpportunityType.Grant,
    amount: '30000.00',
    currency: 'USD',
    deadline: '2026-02-01',
    eligibility: {
      levels: ['bachelor', 'master'],
      minGpa: 3.3,
      languages: ['english'],
    },
    requirements:
      'Need-based grant for international students attending Northgate University.',
    documentsNeeded: ['financial-statement', 'transcript', 'essay'],
    applyUrl: 'https://northgate.example.edu/grants/international',
    sourceUrl: 'https://northgate.example.edu/financial-aid',
    summary:
      'Need-based financial support for international undergraduate and graduate students.',
    status: OpportunityStatus.Published,
    trustScore: 91,
    slug: 'northgate-international-student-grant',
  },
  {
    title: 'Helix Quantum Computing Scholarship',
    funderName: 'Helix Tech Institute',
    type: OpportunityType.Scholarship,
    amount: '20000.00',
    currency: 'USD',
    deadline: '2026-05-01',
    eligibility: {
      levels: ['master', 'phd'],
      fields: ['physics', 'computer science'],
      minGpa: 3.6,
    },
    requirements:
      'Scholarship for graduate students specializing in quantum computing.',
    documentsNeeded: ['transcript', 'research-statement', 'lor'],
    applyUrl: 'https://helix.example.edu/scholarships/quantum',
    sourceUrl: 'https://helix.example.edu/research/quantum',
    summary:
      'Supports graduate students at the forefront of quantum computing research.',
    status: OpportunityStatus.Published,
    trustScore: 86,
    slug: 'helix-quantum-computing-scholarship',
  },
  {
    title: 'Global Scholars Journalism Fellowship',
    funderName: 'Global Scholars Foundation',
    type: OpportunityType.Fellowship,
    amount: '28000.00',
    currency: 'USD',
    deadline: '2026-07-15',
    eligibility: {
      levels: ['bachelor', 'master', 'professional'],
      fields: ['journalism', 'media'],
      minExperience: 1,
    },
    requirements:
      'Nine-month fellowship for mid-career journalists covering global affairs.',
    documentsNeeded: ['portfolio', 'cv', 'essay'],
    applyUrl: 'https://globalscholars.example.org/journalism',
    sourceUrl: 'https://globalscholars.example.org/programs',
    summary:
      'Mid-career journalism fellowship focused on international reporting and media innovation.',
    status: OpportunityStatus.Published,
    trustScore: 89,
    slug: 'global-scholars-journalism-fellowship',
  },
  {
    title: 'Meridian Postdoctoral Fellowship',
    funderName: 'Meridian Research Council',
    type: OpportunityType.Fellowship,
    amount: '85000.00',
    currency: 'CAD',
    deadline: '2026-08-01',
    eligibility: {
      levels: ['phd'],
      fields: ['biology', 'medicine'],
      minGpa: 3.8,
    },
    requirements:
      'Two-year postdoctoral fellowship in biomedical sciences at Canadian institutions.',
    documentsNeeded: ['research-proposal', 'cv', 'lor', 'phd-transcript'],
    applyUrl: 'https://meridian.example.gov/fellowships/postdoc',
    sourceUrl: 'https://meridian.example.gov/funding',
    summary:
      'Prestigious postdoctoral fellowship for early-career biomedical researchers.',
    status: OpportunityStatus.Published,
    trustScore: 93,
    slug: 'meridian-postdoctoral-fellowship',
  },
  {
    title: 'Atlas Community Arts Microgrant',
    funderName: 'Atlas Cultural Exchange',
    type: OpportunityType.Grant,
    amount: '1000.00',
    currency: 'GBP',
    deadline: null,
    eligibility: {
      countries: ['GB'],
      fields: ['arts'],
    },
    requirements:
      'Rolling microgrant for small community arts projects. No deadline — apply anytime.',
    documentsNeeded: ['short-proposal'],
    applyUrl: 'https://atlas.example.org/grants/micro',
    sourceUrl: 'https://atlas.example.org/opportunities',
    summary:
      'Rolling microgrant program supporting small-scale community arts initiatives across the UK.',
    status: OpportunityStatus.Published,
    trustScore: 65,
    slug: 'atlas-community-arts-microgrant',
  },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('[seed] Connected to database');

  const funderRepo = AppDataSource.getRepository(Funder);
  const opportunityRepo = AppDataSource.getRepository(Opportunity);

  // Clear existing data. Several tables reference opportunities, so truncate
  // them together with CASCADE to avoid FK constraint errors.
  await AppDataSource.query(
    `TRUNCATE TABLE funders, opportunities, review_items, saved_items, drafts, reports RESTART IDENTITY CASCADE`,
  );
  console.log('[seed] Cleared existing funders and opportunities');

  // Insert funders.
  const createdFunders = await funderRepo.save(
    funders.map((f) => funderRepo.create(f)),
  );
  const funderByName = new Map(createdFunders.map((f) => [f.name, f]));
  console.log(`[seed] Inserted ${createdFunders.length} funders`);

  // Insert opportunities.
  const oppEntities = opportunities.map((o) => {
    const funder = funderByName.get(o.funderName);
    if (!funder) {
      throw new Error(`Funder not found for opportunity "${o.title}": ${o.funderName}`);
    }
    return opportunityRepo.create({
      title: o.title,
      funderId: funder.id,
      type: o.type,
      amount: o.amount,
      currency: o.currency,
      deadline: o.deadline ? new Date(o.deadline) : null,
      eligibility: o.eligibility,
      requirements: o.requirements,
      documentsNeeded: o.documentsNeeded,
      applyUrl: o.applyUrl,
      sourceUrl: o.sourceUrl,
      summary: o.summary,
      status: o.status,
      trustScore: o.trustScore,
      slug: o.slug,
    });
  });
  const createdOpportunities = await opportunityRepo.save(oppEntities);
  console.log(`[seed] Inserted ${createdOpportunities.length} opportunities`);

  await AppDataSource.destroy();
  console.log('[seed] Done');
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
