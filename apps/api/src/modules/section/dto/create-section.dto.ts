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

export class CreateSectionDto {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  @Max(4, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  stage?: number;

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
