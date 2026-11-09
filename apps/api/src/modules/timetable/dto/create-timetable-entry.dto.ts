import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimetableEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'المادة مطلوبة' })
  @MaxLength(64)
  courseId!: string;

  @IsString()
  @IsNotEmpty({ message: 'الشعبة مطلوبة' })
  @MaxLength(64)
  sectionId!: string;

  /** 0 = Sunday ... 6 = Saturday (Iraqi academic week). */
  @Type(() => Number)
  @IsInt({ message: 'يوم الأسبوع يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'يوم الأسبوع غير صالح' })
  @Max(6, { message: 'يوم الأسبوع غير صالح' })
  dayOfWeek!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'وقت النهاية يجب أن يكون بصيغة HH:mm',
  })
  endTime!: string;
}
