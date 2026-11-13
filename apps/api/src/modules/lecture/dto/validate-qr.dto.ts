import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateQrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;
}
