import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLectureDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم المحاضرة مطلوب' })
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'], { message: 'الفترة الدراسية غير صحيحة' })
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  section?: string;

  /** Stable section reference; kept for backwards compatibility (single section). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  /** Stable section references; several sections may share one lecture. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'اختر شعبة واحدة على الأقل' })
  @ArrayMaxSize(50)
  @IsString({ each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  courseId?: string;
}
