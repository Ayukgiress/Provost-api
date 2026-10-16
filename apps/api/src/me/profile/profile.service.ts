import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from '@provost/database';
import { Repository } from 'typeorm';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

const COMPLETENESS_FIELDS: Array<keyof UpdateProfileDto> = [
  'citizenship', 'residenceCountry', 'birthYear', 'educationLevel', 'fieldOfStudy',
  'institution', 'gpa', 'graduationYear', 'languages', 'testScores',
  'experienceYears', 'goals',
];

@Injectable()
export class ProfileService {
  constructor(@InjectRepository(Profile) private readonly profiles: Repository<Profile>) {}

  async get(userId: string, email?: string): Promise<Profile & { completeness: number }> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (profile) {
      if (email && profile.email !== email) {
        profile.email = email;
        return this.profiles.save(profile);
      }
      return profile;
    }
    const created = this.profiles.create({ userId, email: email ?? null, completeness: 0 });
    return email ? this.profiles.save(created) : created;
  }

  async update(userId: string, dto: UpdateProfileDto, email?: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } }) ??
      this.profiles.create({ userId, email: email ?? null });
    Object.assign(profile, dto);
    if (email) profile.email = email;
    profile.completeness = this.calculateCompleteness(profile);
    return this.profiles.save(profile);
  }

  private calculateCompleteness(profile: Profile): number {
    const filled = COMPLETENESS_FIELDS.filter((field) => {
      const value = profile[field as keyof Profile];
      return value !== null && value !== undefined && value !== '' &&
        (!Array.isArray(value) || value.length > 0) &&
        (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);
    }).length;
    return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
  }
}
