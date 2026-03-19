import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @IsNotEmpty() JWT_SECRET: string;
  @IsString() @IsNotEmpty() JWT_REFRESH_SECRET: string;
  @IsString() JWT_EXPIRES_IN: string = '15m';
  @IsString() JWT_REFRESH_EXPIRES_IN: string = '7d';
  @IsNumber() PORT: number = 3000;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated);
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
