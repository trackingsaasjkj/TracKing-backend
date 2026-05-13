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
  @IsOptional() @IsString() OPENAI_API_KEY?: string;

  @IsOptional() @IsString() SEARCH_PROVIDER?: string;  // default: 'google' (or 'mapbox')

  @IsOptional() @IsString() GOOGLE_MAPS_API_KEY?: string;
  @IsOptional() @IsString() GOOGLE_MAPS_COUNTRY?: string;        // default: 'co'
  @IsOptional() @IsString() GOOGLE_MAPS_PROXIMITY_LNG?: string;  // default: -73.122742 (Bucaramanga)
  @IsOptional() @IsString() GOOGLE_MAPS_PROXIMITY_LAT?: string;  // default: 7.119349  (Bucaramanga)

  @IsOptional() @IsString() MAPBOX_ACCESS_TOKEN?: string;
  @IsOptional() @IsString() MAPBOX_COUNTRY?: string;        // default: 'co'
  @IsOptional() @IsString() MAPBOX_PROXIMITY_LNG?: string;  // default: -73.122742 (Bucaramanga)
  @IsOptional() @IsString() MAPBOX_PROXIMITY_LAT?: string;  // default: 7.119349  (Bucaramanga)

  // Firebase Admin SDK (notificaciones push FCM)
  // Opción recomendada para Render: JSON del service account en base64
  @IsOptional() @IsString() FIREBASE_SERVICE_ACCOUNT_BASE64?: string;
  // Opción alternativa (dev local): variables individuales
  @IsOptional() @IsString() FIREBASE_PROJECT_ID?: string;
  @IsOptional() @IsString() FIREBASE_CLIENT_EMAIL?: string;
  @IsOptional() @IsString() FIREBASE_PRIVATE_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated);
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
