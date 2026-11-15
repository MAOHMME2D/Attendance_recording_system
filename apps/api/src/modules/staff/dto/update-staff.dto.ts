import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CREATABLE_STAFF_ROLES } from '../../../common/constants/roles';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/, {
    message:
      'معرف الموظف يجب أن يبدأ بحرف أو رقم ويحتوي أحرفًا لاتينية وأرقامًا ونقاطًا أو شرطات فقط',
  })
  staffId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'اسم الموظف قصير جدًا' })
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn([...CREATABLE_STAFF_ROLES], { message: 'صلاحية الموظف غير مسموحة' })
  role?: string;
}
