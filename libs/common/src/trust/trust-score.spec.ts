import { describe, expect, it } from 'vitest';
import { assessOpportunityTrust } from './trust-score.js';

const base = {
  pageText: 'Dr. Alice Smith, Scholarship coordinator. Mailing address: 10 Main Street.',
  sourceUrl: 'https://foundation.example.org/scholarships',
  funderName: 'Example Foundation',
  funderWebsite: 'https://foundation.example.org',
  contactEmail: 'alice@foundation.example.org',
};

describe('assessOpportunityTrust', () => {
  it('scores positive official signals and names them', () => {
    const result = assessOpportunityTrust({ ...base, domainAgeDays: 900, linkedFromFunderHomepage: true });
    expect(result.score).toBeGreaterThan(70);
    expect(result.signals).toContain('Opportunity is linked from the funder homepage.');
    expect(result.autoRejected).toBe(false);
  });

  it('automatically rejects individual payment, guarantees, and free-only contact', () => {
    const result = assessOpportunityTrust({
      ...base,
      pageText: 'Pay the application fee to an individual agent. Guaranteed selection.',
      contactEmail: 'apply@gmail.com',
    });
    expect(result.autoRejected).toBe(true);
    expect(result.score).toBeLessThan(20);
  });

  it('flags institution portal fee language for review rather than rejection', () => {
    const result = assessOpportunityTrust({
      ...base,
      pageText: `${base.pageText} A processing fee is paid through the university portal.`,
    });
    expect(result.feeNeedsReview).toBe(true);
    expect(result.autoRejected).toBe(false);
  });

  it('scores suspicious signals down', () => {
    const result = assessOpportunityTrust({
      ...base,
      sourceUrl: 'https://examplefoundation-awards.test/apply',
      domainAgeDays: 12,
      pageText: 'Everyone qualifies for this award. Apply within 24 hours.',
      unusuallyLargeAward: true,
      knownOrganizations: [{ name: 'Example Foundation', domains: ['example.org'] }],
    });
    expect(result.score).toBeLessThan(35);
    expect(result.signals.some((signal) => signal.includes('imitate'))).toBe(true);
  });
});