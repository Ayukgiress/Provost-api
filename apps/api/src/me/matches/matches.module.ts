import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity, Profile } from '@provost/database';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

@Module({ imports: [TypeOrmModule.forFeature([Opportunity, Profile])], controllers: [MatchesController], providers: [MatchesService], exports: [MatchesService] })
export class MatchesModule {}
