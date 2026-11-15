import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: 'رمز المادة مطلوب' })
  @MaxLength(40)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم المادة مطلوب' })
  @MaxLength(200)
  name!: string;

  @IsInt()
  @Min(1, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  @Max(4, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  stage!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** THEORETICAL (نظري), PRACTICAL (عملي), or BOTH (نظري وعملي). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;
}
