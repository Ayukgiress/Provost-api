/** Pure profile-to-opportunity matching. No framework or I/O dependencies. */

export interface MatchUserProfile {
  educationLevel?: string | null;
  fieldOfStudy?: string | null;
  citizenship?: string | null;
  countryOfResidence?: string | null;
  residenceCountry?: string | null;
  age?: number | null;
  birthYear?: number | null;
  experienceYears?: number | null;
  gpa?: number | null;
  languages?: string[] | null;
  goals?: string[] | null;
  documents?: string[] | null;
  testScores?: Record<string, number> | null;
  [key: string]: unknown;
}

export interface MatchOpportunity {
  id: string;
  title: string;
  eligibility?: Record<string, unknown> | null;
  deadline?: string | Date | null;
  documentsNeeded?: string[] | null;
  /** Override the current date for deterministic matching. */
  asOf?: string | Date;
}

export type MatchVerdict = 'apply' | 'fix_first' | 'skip';
export type ChecklistStatus = 'pass' | 'warning' | 'fail';
export interface ChecklistItem {
  criterion: string;
  status: ChecklistStatus;
  explanation: string;
}
export interface MatchResult {
  verdict: MatchVerdict;
  fitScore: number;
  reasons: string[];
  checklist: ChecklistItem[];
}

const IGNORED_RANKING_KEY = /(plan|payment|sponsor)/i;

export function matchOpportunity(
  user: MatchUserProfile,
  opportunity: MatchOpportunity,
): MatchResult {
  const eligibility = opportunity.eligibility ?? {};
  const checklist: ChecklistItem[] = [];
  let hardFailure = false;
  let blockingWarning = false;
  let fitScore = 70;

  const addHardList = (
    criterion: string,
    expected: unknown,
    actual: unknown,
  ): void => {
    if (expected == null || isEmptyList(expected)) return;
    const values = asStrings(expected);
    if (!values) {
      checklist.push({
        criterion,
        status: 'warning',
        explanation: `Eligibility for ${criterion} could not be interpreted.`,
      });
      blockingWarning = true;
      return;
    }
    if (actual == null || actual === '') {
      checklist.push({
        criterion,
        status: 'warning',
        explanation: `Add your ${criterion} to your profile to confirm eligibility.`,
      });
      blockingWarning = true;
      return;
    }
    const actualValues = Array.isArray(actual) ? actual : [actual];
    const matched = actualValues.some((value) =>
      values.includes(normalize(value)),
    );
    checklist.push({
      criterion,
      status: matched ? 'pass' : 'fail',
      explanation: matched
        ? `Your ${criterion} meets the stated eligibility requirement.`
        : `Your ${criterion} does not meet the stated eligibility requirement.`,
    });
    if (!matched) {
      hardFailure = true;
      fitScore -= 30;
    }
  };

  addHardList(
    'education level',
    firstDefined(eligibility, 'levels', 'educationLevels'),
    user.educationLevel,
  );
  addHardList(
    'field of study',
    firstDefined(eligibility, 'fields', 'fieldsOfStudy'),
    user.fieldOfStudy,
  );
  addHardList(
    'citizenship',
    firstDefined(eligibility, 'citizenships'),
    user.citizenship,
  );

  const countries = firstDefined(
    eligibility,
    'countries',
    'countriesOfResidence',
  );
  if (countries != null && !isEmptyList(countries)) {
    const allowed = asStrings(countries);
    const residence = user.countryOfResidence ?? user.residenceCountry;
    if (!allowed) {
      checklist.push({
        criterion: 'country eligibility',
        status: 'warning',
        explanation: 'Country eligibility could not be interpreted.',
      });
      blockingWarning = true;
    } else if (user.citizenship == null && residence == null) {
      checklist.push({
        criterion: 'country eligibility',
        status: 'warning',
        explanation:
          'Add your citizenship or country of residence to confirm eligibility.',
      });
      blockingWarning = true;
    } else {
      const userCountries = [user.citizenship, residence]
        .filter((value): value is string => typeof value === 'string')
        .map(normalize);
      const matched = userCountries.some((value) => allowed.includes(value));
      checklist.push({
        criterion: 'country eligibility',
        status: matched ? 'pass' : 'fail',
        explanation: matched
          ? 'Your citizenship or country of residence is eligible.'
          : 'Neither your citizenship nor country of residence is eligible.',
      });
      if (!matched) {
        hardFailure = true;
        fitScore -= 30;
      }
    }
  }

  const maxAge = firstDefined(eligibility, 'maxAge');
  if (maxAge != null) {
    const limit = finiteNumber(maxAge);
    const now = asDate(opportunity.asOf) ?? new Date();
    const birthYear = finiteNumber(user.birthYear);
    const age =
      finiteNumber(user.age) ??
      (birthYear === null ? null : now.getUTCFullYear() - birthYear);
    if (limit === null) {
      checklist.push({
        criterion: 'age limit',
        status: 'warning',
        explanation: 'The age limit could not be interpreted.',
      });
      blockingWarning = true;
    } else if (age === null) {
      checklist.push({
        criterion: 'age limit',
        status: 'warning',
        explanation: 'Add your age or birth year to confirm eligibility.',
      });
      blockingWarning = true;
    } else {
      const matched = age <= limit;
      checklist.push({
        criterion: 'age limit',
        status: matched ? 'pass' : 'fail',
        explanation: matched
          ? `Your age (${age}) is within the limit (${limit}).`
          : `Your age (${age}) exceeds the limit (${limit}).`,
      });
      if (!matched) {
        hardFailure = true;
        fitScore -= 30;
      }
    }
  }

  const minExperience = firstDefined(
    eligibility,
    'minExperience',
    'minimumExperience',
  );
  if (minExperience != null) {
    const minimum = finiteNumber(minExperience);
    const years = finiteNumber(user.experienceYears);
    if (minimum === null) {
      checklist.push({
        criterion: 'minimum experience',
        status: 'warning',
        explanation:
          'The minimum experience requirement could not be interpreted.',
      });
      blockingWarning = true;
    } else if (years === null) {
      checklist.push({
        criterion: 'minimum experience',
        status: 'warning',
        explanation:
          'Add your relevant experience to your profile to confirm eligibility.',
      });
      blockingWarning = true;
    } else {
      const matched = years >= minimum;
      checklist.push({
        criterion: 'minimum experience',
        status: matched ? 'pass' : 'fail',
        explanation: matched
          ? `Your experience (${years} years) meets the minimum (${minimum}).`
          : `Your experience (${years} years) is below the minimum (${minimum}).`,
      });
      if (!matched) {
        hardFailure = true;
        fitScore -= 30;
      }
    }
  }

  // GPA and experience influence fit but never make an applicant ineligible.
  const minGpa = firstDefined(eligibility, 'minGpa', 'gpaMin');
  if (minGpa != null) {
    const minimum = finiteNumber(minGpa);
    const gpa = finiteNumber(user.gpa);
    if (minimum === null) {
      checklist.push({
        criterion: 'GPA',
        status: 'warning',
        explanation: 'The GPA preference could not be interpreted.',
      });
      blockingWarning = true;
    } else if (gpa === null) {
      checklist.push({
        criterion: 'GPA',
        status: 'warning',
        explanation: 'Add your GPA to your profile to assess this preference.',
      });
      blockingWarning = true;
    } else {
      const meets = gpa >= minimum;
      checklist.push({
        criterion: 'GPA',
        status: meets ? 'pass' : 'warning',
        explanation: meets
          ? `Your GPA (${gpa}) meets the preferred minimum (${minimum}).`
          : `Your GPA (${gpa}) is below the preferred minimum (${minimum}); this is a soft factor.`,
      });
      fitScore += meets ? 10 : -10;
    }
  } else if (finiteNumber(user.gpa) !== null) {
    fitScore += Math.round(
      (Math.min(4, Math.max(0, finiteNumber(user.gpa)!)) / 4 - 0.5) * 10,
    );
  }
  if (minExperience == null && finiteNumber(user.experienceYears) !== null) {
    fitScore += Math.min(
      8,
      Math.max(0, Math.round(finiteNumber(user.experienceYears)! * 2)),
    );
  }

  const requiredLanguages = firstDefined(eligibility, 'languages');
  if (requiredLanguages != null && !isEmptyList(requiredLanguages)) {
    const required = asStrings(requiredLanguages);
    if (!required) {
      checklist.push({
        criterion: 'languages',
        status: 'warning',
        explanation: 'The language preference could not be interpreted.',
      });
      blockingWarning = true;
    } else if (user.languages == null) {
      checklist.push({
        criterion: 'languages',
        status: 'warning',
        explanation: 'Add your languages to assess this preference.',
      });
      blockingWarning = true;
    } else {
      const hasLanguage = user.languages.some((language) =>
        required.includes(normalize(language)),
      );
      checklist.push({
        criterion: 'languages',
        status: hasLanguage ? 'pass' : 'warning',
        explanation: hasLanguage
          ? 'Your profile includes a preferred language.'
          : 'Your profile does not list a preferred language; update it if applicable.',
      });
      fitScore += hasLanguage ? 8 : -5;
    }
  }

  applyArraySoftFactor(
    'goals',
    firstDefined(eligibility, 'goals'),
    user.goals,
    checklist,
    (delta) => {
      fitScore += delta;
    },
  );
  applyArraySoftFactor(
    'required documents',
    opportunity.documentsNeeded ??
      firstDefined(eligibility, 'documentsNeeded', 'requiredDocuments'),
    user.documents,
    checklist,
    (_delta, missing) => {
      if (missing) blockingWarning = true;
    },
    true,
  );

  const testRequirements = firstDefined(
    eligibility,
    'languageTests',
    'requiredTests',
  );
  if (testRequirements != null && !isEmptyList(testRequirements)) {
    const tests = asStrings(testRequirements);
    if (!tests) {
      checklist.push({
        criterion: 'required tests',
        status: 'warning',
        explanation: 'The required tests could not be interpreted.',
      });
      blockingWarning = true;
    } else {
      const scores = user.testScores ?? {};
      const missing = tests.filter(
        (test) => !Object.keys(scores).some((key) => normalize(key) === test),
      );
      checklist.push({
        criterion: 'required tests',
        status: missing.length === 0 ? 'pass' : 'warning',
        explanation:
          missing.length === 0
            ? 'Your profile lists the required test results.'
            : `Add test results for: ${missing.join(', ')}.`,
      });
      if (missing.length > 0) blockingWarning = true;
    }
  }

  const knownKeys = new Set([
    'levels',
    'educationLevels',
    'fields',
    'fieldsOfStudy',
    'citizenships',
    'countries',
    'countriesOfResidence',
    'maxAge',
    'minExperience',
    'minimumExperience',
    'minGpa',
    'gpaMin',
    'languages',
    'goals',
    'documentsNeeded',
    'requiredDocuments',
    'languageTests',
    'requiredTests',
    'other',
  ]);
  for (const [key, value] of Object.entries(eligibility)) {
    if (
      knownKeys.has(key) ||
      value == null ||
      value === false ||
      value === ''
    ) {
      if (key === 'other') {
        for (const nestedKey of listMaterialUnknowns(value)) {
          checklist.push({
            criterion: nestedKey,
            status: 'warning',
            explanation: `The material requirement "${nestedKey}" is not yet evaluated; review the opportunity details.`,
          });
          blockingWarning = true;
        }
      }
      continue;
    }
    if (IGNORED_RANKING_KEY.test(key)) continue;
    checklist.push({
      criterion: key,
      status: 'warning',
      explanation: `The material requirement "${key}" is not yet evaluated; review the opportunity details.`,
    });
    blockingWarning = true;
  }

  const deadline = asDate(opportunity.deadline);
  const asOf = asDate(opportunity.asOf) ?? new Date();
  if (deadline && dateOnly(deadline) < dateOnly(asOf)) {
    checklist.push({
      criterion: 'deadline',
      status: 'fail',
      explanation: 'The application deadline has passed.',
    });
    hardFailure = true;
    fitScore -= 30;
  }

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));
  const verdict: MatchVerdict = hardFailure
    ? 'skip'
    : blockingWarning || fitScore < 70
      ? 'fix_first'
      : 'apply';
  const reasons = checklist
    .filter((item) => item.status !== 'pass')
    .slice(0, 3)
    .map((item) => item.explanation);
  if (reasons.length === 0)
    reasons.push(
      verdict === 'apply'
        ? 'You meet the known requirements and have a strong fit.'
        : 'Your fit score needs improvement before applying.',
    );
  return { verdict, fitScore, reasons: reasons.slice(0, 3), checklist };
}

export function evaluateEligibility(
  user: MatchUserProfile,
  eligibility: Record<string, unknown> | null | undefined,
): ChecklistItem[] {
  return matchOpportunity(user, { id: '', title: '', eligibility }).checklist;
}

function applyArraySoftFactor(
  criterion: string,
  expected: unknown,
  actual: string[] | null | undefined,
  checklist: ChecklistItem[],
  onResult: (delta: number, missing: boolean) => void,
  documents = false,
): void {
  if (expected == null || isEmptyList(expected)) return;
  const values = asStrings(expected);
  if (!values) {
    checklist.push({
      criterion,
      status: 'warning',
      explanation: `The ${criterion} requirement could not be interpreted.`,
    });
    onResult(0, true);
    return;
  }
  if (actual == null) {
    checklist.push({
      criterion,
      status: 'warning',
      explanation: documents
        ? `Prepare the required documents: ${values.join(', ')}.`
        : `Add your ${criterion} to your profile to assess this preference.`,
    });
    onResult(0, true);
    return;
  }
  const actualValues = actual.map(normalize);
  const missing = values.filter((value) => !actualValues.includes(value));
  if (documents) {
    checklist.push({
      criterion,
      status: missing.length === 0 ? 'pass' : 'warning',
      explanation:
        missing.length === 0
          ? 'Your profile lists all required documents.'
          : `Prepare or add required documents: ${missing.join(', ')}.`,
    });
    onResult(0, missing.length > 0);
  } else {
    const overlap = values.some((value) => actualValues.includes(value));
    checklist.push({
      criterion,
      status: overlap ? 'pass' : 'warning',
      explanation: overlap
        ? `Your ${criterion} align with this opportunity.`
        : `Your ${criterion} do not currently align with this preference.`,
    });
    onResult(overlap ? 5 : -5, false);
  }
}

function firstDefined(
  source: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys)
    if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function listMaterialUnknowns(value: unknown, prefix = 'other'): string[] {
  if (value == null || typeof value !== 'object' || Array.isArray(value))
    return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    if (nested == null || nested === false || nested === '') return [];
    if (IGNORED_RANKING_KEY.test(key)) return [];
    const name = `${prefix}.${key}`;
    return typeof nested === 'object' && !Array.isArray(nested)
      ? listMaterialUnknowns(nested, name)
      : [name];
  });
}

function asStrings(value: unknown): string[] | null {
  if (typeof value === 'string' && value.trim()) return [normalize(value)];
  if (!Array.isArray(value)) return null;
  return value.every(
    (item) => typeof item === 'string' && item.trim().length > 0,
  )
    ? value.map(normalize)
    : null;
}
function normalize(value: unknown): string {
  return String(value).trim().toLocaleLowerCase();
}
function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}
function asDate(value: string | Date | undefined | null): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
