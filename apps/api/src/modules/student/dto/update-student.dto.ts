import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;
}
