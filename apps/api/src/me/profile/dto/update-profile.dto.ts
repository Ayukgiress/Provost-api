import { ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel } from '@provost/database';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'US' })
  @IsOptional() @IsString() @MaxLength(100)
  citizenship?: string | null;

  @ApiPropertyOptional({ example: 'CA' })
  @IsOptional() @IsString() @MaxLength(100)
  residenceCountry?: string | null;

  @ApiPropertyOptional({ description: 'Opt out of deadline reminder emails', default: true })
  @IsOptional() @IsBoolean()
  deadlineRemindersEnabled?: boolean;

  @ApiPropertyOptional({ example: 1998, minimum: 1900, maximum: 2100 })
  @IsOptional() @IsInt() @Min(1900) @Max(2100)
  birthYear?: number | null;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional() @IsEnum(EducationLevel)
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional() @IsString() @MaxLength(200)
  fieldOfStudy?: string | null;

  @ApiPropertyOptional({ example: 'Example University' })
  @IsOptional() @IsString() @MaxLength(200)
  institution?: string | null;

  @ApiPropertyOptional({ example: 3.7, minimum: 0, maximum: 4 })
  @IsOptional() @IsNumber() @Min(0) @Max(4)
  gpa?: number | null;

  @ApiPropertyOptional({ example: 2027 })
  @IsOptional() @IsInt() @Min(1900) @Max(2200)
  graduationYear?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  languages?: string[] | null;

  @ApiPropertyOptional({ example: { gre: 320, toefl: 105 } })
  @IsOptional() @IsObject()
  testScores?: Record<string, number> | null;

  @ApiPropertyOptional({ example: 2, minimum: 0, maximum: 80 })
  @IsOptional() @IsInt() @Min(0) @Max(80)
  experienceYears?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  goals?: string[] | null;
}
