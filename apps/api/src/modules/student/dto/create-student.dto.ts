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

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'الباركود / الرقم التعريفي مطلوب' })
  @MaxLength(64)
  studentCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم الطالب مطلوب' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  orderIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  presentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  absentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rate?: number;
}
