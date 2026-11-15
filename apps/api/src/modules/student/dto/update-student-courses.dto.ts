import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export type AcademicStatus = 'REGULAR' | 'REPEAT' | 'CARRY_OVER';

export class UpdateStudentCoursesDto {
  @IsIn(['REGULAR', 'REPEAT', 'CARRY_OVER'], {
    message: 'الحالة الأكاديمية يجب أن تكون REGULAR أو REPEAT أو CARRY_OVER',
  })
  academicStatus: AcademicStatus;

  @IsArray({ message: 'قائمة المواد يجب أن تكون مصفوفة' })
  @IsString({ each: true, message: 'معرف المادة غير صالح' })
  courseIds: string[];

  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصية' })
  notes?: string;
}

