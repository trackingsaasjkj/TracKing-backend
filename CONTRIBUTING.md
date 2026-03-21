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
