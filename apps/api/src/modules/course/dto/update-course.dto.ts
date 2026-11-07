import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  @Max(4, { message: 'المرحلة يجب أن تكون بين 1 و4' })
  stage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
