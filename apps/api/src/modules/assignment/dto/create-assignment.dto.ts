import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty({ message: 'المحاضر مطلوب' })
  @MaxLength(64)
  staffUserId!: string;

  @IsString()
  @IsNotEmpty({ message: 'المادة مطلوبة' })
  @MaxLength(64)
  courseId!: string;
}

export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  staffUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  courseId?: string;
}
