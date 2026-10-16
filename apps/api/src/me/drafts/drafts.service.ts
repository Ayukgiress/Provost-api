import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from '@provost/database/entities/document.entity.js';
import { Draft } from '@provost/database/entities/draft.entity.js';
import { Opportunity } from '@provost/database/entities/opportunity.entity.js';
import { OpportunityStatus } from '@provost/database/entities/enums.js';
import { Profile } from '@provost/database/entities/profile.entity.js';
import { Repository } from 'typeorm';
import { DocumentsService } from '../documents/documents.service.js';
import type { CreateDraftDto } from './dto/create-draft.dto.js';

@Injectable()
export class DraftsService {
  constructor(
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    private readonly documentService: DocumentsService,
  ) {}

  async create(userId: string, dto: CreateDraftDto) {
    const [opportunity, profile, documents] = await Promise.all([
      this.opportunities.findOne({ where: { id: dto.opportunityId, status: OpportunityStatus.Published } }),
      this.profiles.findOne({ where: { userId } }),
      this.documents.find({ where: { userId }, order: { createdAt: 'ASC' } }),
    ]);
    if (!opportunity) throw new NotFoundException('Published opportunity not found');

    const facts = this.profileFacts(profile);
    const documentFactLines: string[] = [];
    const unreadableDocuments: string[] = [];
    for (const document of documents) {
      const text = await this.documentService.readText(userId, document);
      if (text.trim()) {
        for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
          documentFactLines.push(`${document.label}: ${line.slice(0, 500)}`);
          if (documentFactLines.length >= 30) break;
        }
      } else {
        unreadableDocuments.push(document.label);
      }
      if (documentFactLines.length >= 30) break;
    }

    const factualLines = [...facts, ...documentFactLines];
    const promptSection = dto.prompt?.trim()
      ? `Application prompt:\n${dto.prompt.trim()}\n\n`
      : '';
    const factsSection = factualLines.length
      ? `Facts supported by your profile and uploaded documents:\n${factualLines.map((fact) => `- ${fact}`).join('\n')}`
      : 'Facts supported by your profile and uploaded documents: needs your input.';
    const missingSections = [
      'Why this opportunity is a good fit',
      'Specific personal experiences and achievements',
      'How you plan to use the award',
    ].map((section) => `${section}: needs your input.`);
    if (unreadableDocuments.length) missingSections.push(`Text from image documents (${unreadableDocuments.join(', ')}): needs your input.`);
    const applicantStatement = factualLines.length
      ? `I am applying for ${opportunity.title}. My profile and documents state: ${factualLines.join('; ')}.`
      : `I am applying for ${opportunity.title}. needs your input.`;

    const content = [
      `Draft for ${opportunity.title}`,
      'This is an editable draft only. It has not been submitted.',
      promptSection.trim(),
      `Draft:\n${applicantStatement}`,
      factsSection,
      'Complete these sections with your own details before using the draft:',
      ...missingSections.map((item) => `- ${item}`),
    ].filter(Boolean).join('\n\n');

    const draft = this.drafts.create({ userId, opportunityId: opportunity.id, prompt: dto.prompt?.trim() ?? null, content });
    return this.drafts.save(draft);
  }

  list(userId: string) {
    return this.drafts.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  private profileFacts(profile: Profile | null): string[] {
    if (!profile) return [];
    const facts: string[] = [];
    const add = (label: string, value: unknown) => {
      if (value !== null && value !== undefined && value !== '') {
        const formatted = Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
            ? String(value)
            : JSON.stringify(value);
        facts.push(`Profile — ${label}: ${formatted}`);
      }
    };
    add('citizenship', profile.citizenship);
    add('country of residence', profile.residenceCountry);
    add('education level', profile.educationLevel);
    add('field of study', profile.fieldOfStudy);
    add('institution', profile.institution);
    add('GPA', profile.gpa);
    add('graduation year', profile.graduationYear);
    add('languages', profile.languages);
    add('test scores', profile.testScores ? Object.entries(profile.testScores).map(([name, score]) => `${name}: ${JSON.stringify(score)}`).join(', ') : null);
    add('years of experience', profile.experienceYears);
    add('goals', profile.goals);
    return facts;
  }
}