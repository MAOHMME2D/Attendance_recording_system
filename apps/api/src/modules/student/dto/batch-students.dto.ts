import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateStudentDto } from './create-student.dto';

export class BatchStudentsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CreateStudentDto)
  students!: CreateStudentDto[];
}
