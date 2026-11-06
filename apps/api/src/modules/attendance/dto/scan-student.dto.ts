import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The scanned value may be an opaque student QR token (preferred) or a legacy
 * sequential studentCode printed on cards made before Phase 1.
 */
export class ScanStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'رمز الطالب مطلوب' })
  @MaxLength(256)
  studentCode!: string;
}
