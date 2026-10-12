/**
 * Shared database enums.
 *
 * These are stored as native PostgreSQL enum types. Values are snake_case
 * (or uppercase letter grades) to match the data model spec.
 */

/** Highest level of education completed or in progress. */
export enum EducationLevel {
  HighSchool = 'high_school',
  Bachelor = 'bachelor',
  Master = 'master',
  PhD = 'phd',
  Professional = 'professional',
}

/** The kind of funding opportunity. */
export enum OpportunityType {
  Scholarship = 'scholarship',
  Fellowship = 'fellowship',
  Grant = 'grant',
}

/** Publisher / source trust tier. A = most trusted, C = least. */
export enum TrustTier {
  A = 'A',
  B = 'B',
  C = 'C',
}

/** Publication lifecycle status of an opportunity. */
export enum OpportunityStatus {
  Pending = 'pending',
  Published = 'published',
  Rejected = 'rejected',
  Expired = 'expired',
  Hidden = 'hidden',
}

/** Which review queue an item sits in. */
export enum ReviewQueue {
  NeedsReview = 'needs_review',
  QuickApprove = 'quick_approve',
  AutoRejected = 'auto_rejected',
}

/** User's tracking status for a saved opportunity. */
export enum SavedItemStatus {
  Saved = 'saved',
  InProgress = 'in_progress',
  Submitted = 'submitted',
  Decision = 'decision',
}

/** Notification delivery channel. */
export enum NotificationChannel {
  Email = 'email',
}

/** Subscription plan. */
export enum SubscriptionPlan {
  Free = 'free',
  Plus = 'plus',
}

/** Reason a user reports an opportunity. */
export enum ReportReason {
  Scam = 'scam',
  WrongInfo = 'wrong_info',
  Expired = 'expired',
  Other = 'other',
}
