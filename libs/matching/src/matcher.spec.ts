import { describe, expect, it } from 'vitest';
import { evaluateEligibility, matchOpportunity, type MatchOpportunity, type MatchUserProfile } from './matching-engine.js';

const profile: MatchUserProfile = {
  educationLevel: 'bachelor', fieldOfStudy: 'computer science', citizenship: 'US', countryOfResidence: 'CA',
  age: 25, experienceYears: 2, gpa: 3.8, languages: ['English'], goals: ['research'],
  documents: ['transcript', 'essay'], testScores: { toefl: 110 },
};
const opp: MatchOpportunity = { id: '1', title: 'Test', asOf: '2026-10-15' };

describe('matchOpportunity', () => {
  it('returns verdict, score, reasons and checklist', () => {
    expect(matchOpportunity(profile, opp)).toEqual({ verdict: 'apply', fitScore: 79, reasons: ['You meet the known requirements and have a strong fit.'], checklist: [] });
  });
  it('evaluates hard criteria and matches across multiple countries', () => {
    const result = matchOpportunity(profile, { ...opp, eligibility: { levels: ['BACHELOR'], fields: ['Computer Science'], countries: ['gb', 'ca'], maxAge: 25, minExperience: 2 } });
    expect(result.verdict).toBe('apply');
    expect(result.checklist.every((item) => item.status === 'pass')).toBe(true);
  });
  it('skips for any hard failure', () => {
    expect(matchOpportunity(profile, { ...opp, eligibility: { fields: ['law'] } }).verdict).toBe('skip');
  });
  it('enforces citizenship, age, and minimum-experience hard limits', () => {
    expect(matchOpportunity(profile, { ...opp, eligibility: { citizenships: ['uk'] } }).verdict).toBe('skip');
    expect(matchOpportunity(profile, { ...opp, eligibility: { maxAge: 24 } }).verdict).toBe('skip');
    expect(matchOpportunity({ ...profile, experienceYears: 1 }, { ...opp, eligibility: { minExperience: 2 } }).verdict).toBe('skip');
  });
  it('derives age from birth year when age is unknown', () => {
    const result = matchOpportunity({ ...profile, age: null, birthYear: 2001 }, { ...opp, eligibility: { maxAge: 25 } });
    expect(result.checklist[0]?.status).toBe('pass');
    expect(result.verdict).toBe('apply');
  });
  it('makes missing profile values fixable warnings', () => {
    const result = matchOpportunity({ ...profile, educationLevel: null }, { ...opp, eligibility: { levels: ['bachelor'] } });
    expect(result.verdict).toBe('fix_first');
    expect(result.checklist[0]?.status).toBe('warning');
  });
  it('ignores unknown null fields', () => {
    expect(matchOpportunity(profile, { ...opp, eligibility: { otherRequirement: null } }).verdict).toBe('apply');
  });
  it('warns on missing documents and language test/results', () => {
    const result = matchOpportunity({ ...profile, documents: null, testScores: null, languages: null }, { ...opp, documentsNeeded: ['transcript'], eligibility: { languageTests: ['toefl'], languages: ['english'] } });
    expect(result.verdict).toBe('fix_first');
    expect(result.checklist.filter(({ status }) => status === 'warning')).toHaveLength(3);
    expect(result.reasons).toHaveLength(3);
  });
  it('uses GPA only as a soft factor', () => {
    const result = matchOpportunity({ ...profile, gpa: 2.5 }, { ...opp, eligibility: { minGpa: 3.5 } });
    expect(result.verdict).toBe('fix_first');
    expect(result.checklist.find(({ criterion }) => criterion === 'GPA')?.status).toBe('warning');
    expect(result.fitScore).toBe(64);
  });
  it('uses an inclusive score boundary of 70', () => {
    const at = matchOpportunity({ ...profile, gpa: 2, experienceYears: null }, opp);
    const under = matchOpportunity({ ...profile, gpa: 1.6, experienceYears: null }, opp);
    expect([at.fitScore, at.verdict]).toEqual([70, 'apply']);
    expect([under.fitScore, under.verdict]).toEqual([69, 'fix_first']);
  });
  it('clamps score and caps reasons at three', () => {
    const result = matchOpportunity({ ...profile, gpa: 4, experienceYears: 50 }, { ...opp, eligibility: { languageTests: ['gre', 'toefl', 'ielts'], languages: ['french'], goals: ['teaching'] }, documentsNeeded: ['passport', 'transcript'] });
    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.fitScore).toBeLessThanOrEqual(100);
    expect(result.reasons.length).toBeLessThanOrEqual(3);
  });
  it('skips expired deadlines but accepts the deadline date', () => {
    expect(matchOpportunity(profile, { ...opp, deadline: '2026-10-14' }).verdict).toBe('skip');
    expect(matchOpportunity(profile, { ...opp, deadline: '2026-10-15' }).verdict).toBe('apply');
  });
  it('never ranks based on plan, payment or sponsorship', () => {
    const baseline = matchOpportunity(profile, opp);
    const commercial = matchOpportunity(profile, { ...opp, eligibility: {
      planRequired: 'plus', paymentRequired: true, sponsorshipAvailable: false,
      other: { funding: { sponsorshipAvailable: false, paymentRequired: true } },
    } });
    expect(commercial).toEqual(baseline);
  });
});

describe('evaluateEligibility', () => {
  it('returns an empty checklist for null criteria', () => {
    expect(evaluateEligibility(profile, null)).toEqual([]);
  });
  it('warns on malformed and unknown material criteria', () => {
    const items = evaluateEligibility(profile, { levels: 42, portfolioRequired: true });
    expect(items.find(({ criterion }) => criterion === 'education level')?.status).toBe('warning');
    expect(items.find(({ criterion }) => criterion === 'portfolioRequired')?.status).toBe('warning');
  });
});
