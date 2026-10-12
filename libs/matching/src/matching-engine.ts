/**
 * Pure matching engine — no Nest, no DB, no side effects.
 *
 * Compares a user's profile against an opportunity's eligibility criteria
 * and returns a match score plus per-criterion results. The engine is
 * deliberately framework-agnostic so it can be unit-tested in isolation
 * and reused by both the API and the worker.
 */

export interface MatchUserProfile {
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  citizenship?: string | null;
  countryOfResidence?: string | null;
  demographics?: string[] | null;
  gpa?: number | null;
}

export interface MatchOpportunity {
  id: string;
  title: string;
  eligibility?: Record<string, unknown> | null;
}

export type CriterionStatus = 'match' | 'mismatch' | 'not_specified' | 'unknown';

export interface CriterionResult {
  key: string;
  status: CriterionStatus;
  expected?: unknown;
  actual?: unknown;
  /** Human-readable explanation for this criterion. */
  reason: string;
}

export interface MatchResult {
  opportunityId: string;
  /** 0–100, where 100 means every specified criterion matches. */
  score: number;
  isEligible: boolean;
  criteria: CriterionResult[];
}

/**
 * Run matching for a single opportunity against a user profile.
 *
 * Scoring: each specified criterion that matches contributes equally to the
 * final score. Criteria not specified by the opportunity are ignored (they
 * don't count for or against). A score of 100 means fully eligible.
 */
export function matchOpportunity(
  user: MatchUserProfile,
  opportunity: MatchOpportunity,
): MatchResult {
  const criteria = evaluateEligibility(user, opportunity.eligibility);
  const specified = criteria.filter((c) => c.status !== 'not_specified');
  const matched = specified.filter((c) => c.status === 'match').length;
  const score = specified.length === 0 ? 100 : Math.round((matched / specified.length) * 100);

  return {
    opportunityId: opportunity.id,
    score,
    isEligible: score === 100,
    criteria,
  };
}

/**
 * Evaluate all eligibility criteria and return per-criterion results.
 */
export function evaluateEligibility(
  user: MatchUserProfile,
  eligibility: Record<string, unknown> | null | undefined,
): CriterionResult[] {
  if (!eligibility || Object.keys(eligibility).length === 0) {
    return [];
  }

  const results: CriterionResult[] = [];

  results.push(checkListCriterion('educationLevels', eligibility.educationLevels, user.educationLevel));
  results.push(checkListCriterion('fieldsOfStudy', eligibility.fieldsOfStudy, user.fieldOfStudy));
  results.push(checkListCriterion('citizenships', eligibility.citizenships, user.citizenship));
  results.push(checkListCriterion('countriesOfResidence', eligibility.countriesOfResidence, user.countryOfResidence));
  results.push(checkListCriterion('demographics', eligibility.demographics, user.demographics));
  results.push(checkMinCriterion('gpaMin', eligibility.gpaMin, user.gpa));

  // Ignore criteria the engine doesn't understand — report them as unknown
  // rather than failing closed, so new eligibility fields can be added
  // without breaking matching.
  const knownKeys = new Set([
    'educationLevels',
    'fieldsOfStudy',
    'citizenships',
    'countriesOfResidence',
    'demographics',
    'gpaMin',
  ]);
  for (const key of Object.keys(eligibility)) {
    if (!knownKeys.has(key)) {
      results.push({
        key,
        status: 'unknown',
        expected: eligibility[key],
        reason: `Criterion "${key}" is not yet supported by the matching engine`,
      });
    }
  }

  return results;
}

/**
 * Check a "user value must be in this list" criterion.
 * If the opportunity doesn't specify the list, it's not_specified.
 */
function checkListCriterion(
  key: string,
  expected: unknown,
  actual: unknown,
): CriterionResult {
  if (expected === undefined || expected === null) {
    return { key, status: 'not_specified', reason: `${key} not specified by the opportunity` };
  }
  if (!Array.isArray(expected)) {
    return {
      key,
      status: 'unknown',
      expected,
      reason: `${key} must be a list`,
    };
  }
  if (expected.length === 0) {
    return { key, status: 'not_specified', reason: `${key} list is empty` };
  }

  // Normalize for case-insensitive comparison.
  const expectedNorm = expected.map((v) => String(v).toLowerCase());

  // If the user's value is itself a list (e.g. demographics), any overlap counts.
  if (Array.isArray(actual)) {
    const actualNorm = actual.map((v) => String(v).toLowerCase());
    const overlap = actualNorm.filter((v) => expectedNorm.includes(v));
    return {
      key,
      status: overlap.length > 0 ? 'match' : 'mismatch',
      expected,
      actual,
      reason:
        overlap.length > 0
          ? `User has matching ${key}: ${overlap.join(', ')}`
          : `User's ${key} (${actualNorm.join(', ') || 'none'}) not in ${expectedNorm.join(', ')}`,
    };
  }

  const actualNorm =
    actual == null || (typeof actual !== 'string' && typeof actual !== 'number')
      ? ''
      : String(actual).toLowerCase();
  if (!actualNorm) {
    return {
      key,
      status: 'mismatch',
      expected,
      actual,
      reason: `User has no ${key} set`,
    };
  }

  const matches = expectedNorm.includes(actualNorm);
  return {
    key,
    status: matches ? 'match' : 'mismatch',
    expected,
    actual,
    reason: matches
      ? `User's ${key} (${actualNorm}) is eligible`
      : `User's ${key} (${actualNorm}) not in ${expectedNorm.join(', ')}`,
  };
}

/**
 * Check a "user value must be >= minimum" criterion (e.g. gpaMin).
 */
function checkMinCriterion(
  key: string,
  expected: unknown,
  actual: unknown,
): CriterionResult {
  if (expected === undefined || expected === null) {
    return { key, status: 'not_specified', reason: `${key} not specified by the opportunity` };
  }
  const min = Number(expected);
  if (Number.isNaN(min)) {
    return {
      key,
      status: 'unknown',
      expected,
      reason: `${key} must be a number`,
    };
  }
  if (actual === undefined || actual === null) {
    return {
      key,
      status: 'mismatch',
      expected: min,
      actual,
      reason: `User has no ${key.replace('Min', '')} set`,
    };
  }
  const value = Number(actual);
  if (Number.isNaN(value)) {
    return {
      key,
      status: 'unknown',
      actual,
      reason: `User's ${key.replace('Min', '')} is not a number`,
    };
  }
  const matches = value >= min;
  return {
    key,
    status: matches ? 'match' : 'mismatch',
    expected: min,
    actual: value,
    reason: matches
      ? `User's ${key.replace('Min', '')} (${value}) meets minimum ${min}`
      : `User's ${key.replace('Min', '')} (${value}) is below minimum ${min}`,
  };
}
