# Guía de contribución

## Convenciones de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<alcance>): <descripción corta>
```

Tipos válidos:
- `feat` — nueva funcionalidad
- `fix` — corrección de bug
- `refactor` — refactor sin cambio de comportamiento
- `test` — agregar o corregir tests
- `docs` — solo documentación
- `chore` — tareas de mantenimiento (deps, config)
- `perf` — mejora de rendimiento

Ejemplos:
```
feat(servicios): agregar paginación en listado de servicios
fix(auth): corregir validación de refresh token expirado
test(liquidaciones): agregar tests unitarios para calcular-liquidacion
```

## Branching

- `main` — producción, solo merge via PR aprobado
- `develop` — integración, base para features
- `feat/<nombre>` — nueva funcionalidad
- `fix/<nombre>` — corrección de bug
- `chore/<nombre>` — mantenimiento

## Flujo de trabajo

1. Crear rama desde `develop`: `git checkout -b feat/mi-feature develop`
2. Hacer commits siguiendo las convenciones
3. Asegurarse de que `npm run lint` y `npm run test` pasen
4. Abrir PR hacia `develop` con descripción clara del cambio
5. Requiere al menos 1 aprobación antes de merge

## Estándares de código

- TypeScript strict habilitado — no usar `any` sin justificación
- Cada use-case debe tener test unitario correspondiente
- Los repositorios siempre deben filtrar por `company_id`
- No modificar lógica de dominio sin actualizar los tests de reglas
- Usar `Logger` de NestJS, nunca `console.log`

## Ejecutar el proyecto localmente

Ver [README.md](./README.md) para instrucciones de instalación y configuración.


## Búsqueda de Clientes

### Endpoints Disponibles

#### Buscar por nombre
```
GET /api/customers/search?name=Juan
```

Retorna cliente exacto (case-insensitive).

#### Buscar por teléfono (NUEVO)
```
GET /api/customers/by-phone/3105567788
```

Busca cliente por teléfono normalizado. Acepta formatos:
- `3105567788` (sin formato)
- `310 556 7788` (con espacios)
- `310-556-7788` (con guiones)
- `+57 310 556 7788` (con código país)

Retorna cliente o `null` si no existe.

### Implementación

**Normalización de teléfono**:
```typescript
const normalized = phone.replace(/\D/g, '');  // Remover todo excepto dígitos
```

**Validación**:
- Mínimo 7 dígitos
- Lanza `BadRequestException` si es inválido

**Búsqueda**:
- Usa `contains` para flexibilidad
- Filtra por `company_id` (scoping)
- Solo clientes activos (`status: true`)

### Casos de Uso

**Caso 1: Crear servicio desde mensaje de WhatsApp**
1. Parser extrae teléfono del mensaje
2. Llamar `GET /api/customers/by-phone/{phone}`
3. Si existe: usar cliente existente
4. Si no existe: crear cliente nuevo

**Caso 2: Evitar duplicados**
- Antes de crear cliente, verificar si existe por teléfono
- Reutilizar cliente existente si se encuentra

### Testing

```typescript
// Buscar cliente existente
const customer = await api.get('/customers/by-phone/3105567788');
expect(customer.data.name).toBe('Juan Pérez');

// Cliente no existe
const notFound = await api.get('/customers/by-phone/9999999999');
expect(notFound.data).toBeNull();

// Teléfono inválido
const invalid = await api.get('/customers/by-phone/123');
expect(invalid.status).toBe(400);
```

