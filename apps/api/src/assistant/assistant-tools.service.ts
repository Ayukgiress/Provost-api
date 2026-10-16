import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OpportunityType } from '@provost/database';
import { z } from 'zod';
import { MatchesService } from '../me/matches/matches.service.js';
import { ProfileService } from '../me/profile/profile.service.js';
import { SavedService } from '../me/saved/saved.service.js';
import { OpportunitiesService } from '../opportunities/opportunities.service.js';
import { AssistantRepository } from './assistant.repository.js';
import type { AssistantToolDefinition } from './providers/model-provider.js';

const verdictSchema = z.enum(['apply', 'fix_first', 'skip']);
const searchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  type: z.nativeEnum(OpportunityType).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  level: z.string().trim().min(1).max(100).optional(),
  field: z.string().trim().min(1).max(150).optional(),
  closingSoon: z.boolean().optional(),
  limit: z.number().int().min(1).max(5).default(5),
}).strict();
const idSchema = z.object({ id: z.string().uuid() }).strict();
const matchesSchema = z.object({
  verdict: verdictSchema.optional(),
  type: z.nativeEnum(OpportunityType).optional(),
  limit: z.number().int().min(1).max(5).default(5),
}).strict();
const explanationSchema = z.object({ opportunityId: z.string().uuid() }).strict();
const saveSchema = z.object({ opportunityId: z.string().uuid() }).strict();

export interface AssistantOpportunityCard {
  id: string;
  slug: string;
  title: string;
  funder: string;
  amount: string | null;
  currency: string | null;
  deadline: Date | null;
  verdict: 'apply' | 'fix_first' | 'skip';
  fitScore: number;
  verifiedAt: Date | null;
}

export interface AssistantConfirmationRequest {
  actionId: string;
  action: 'save_opportunity';
  opportunityId: string;
  title: string;
}

export interface AssistantToolResult {
  result: unknown;
  cards: AssistantOpportunityCard[];
  confirmRequest?: AssistantConfirmationRequest;
}

export interface AssistantToolContext {
  userId: string;
  conversationId: string;
}

const TOOL_DEFINITIONS: AssistantToolDefinition[] = [
  { name: 'search_opportunities', description: 'Search currently published, unexpired opportunities. Use opportunity IDs in responses.', parameters: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 200 }, type: { type: 'string', enum: Object.values(OpportunityType) }, country: { type: 'string' }, level: { type: 'string' }, field: { type: 'string' }, closingSoon: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['query'], additionalProperties: false } },
  { name: 'get_opportunity', description: 'Get a currently published opportunity by its UUID.', parameters: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false } },
  { name: 'get_my_matches', description: 'Get match results for the signed-in user only.', parameters: { type: 'object', properties: { verdict: { type: 'string', enum: ['apply', 'fix_first', 'skip'] }, type: { type: 'string', enum: Object.values(OpportunityType) }, limit: { type: 'integer', minimum: 1, maximum: 5 } }, additionalProperties: false } },
  { name: 'explain_match', description: 'Return the app-computed match verdict, fit score, reasons and checklist for an opportunity.', parameters: { type: 'object', properties: { opportunityId: { type: 'string', format: 'uuid' } }, required: ['opportunityId'], additionalProperties: false } },
  { name: 'get_profile_gaps', description: 'List missing or weak matching-relevant fields on the signed-in user profile.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'save_opportunity', description: 'Create a request to save an opportunity. Saving requires explicit user confirmation through the app.', parameters: { type: 'object', properties: { opportunityId: { type: 'string', format: 'uuid' } }, required: ['opportunityId'], additionalProperties: false } },
];

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly matches: MatchesService,
    private readonly profiles: ProfileService,
    private readonly saved: SavedService,
    private readonly repository: AssistantRepository,
  ) {}

  getDefinitions(): AssistantToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  async execute(name: string, rawArguments: unknown, context: AssistantToolContext): Promise<AssistantToolResult> {
    switch (name) {
      case 'search_opportunities': return this.searchOpportunities(searchSchema.parse(rawArguments), context.userId);
      case 'get_opportunity': return this.getOpportunity(idSchema.parse(rawArguments), context.userId);
      case 'get_my_matches': return this.getMyMatches(matchesSchema.parse(rawArguments), context.userId);
      case 'explain_match': return this.explainMatch(explanationSchema.parse(rawArguments), context.userId);
      case 'get_profile_gaps':
        z.object({}).strict().parse(rawArguments);
        return { result: await this.getProfileGaps(context.userId), cards: [] };
      case 'save_opportunity': return this.requestSave(saveSchema.parse(rawArguments), context);
      default: throw new BadRequestException({ code: 'unknown_tool', message: `Unknown assistant tool: ${name}` });
    }
  }

  private async searchOpportunities(input: z.infer<typeof searchSchema>, userId: string): Promise<AssistantToolResult> {
    const items = await this.opportunities.assistantSearch({ ...input, closingSoon: input.closingSoon ?? false });
    const cards = await this.cardsFor(userId, items.map((item) => item.id));
    const descriptions = new Map(items.map((item) => [item.id, item.summary ?? null]));
    return { result: { opportunityIds: cards.map((card) => card.id), summaries: cards.map((card) => ({ id: card.id, summary: descriptions.get(card.id) })) }, cards };
  }

  private async getOpportunity(input: z.infer<typeof idSchema>, userId: string): Promise<AssistantToolResult> {
    const opportunity = await this.opportunities.assistantGetById(input.id);
    const cards = await this.cardsFor(userId, [opportunity.id]);
    if (cards.length === 0) throw new NotFoundException('Published, unexpired opportunity not found');
    return {
      result: { opportunityId: opportunity.id, summary: opportunity.summary, requirements: opportunity.requirements, documentsNeeded: opportunity.documentsNeeded },
      cards,
    };
  }

  private async getMyMatches(input: z.infer<typeof matchesSchema>, userId: string): Promise<AssistantToolResult> {
    const matches = await this.matches.list(userId, { verdict: input.verdict, type: input.type, limit: 100, page: 1 });
    const ids = matches.items.slice(0, input.limit).map((match) => match.opportunity.id);
    const cards = await this.cardsFor(userId, ids);
    return { result: { opportunityIds: cards.map((card) => card.id) }, cards };
  }

  private async explainMatch(input: z.infer<typeof explanationSchema>, userId: string): Promise<AssistantToolResult> {
    const match = await this.matches.explain(userId, input.opportunityId);
    if (!match) throw new NotFoundException('Published, unexpired opportunity not found');
    const cards = await this.cardsFor(userId, [match.opportunity.id]);
    if (cards.length === 0) throw new NotFoundException('Published, unexpired opportunity not found');
    return {
      result: { opportunityId: match.opportunity.id, verdict: match.verdict, fitScore: match.fitScore, reasons: match.reasons, checklist: match.checklist },
      cards,
    };
  }

  private async getProfileGaps(userId: string) {
    const profile = await this.profiles.get(userId);
    const values: Array<[string, unknown]> = [
      ['citizenship', profile.citizenship],
      ['residenceCountry', profile.residenceCountry],
      ['birthYear', profile.birthYear],
      ['educationLevel', profile.educationLevel],
      ['fieldOfStudy', profile.fieldOfStudy],
      ['gpa', profile.gpa],
      ['experienceYears', profile.experienceYears],
      ['languages', profile.languages],
      ['testScores', profile.testScores],
      ['goals', profile.goals],
    ];
    return {
      completeness: profile.completeness,
      gaps: values.filter(([, value]) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0)).map(([field]) => field),
    };
  }

  private async requestSave(input: z.infer<typeof saveSchema>, context: AssistantToolContext): Promise<AssistantToolResult> {
    const [opportunity, conversation, allowed] = await Promise.all([
      this.opportunities.assistantGetById(input.opportunityId),
      this.repository.findOwnedConversation(context.conversationId, context.userId),
      this.saved.canSave(context.userId, input.opportunityId),
    ]);
    if (!conversation) throw new NotFoundException('Assistant conversation not found');
    if (!allowed) return { result: { status: 'limit_reached', message: 'The Free plan allows up to 3 active saved items.' }, cards: [] };
    const action = await this.repository.createPendingAction({
      conversationId: conversation.id,
      userId: context.userId,
      action: 'save_opportunity',
      payload: { opportunityId: opportunity.id },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return {
      result: { status: 'confirmation_required', actionId: action.id, opportunityId: opportunity.id },
      cards: await this.cardsFor(context.userId, [opportunity.id]),
      confirmRequest: { actionId: action.id, action: 'save_opportunity', opportunityId: opportunity.id, title: opportunity.title },
    };
  }

  private async cardsFor(userId: string, ids: string[]): Promise<AssistantOpportunityCard[]> {
    if (ids.length === 0) return [];
    const verified = await this.opportunities.assistantGetPublishedByIds(ids);
    const verifiedIds = new Set(verified.map((opportunity) => opportunity.id));
    const output: AssistantOpportunityCard[] = [];
    for (const id of new Set(ids)) {
      if (!verifiedIds.has(id)) continue;
      const match = await this.matches.explain(userId, id);
      if (!match) continue;
      const opportunity = match.opportunity;
      output.push({
        id: opportunity.id,
        slug: opportunity.slug,
        title: opportunity.title,
        funder: opportunity.funder.name,
        amount: opportunity.amount,
        currency: opportunity.currency,
        deadline: opportunity.deadline,
        verdict: match.verdict,
        fitScore: match.fitScore,
        verifiedAt: opportunity.verifiedAt,
      });
    }
    return output;
  }
}