import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ResetAbsencesDto {
  /**
   * Academic stage is required for any reset that is not limited to a single
   * student. Without it a reset would silently span every stage.
   */
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

  /** Stable section reference; preferred over the free-text `section`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentId?: string;

  @IsOptional()
  @IsIn(['ABSENCES_ONLY', 'ALL_ATTENDANCE'])
  resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
}
