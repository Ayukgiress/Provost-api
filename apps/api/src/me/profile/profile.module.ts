import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '@provost/database';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({ imports: [TypeOrmModule.forFeature([Profile])], controllers: [ProfileController], providers: [ProfileService], exports: [ProfileService] })
export class ProfileModule {}
