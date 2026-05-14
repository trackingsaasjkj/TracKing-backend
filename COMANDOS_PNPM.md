# Comandos TracKing — pnpm

> Tras la migración de npm a pnpm, todos los comandos usan `pnpm` en lugar de `npm run`.
> Ejecutar `npm install` o `yarn` en cualquier proyecto fallará — está bloqueado por `.npmrc`.

---

## Instalación inicial

Antes de usar cualquier proyecto por primera vez, o después de clonar el repositorio:

```bash
# Dentro de cada proyecto (no en la raíz de TracKing 1)
cd TracKing-backend  &&  pnpm install
cd TracKing-frontend &&  pnpm install
cd TracKing-mobile   &&  pnpm install
```

> El backend requiere además generar el cliente Prisma después de instalar:
> ```bash
> pnpm prisma:generate
> ```

---

## TracKing-backend

### Desarrollo

```bash
# Iniciar en modo desarrollo con hot-reload
pnpm start:dev

# Iniciar desde el build compilado (producción local)
pnpm start:prod

# Compilar el proyecto (genera Prisma client + transpila TypeScript)
pnpm build
```

### Prisma

```bash
# Generar el cliente TypeScript desde el schema
# Ejecutar siempre después de cambiar prisma/schema.prisma
pnpm prisma:generate

# Aplicar migraciones pendientes en la base de datos (producción / staging)
pnpm prisma:migrate

# Crear y aplicar una nueva migración en desarrollo
pnpm prisma:migrate:dev

# Abrir Prisma Studio (interfaz visual de la base de datos)
pnpm prisma:studio
```

### Tests

```bash
# Ejecutar todos los tests (modo watch — para desarrollo)
pnpm test

# Ejecutar todos los tests una sola vez (sin watch — para CI)
pnpm test:run

# Ejecutar tests con reporte de cobertura
pnpm test:cov
```

### Calidad de código

```bash
# Lint con auto-fix
pnpm lint

# Formatear código con Prettier
pnpm format
```

---

## TracKing-frontend

### Desarrollo

```bash
# Iniciar servidor de desarrollo Vite (http://localhost:5173)
pnpm dev

# Compilar para producción
pnpm build

# Previsualizar el build de producción localmente
pnpm preview
```

### Tests

```bash
# Ejecutar todos los tests una sola vez
pnpm test
```

### Calidad de código

```bash
# Lint
pnpm lint
```

---

## TracKing-mobile

### Desarrollo

```bash
# Iniciar servidor Expo (abre QR para Expo Go)
pnpm start

# Iniciar y abrir en emulador Android
pnpm android

# Iniciar y abrir en simulador iOS
pnpm ios

# Iniciar versión web
pnpm web
```

### Tests

```bash
# Ejecutar todos los tests una sola vez
pnpm test
```

---

## Seguridad y auditoría

Ejecutar en cualquier proyecto para revisar vulnerabilidades:

```bash
# Ver todas las vulnerabilidades
pnpm audit

# Ver solo high y critical (las que bloquean CI)
pnpm audit --audit-level=high

# Instalar dependencias respetando el lockfile exacto (modo CI)
pnpm install --frozen-lockfile
```

---

## Actualizar dependencias

```bash
# Ver qué dependencias tienen actualizaciones disponibles
pnpm outdated

# Actualizar una dependencia específica dentro del rango declarado en package.json
pnpm update <paquete>

# Actualizar a la última versión ignorando el rango (requiere revisar breaking changes)
pnpm update <paquete> --latest
```

> Para `axios` y `@tanstack/react-query` las versiones están fijadas sin `^` en `package.json`.
> Para actualizarlas hay que editar `package.json` manualmente y luego correr `pnpm install`.

---

## Notas importantes

- **No usar `npm install`** — está bloqueado. Usar siempre `pnpm install`.
- **El backend requiere `pnpm prisma:generate`** después de cada `pnpm install` en un entorno nuevo, o después de cambiar el schema de Prisma.
- **El mobile usa `node-linker=hoisted`** (configurado en `.npmrc`) — necesario para que Metro bundler resuelva los módulos nativos correctamente.
- **`pnpm-lock.yaml`** es el lockfile de cada proyecto. Cualquier cambio inesperado en este archivo al hacer `pnpm install` debe investigarse antes de hacer commit.
