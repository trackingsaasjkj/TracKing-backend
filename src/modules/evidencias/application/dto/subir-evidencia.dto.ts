import { IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubirEvidenciaDto {
  @ApiProperty({
    example: 'https://cdn.example.com/evidencias/foto-entrega.jpg',
    description: 'URL pública o pre-firmada de la imagen de evidencia. Para upload directo, integrar con S3/Cloudinary.',
  })
  @IsString()
  @IsUrl()
  image_url: string;
}
