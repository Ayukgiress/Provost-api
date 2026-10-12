import { describe, it, expect } from 'vitest';
import {
  matchOpportunity,
  evaluateEligibility,
  type MatchUserProfile,
  type MatchOpportunity,
} from './matching-engine.js';

const baseUser: MatchUserProfile = {
  educationLevel: 'undergraduate',
  fieldOfStudy: 'computer science',
  citizenship: 'us',
  countryOfResidence: 'us',
  demographics: ['first-gen', 'low-income'],
  gpa: 3.8,
};

const baseOpportunity: MatchOpportunity = {
  id: 'opp-1',
  title: 'Test Scholarship',
  eligibility: {},
};

describe('matchOpportunity', () => {
  it('returns score 100 and isEligible when no eligibility criteria specified', () => {
    const result = matchOpportunity(baseUser, baseOpportunity);
    expect(result.score).toBe(100);
    expect(result.isEligible).toBe(true);
    expect(result.criteria).toHaveLength(0);
  });

  it('returns score 100 when all criteria match', () => {
    const opp: MatchOpportunity = {
      ...baseOpportunity,
      eligibility: {
        educationLevels: ['undergraduate', 'graduate'],
        citizenships: ['us', 'ca'],
        gpaMin: 3.0,
      },
    };
    const result = matchOpportunity(baseUser, opp);
    expect(result.score).toBe(100);
    expect(result.isEligible).toBe(true);
  });

  it('returns partial score when some criteria mismatch', () => {
    const opp: MatchOpportunity = {
      ...baseOpportunity,
      eligibility: {
        educationLevels: ['undergraduate'],
        citizenships: ['uk'], // mismatch
        gpaMin: 3.0,
      },
    };
    const result = matchOpportunity(baseUser, opp);
    // 2 of 3 specified criteria match -> 67
    expect(result.score).toBe(67);
    expect(result.isEligible).toBe(false);
  });

  it('treats empty eligibility arrays as not_specified (not counted)', () => {
    const opp: MatchOpportunity = {
      ...baseOpportunity,
      eligibility: {
        educationLevels: [],
        gpaMin: 3.0,
      },
    };
    const result = matchOpportunity(baseUser, opp);
    // Only gpaMin counts; educationLevels is empty -> not_specified.
    expect(result.score).toBe(100);
    expect(result.isEligible).toBe(true);
  });
});

describe('evaluateEligibility', () => {
  it('returns an empty array when eligibility is null', () => {
    expect(evaluateEligibility(baseUser, null)).toEqual([]);
  });

  it('returns an empty array when eligibility is undefined', () => {
    expect(evaluateEligibility(baseUser, undefined)).toEqual([]);
  });

  it('returns an empty array when eligibility is empty', () => {
    expect(evaluateEligibility(baseUser, {})).toEqual([]);
  });

  describe('list criteria (educationLevels, fieldsOfStudy, citizenships, countriesOfResidence)', () => {
    it('matches case-insensitively', () => {
      const results = evaluateEligibility(baseUser, {
        educationLevels: ['Undergraduate', 'Graduate'],
      });
      const edu = results.find((r) => r.key === 'educationLevels');
      expect(edu?.status).toBe('match');
    });

    it('mismatches when user value not in list', () => {
      const results = evaluateEligibility(baseUser, {
        citizenships: ['uk', 'de'],
      });
      const c = results.find((r) => r.key === 'citizenships');
      expect(c?.status).toBe('mismatch');
    });

    it('mismatches when user value is not set', () => {
      const user: MatchUserProfile = { ...baseUser, fieldOfStudy: null };
      const results = evaluateEligibility(user, {
        fieldsOfStudy: ['computer science'],
      });
      const f = results.find((r) => r.key === 'fieldsOfStudy');
      expect(f?.status).toBe('mismatch');
    });

    it('is not_specified when opportunity omits the criterion', () => {
      const results = evaluateEligibility(baseUser, { gpaMin: 3.0 });
      const edu = results.find((r) => r.key === 'educationLevels');
      expect(edu?.status).toBe('not_specified');
    });
  });

  describe('demographics (list-vs-list)', () => {
    it('matches when there is any overlap', () => {
      const results = evaluateEligibility(baseUser, {
        demographics: ['first-gen'],
      });
      const d = results.find((r) => r.key === 'demographics');
      expect(d?.status).toBe('match');
    });

    it('mismatches when there is no overlap', () => {
      const results = evaluateEligibility(baseUser, {
        demographics: ['veteran'],
      });
      const d = results.find((r) => r.key === 'demographics');
      expect(d?.status).toBe('mismatch');
    });
  });

  describe('gpaMin', () => {
    it('matches when user gpa >= minimum', () => {
      const results = evaluateEligibility(baseUser, { gpaMin: 3.5 });
      const g = results.find((r) => r.key === 'gpaMin');
      expect(g?.status).toBe('match');
    });

    it('mismatches when user gpa < minimum', () => {
      const results = evaluateEligibility(baseUser, { gpaMin: 4.0 });
      const g = results.find((r) => r.key === 'gpaMin');
      expect(g?.status).toBe('mismatch');
    });

    it('mismatches when user gpa is not set', () => {
      const user: MatchUserProfile = { ...baseUser, gpa: null };
      const results = evaluateEligibility(user, { gpaMin: 3.0 });
      const g = results.find((r) => r.key === 'gpaMin');
      expect(g?.status).toBe('mismatch');
    });

    it('is not_specified when opportunity omits gpaMin', () => {
      const results = evaluateEligibility(baseUser, { educationLevels: ['undergraduate'] });
      const g = results.find((r) => r.key === 'gpaMin');
      expect(g?.status).toBe('not_specified');
    });
  });

  describe('unknown criteria', () => {
    it('marks unrecognized keys as unknown (fail-open)', () => {
      const results = evaluateEligibility(baseUser, {
        essayRequired: true,
      });
      const e = results.find((r) => r.key === 'essayRequired');
      expect(e?.status).toBe('unknown');
    });

    it('marks non-array list criteria as unknown', () => {
      const results = evaluateEligibility(baseUser, {
        educationLevels: 'undergraduate',
      });
      const e = results.find((r) => r.key === 'educationLevels');
      expect(e?.status).toBe('unknown');
    });
  });
});
