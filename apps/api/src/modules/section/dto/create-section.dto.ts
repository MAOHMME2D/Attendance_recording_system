import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @IsIn(['MORNING', 'EVENING'], { message: 'نوع الدراسة غير صالح' })
  studyPeriod!: 'MORNING' | 'EVENING';

  @IsString()
  @IsNotEmpty({ message: 'اسم الشعبة مطلوب' })
  @MaxLength(40)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
