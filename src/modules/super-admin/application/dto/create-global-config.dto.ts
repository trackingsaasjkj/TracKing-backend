import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGlobalConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
