import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * One spreadsheet row. `studentCode` may be empty: the server then generates
 * the next stage-prefixed code (S<stage>-<number>).
 */
export class ImportStudentRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم الطالب مطلوب' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  stage?: number;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  orderIndex?: number;
}

export class ImportStudentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  stage?: number;

  @IsOptional()
  @IsIn(['MORNING', 'EVENING'])
  studyPeriod?: 'MORNING' | 'EVENING';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'الملف لا يحتوي على صفوف' })
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportStudentRowDto)
  students!: ImportStudentRowDto[];
}
