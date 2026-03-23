# Guía para crear un nuevo módulo

Convenciones y estructura estándar para agregar un módulo al proyecto TracKing.

## Estructura de carpetas

```
src/modules/<nombre>/
├── application/
│   ├── dto/
│   │   ├── create-<nombre>.dto.ts
│   │   └── update-<nombre>.dto.ts
│   └── use-cases/
│       └── <nombre>.use-cases.ts
├── infrastructure/
│   └── <nombre>.repository.ts
├── <nombre>.controller.ts
└── <nombre>.module.ts
```

## 1. DTOs

Usar `class-validator` y `@nestjs/swagger` en todos los campos.

```typescript
// create-<nombre>.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create<Nombre>Dto {
  @ApiProperty({ example: 'valor' })
  @IsString()
  @IsNotEmpty()
  campo!: string;
}
```

Reglas:
- Campos requeridos: decoradores sin `@IsOptional()`
- Campos opcionales: agregar `@IsOptional()` y usar `?` en el tipo
- Siempre incluir `@ApiProperty` o `@ApiPropertyOptional` para Swagger

## 2. Repository

Acceso directo a Prisma. Sin lógica de negocio.

```typescript
@Injectable()
export class <Nombre>Repository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(company_id: string) {
    return this.prisma.<modelo>.findMany({ where: { company_id } });
  }

  findById(id: string, company_id: string) {
    return this.prisma.<modelo>.findFirst({ where: { id, company_id } });
  }

  create(data: { company_id: string; [key: string]: any }) {
    return this.prisma.<modelo>.create({ data });
  }

  update(id: string, company_id: string, data: Partial<...>) {
    return this.prisma.<modelo>.updateMany({ where: { id, company_id }, data });
  }
}
```

Reglas:
- Siempre filtrar por `company_id` para garantizar aislamiento multi-tenant
- Usar `findFirst` en lugar de `findUnique` cuando el filtro incluye `company_id`
- Usar `updateMany` / `deleteMany` con `{ id, company_id }` para evitar cross-tenant

## 3. Use Cases

Lógica de negocio. Orquesta el repository.

```typescript
@Injectable()
export class <Nombre>UseCases {
  constructor(private readonly repo: <Nombre>Repository) {}

  findAll(company_id: string) {
    return this.repo.findAll(company_id);
  }

  async findById(id: string, company_id: string) {
    const item = await this.repo.findById(id, company_id);
    if (!item) throw new NotFoundException('<Entidad> no encontrada');
    return item;
  }

  create(dto: Create<Nombre>Dto, company_id: string) {
    return this.repo.create({ ...dto, company_id });
  }

  async update(id: string, dto: Update<Nombre>Dto, company_id: string) {
    await this.findById(id, company_id);
    await this.repo.update(id, company_id, dto);
    return this.repo.findById(id, company_id);
  }
}
```

Reglas:
- Lanzar `NotFoundException` cuando un recurso no existe
- Lanzar `ConflictException` para duplicados
- Lanzar `BadRequestException` para validaciones de negocio
- Usar `prisma.$transaction()` cuando múltiples escrituras deben ser atómicas

## 4. Controller

```typescript
@ApiTags('<Nombre>')
@ApiBearerAuth('access-token')
@Controller('api/<nombre>')
@UseGuards(RolesGuard)
export class <Nombre>Controller {
  constructor(private readonly useCases: <Nombre>UseCases) {}

  @Get()
  @Roles(Role.ADMIN, Role.AUX)
  async findAll(@CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.findAll(user.company_id!));
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: Create<Nombre>Dto, @CurrentUser() user: JwtPayload) {
    return ok(await this.useCases.create(dto, user.company_id!));
  }
}
```

Reglas:
- Siempre usar `ok()` de `response.util` para el formato estándar `{ success, data }`
- El `company_id` siempre viene de `@CurrentUser()`, nunca del body
- Decorar todos los endpoints con `@ApiOperation` y `@ApiResponse`
- Endpoints públicos: agregar `@Public()` de `public.decorator`

## 5. Module

```typescript
@Module({
  controllers: [<Nombre>Controller],
  providers: [<Nombre>UseCases, <Nombre>Repository],
  exports: [<Nombre>Repository], // solo si otros módulos lo necesitan
})
export class <Nombre>Module {}
```

## 6. Registrar en AppModule

Agregar en `src/app.module.ts`:

```typescript
import { <Nombre>Module } from './modules/<nombre>/<nombre>.module';

@Module({
  imports: [
    ...
    <Nombre>Module,
  ],
})
export class AppModule {}
```

## 7. Documentación

Crear `docs/<nombre>.md` con:
- Objetivo del módulo
- Tabla de endpoints con método, ruta, roles y descripción
- Ejemplos de request/response
- Reglas de negocio
- Tabla de archivos relevantes

## Checklist

- [ ] DTOs con validaciones y decoradores Swagger
- [ ] Repository con todas las queries scoped por `company_id`
- [ ] Use cases con manejo de errores (`NotFoundException`, `ConflictException`)
- [ ] Controller con roles, `@CurrentUser()` y `ok()`
- [ ] Module registrado en `AppModule`
- [ ] Sin errores en `getDiagnostics`
- [ ] Documentación en `docs/`
