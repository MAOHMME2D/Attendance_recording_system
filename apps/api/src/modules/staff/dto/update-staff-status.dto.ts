import { IsBoolean } from 'class-validator';

export class UpdateStaffStatusDto {
  @IsBoolean({ message: 'حالة الحساب يجب أن تكون قيمة منطقية' })
  isActive!: boolean;
}
