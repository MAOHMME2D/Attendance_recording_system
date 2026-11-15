import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetAcademicYearDto {
  /** Must match ACADEMIC_YEAR_RESET_PHRASE exactly. */
  @IsString()
  @MinLength(1, { message: 'اكتب عبارة التأكيد' })
  @MaxLength(60)
  confirm!: string;
}
