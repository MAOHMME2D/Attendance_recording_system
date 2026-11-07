import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetStaffPasswordDto {
  @IsString()
  @MinLength(12, { message: 'كلمة المرور يجب أن تكون 12 حرفًا على الأقل' })
  @MaxLength(200)
  password!: string;
}
