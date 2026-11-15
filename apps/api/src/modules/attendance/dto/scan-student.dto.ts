import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The scanned value must be an active opaque student QR token (`qr_...`).
 * Sequential studentCode values and student names are rejected by the service.
 */
export class ScanStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'رمز الطالب مطلوب' })
  @MaxLength(256)
  studentCode!: string;
}
