import { DraftsService } from './drafts.service.js';

describe('DraftsService', () => {
  it('uses profile facts and marks unsupported sections instead of inventing details', async () => {
    const opportunity = { id: 'opportunity-1', title: 'STEM award' };
    const profile = {
      citizenship: 'Kenya', residenceCountry: null, educationLevel: 'master',
      fieldOfStudy: 'Computer Science', institution: 'Example University', gpa: '3.80',
      graduationYear: 2027, languages: ['English'], testScores: null, experienceYears: null, goals: null,
    };
    const documents = [{ label: 'Transcript', userId: 'user-1' }];
    const drafts = { create: vi.fn((value) => value), save: vi.fn(async (value) => value), find: vi.fn() };
    const profiles = { findOne: vi.fn().mockResolvedValue(profile) };
    const opportunities = { findOne: vi.fn().mockResolvedValue(opportunity) };
    const documentRepository = { find: vi.fn().mockResolvedValue(documents) };
    const documentService = { readText: vi.fn().mockResolvedValue('Awarded a university research prize.') };
    const service = new DraftsService(
      drafts as never,
      profiles as never,
      opportunities as never,
      documentRepository as never,
      documentService as never,
    );

    const result = await service.create('user-1', { opportunityId: 'opportunity-1', prompt: 'Explain your goals' });

    expect(result.content).toContain('Profile — citizenship: Kenya');
    expect(result.content).toContain('Transcript: Awarded a university research prize.');
    expect(result.content).toContain('Specific personal experiences and achievements: needs your input.');
    expect(result.content).toContain('It has not been submitted.');
    expect(result.content).not.toContain('I have led');
  });
});
