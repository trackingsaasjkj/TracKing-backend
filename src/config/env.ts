import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() @IsNotEmpty() DATABASE_URL!: string;
  @IsString() @IsNotEmpty() JWT_SECRET!: string;
  @IsString() @IsNotEmpty() JWT_REFRESH_SECRET!: string;
  @IsString() JWT_EXPIRES_IN: string = '15m';
  @IsString() JWT_REFRESH_EXPIRES_IN: string = '7d';
  @IsNumber() PORT: number = 3000;

  @IsOptional() @IsString() SWAGGER_ENABLED?: string;
  @IsOptional() @IsString() SWAGGER_USER?: string;
  @IsOptional() @IsString() SWAGGER_PASSWORD?: string;

  @IsString() @IsNotEmpty() SUPABASE_URL!: string;
  @IsOptional() @IsString() SUPABASE_SERVICE_ROLE_KEY?: string;
  @IsOptional() @IsString() SUPABASE_STORAGE_BUCKET?: string;

  @IsOptional() @IsString() MAPBOX_ACCESS_TOKEN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated);
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
