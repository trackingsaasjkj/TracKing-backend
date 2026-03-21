import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateGlobalConfigDto {
  @IsString()
  @IsNotEmpty()
  value!: string;
}
