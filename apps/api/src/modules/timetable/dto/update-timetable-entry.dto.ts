import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTimetableEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sectionId?: string;

  /** 0 = Sunday ... 6 = Saturday (Iraqi academic week). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'يوم الأسبوع يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'يوم الأسبوع غير صالح' })
  @Max(6, { message: 'يوم الأسبوع غير صالح' })
  dayOfWeek?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'وقت النهاية يجب أن يكون بصيغة HH:mm',
  })
  endTime?: string;

  /** THEORETICAL (نظري) or PRACTICAL (عملي). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  /** القاعة أو المختبر */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hall?: string;
}
