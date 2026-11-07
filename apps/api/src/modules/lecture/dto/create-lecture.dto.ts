import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLectureDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم المحاضرة مطلوب' })
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'], { message: 'نوع الدراسة غير صالح' })
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  section?: string;

  /** Stable section reference; preferred over the free-text `section`. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  courseId?: string;
}
