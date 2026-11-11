import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'معرف الموظف مطلوب' })
  @MaxLength(64)
  staffId!: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(6, { message: 'كلمة المرور قصيرة جداً' })
  @MaxLength(200)
  password!: string;
}
