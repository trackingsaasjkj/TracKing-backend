# Bugfix Requirements Document

## Introduction

Se identificaron tres bugs relacionados con la visualización del estado operacional de mensajeros (`operational_status: AVAILABLE | UNAVAILABLE | IN_SERVICE`) en el frontend web de TracKing. Los bugs afectan el Dashboard, la página de Usuarios y la página de Mensajeros, causando conteos incorrectos, estados siempre fijos y paneles de detalle ocultos por el mapa.

---

## Bug Analysis

### Current Behavior (Defect)

**BUG 1 — Card "Mensajeros Disponibles" en Dashboard siempre muestra 0 o un conteo incorrecto**

1.1 WHEN el backend devuelve mensajeros con `operational_status = 'AVAILABLE'` desde `/bff/active-orders` THEN el sistema muestra 0 en la card "Mensajeros Disponibles" porque el filtro frontend `=== 'AVAILABLE'` opera sobre el campo `status` (alias copiado) pero no siempre coincide con el campo original `operational_status`

1.2 WHEN existen mensajeros con `operational_status = 'IN_SERVICE'` (activos en un servicio) THEN el sistema los excluye del conteo de la card "Mensajeros Disponibles", ocultando mensajeros que están operativamente activos

1.3 WHEN `BffActiveOrdersUseCase` y `BffDashboardUseCase` llaman a `consultarMensajeros.findActivos()` THEN el sistema solo retorna mensajeros con `operational_status = 'AVAILABLE'`, excluyendo los `IN_SERVICE`

**BUG 2 — Página de Usuarios siempre muestra "Disponible" para mensajeros**

1.4 WHEN la tabla de usuarios renderiza la columna "Estado" para un usuario con `role = 'COURIER'` THEN el sistema muestra siempre "Disponible" porque usa `row.status` (booleano de actividad del usuario en el sistema) en lugar del `operational_status` del mensajero
