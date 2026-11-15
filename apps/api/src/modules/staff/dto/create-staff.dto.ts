import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CREATABLE_STAFF_ROLES } from '../../../common/constants/roles';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'معرف الموظف مطلوب' })
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/, {
    message:
      'معرف الموظف يجب أن يبدأ بحرف أو رقم ويحتوي أحرفًا لاتينية وأرقامًا ونقاطًا أو شرطات فقط',
  })
  staffId!: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم الموظف مطلوب' })
  @MinLength(2, { message: 'اسم الموظف قصير جدًا' })
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsIn([...CREATABLE_STAFF_ROLES], { message: 'صلاحية الموظف غير مسموحة' })
  role!: string;

  @IsString()
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
  @MaxLength(200)
  password!: string;
}
