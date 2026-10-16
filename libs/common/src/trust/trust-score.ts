const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.com',
]);

export interface TrustAssessmentInput {
  pageText: string;
  sourceUrl: string;
  funderName: string | null;
  funderWebsite?: string | null;
  applicationUrl?: string | null;
  contactEmail?: string | null;
  domainAgeDays?: number | null;
  linkedFromFunderHomepage?: boolean;
  knownOrganizations?: Array<{ name: string; domains: string[] }>;
  unusuallyLargeAward?: boolean;
}

export interface TrustAssessment {
  score: number;
  signals: string[];
  autoRejected: boolean;
  feeNeedsReview: boolean;
}

function hostname(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function sameOrSubdomain(host: string | null, domain: string | null): boolean {
  return Boolean(host && domain && (host === domain || host.endsWith(`.${domain}`)));
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function assessOpportunityTrust(input: TrustAssessmentInput): TrustAssessment {
  const sourceHost = hostname(input.sourceUrl);
  const funderHost = hostname(input.funderWebsite);
  const applyHost = hostname(input.applicationUrl);
  const signals: string[] = [];
  let score = 50;
  let autoRejected = false;
  let feeNeedsReview = false;

  const individualPayment = /(?:send|pay|transfer|wire|payment)\s+(?:the\s+)?(?:fee|money|funds)?\s*(?:to|via)\s+(?:an?\s+)?(?:individual|person|agent|representative)|pay\s+to\s+(?:my|our)\s+(?:personal\s+)?(?:account|wallet)/i.test(input.pageText);
  if (individualPayment) {
    autoRejected = true;
    score -= 50;
    signals.push('Requests payment to an individual or personal account (automatic rejection).');
  }

  if (/guarantee(?:d|s)?\s+(?:selection|acceptance|approval|award)|guaranteed\s+(?:to\s+)?(?:win|receive|be selected)|100%\s+(?:guarantee|success)/i.test(input.pageText)) {
    autoRejected = true;
    score -= 50;
    signals.push('Guarantees selection or award (automatic rejection).');
  }

  const contactDomain = input.contactEmail?.split('@').at(-1)?.toLowerCase();
  const freeContact = Boolean(contactDomain && FREE_EMAIL_DOMAINS.has(contactDomain));
  if (freeContact) {
    autoRejected = true;
    score -= 50;
    signals.push('The only supplied contact is a free email provider (automatic rejection).');
  } else if (contactDomain && sourceHost && sameOrSubdomain(sourceHost, contactDomain)) {
    score += 12;
    signals.push('Contact email uses the source organisation domain.');
  } else if (contactDomain && funderHost && sameOrSubdomain(funderHost, contactDomain)) {
    score += 12;
    signals.push('Contact email uses the funder organisation domain.');
  }

  if (sourceHost && funderHost && sameOrSubdomain(sourceHost, funderHost)) {
    score += 20;
    signals.push('Source domain matches the funder website.');
  } else if (sourceHost && applyHost && sameOrSubdomain(sourceHost, applyHost)) {
    score += 12;
    signals.push('Application page is on the source domain.');
  }

  if (input.linkedFromFunderHomepage) {
    score += 15;
    signals.push('Opportunity is linked from the funder homepage.');
  }
  if (input.domainAgeDays != null) {
    if (input.domainAgeDays >= 365) {
      score += 10;
      signals.push('Domain has been registered for at least one year.');
    } else if (input.domainAgeDays < 90) {
      score -= 20;
      signals.push('Domain is very new (under 90 days).');
    }
  }
  if (/\b(?:dr|professor|prof|director|dean|officer|coordinator)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(input.pageText)) {
    score += 8;
    signals.push('Page names a staff member or responsible official.');
  } else {
    score -= 5;
    signals.push('No named staff member was identified.');
  }
  if (/\b(?:street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd\.|postal address|mailing address)\b/i.test(input.pageText)) {
    score += 5;
    signals.push('Page provides a physical or mailing address.');
  } else {
    score -= 5;
    signals.push('No physical or mailing address was identified.');
  }

  const suspiciousOrganization = input.knownOrganizations?.find((organization) => {
    const expected = normalizeName(organization.name);
    const pageName = normalizeName(input.funderName ?? '');
    const host = sourceHost?.split('.')[0] ?? '';
    const normalizedHost = normalizeName(host);
    const knownHosts = organization.domains.map((domain) => normalizeName(domain.split('.')[0] ?? domain));
    const hostImitates = normalizedHost && expected.length >= 6 && normalizedHost.includes(expected) && !knownHosts.includes(normalizedHost);
    return (pageName && expected && pageName !== expected && pageName.includes(expected)) || hostImitates ||
      Boolean(sourceHost && organization.domains.some((domain) => sourceHost !== domain && sourceHost.endsWith(`.${domain}`)));
  });
  if (suspiciousOrganization) {
    score -= 25;
    signals.push(`Source name or domain may imitate ${suspiciousOrganization.name}.`);
  }
  if (input.unusuallyLargeAward && /\b(?:all students|anyone|everyone|no restrictions|no eligibility|no requirements)\b/i.test(input.pageText)) {
    score -= 15;
    signals.push('Vague eligibility is paired with an unusually large award.');
  }
  if (/\b(?:act now|limited time|immediate action|last chance|expires today|apply within 24 hours)\b/i.test(input.pageText)) {
    score -= 10;
    signals.push('Page uses urgency or pressure wording.');
  }

  if (/\b(?:application|processing|registration)\s+fee\b/i.test(input.pageText) && !individualPayment) {
    feeNeedsReview = true;
    signals.push('Application fee language requires human review; an institution-owned payment portal is not automatically rejected.');
  }

  return { score: Math.max(0, Math.min(100, score)), signals, autoRejected, feeNeedsReview };
}