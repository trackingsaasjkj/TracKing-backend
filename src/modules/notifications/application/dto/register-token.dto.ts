import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({
    example: 'dGhpcyBpcyBhIHNhbXBsZSBGQ00gdG9rZW4...',
    description: 'FCM token del dispositivo del mensajero',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}
