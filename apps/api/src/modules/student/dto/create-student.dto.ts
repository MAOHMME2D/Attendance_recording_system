import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم الطالب مطلوب' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  @Max(4, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  stage?: number;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  orderIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  presentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  absentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rate?: number;
}
