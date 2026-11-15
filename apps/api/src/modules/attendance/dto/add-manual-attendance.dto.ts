import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddManualAttendanceDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الطالب أو رقمه مطلوب' })
  @MaxLength(200)
  studentName!: string;

  @IsOptional()
  @IsIn(['PRESENT', 'ABSENT'], { message: 'حالة الحضور غير صالحة' })
  status?: 'PRESENT' | 'ABSENT';
}
