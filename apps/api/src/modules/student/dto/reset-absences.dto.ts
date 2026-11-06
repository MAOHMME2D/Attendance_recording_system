import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResetAbsencesDto {
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
  studentId?: string;

  @IsOptional()
  @IsIn(['ABSENCES_ONLY', 'ALL_ATTENDANCE'])
  resetType?: 'ABSENCES_ONLY' | 'ALL_ATTENDANCE';
}
