# Guía de integración — Tracking en tiempo real (Frontend)

> Esta guía cubre cómo mostrar la ubicación de los mensajeros en un mapa usando OpenStreetMap + Socket.IO.
> El backend ya está implementado y listo para consumir.

---

## Stack recomendado

| Librería | Uso |
|----------|-----|
| `socket.io-client` | Conexión WebSocket al backend |
| `leaflet` + `react-leaflet` | Mapa con OpenStreetMap (sin API key) |

```bash
npm install socket.io-client leaflet react-leaflet
npm install -D @types/leaflet
```

---

## 1. Conectar al WebSocket

El backend expone el namespace `/tracking`. Solo roles `ADMIN` y `AUX` pueden conectarse.

```ts
// lib/tracking-socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectTrackingSocket(token: string): Socket {
  socket = io('http://localhost:3000/tracking', {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
  });

  socket.on('connect', () => console.log('Tracking socket connected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
}

export function disconnectTrackingSocket() {
  socket?.disconnect();
  socket = null;
}
```

---

## 2. Escuchar el evento `location:updated`

El backend emite este evento cada vez que un mensajero envía su posición (~15s).

```ts
// Payload recibido
interface LocationUpdate {
  courier_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string; // ISO 8601
}

socket.on('location:updated', (data: LocationUpdate) => {
  // Actualizar el marker del mensajero en el mapa
  updateCourierMarker(data);
});
```

---

## 3. Mapa con OpenStreetMap (React)

```tsx
// components/TrackingMap.tsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { connectTrackingSocket, disconnectTrackingSocket } from '../lib/tracking-socket';

// Fix leaflet default icon (necesario en React)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface CourierPosition {
  courier_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface TrackingMapProps {
  token: string;
  // Posiciones iniciales cargadas via GET /api/tracking/:id/last
  initialPositions?: CourierPosition[];
}

export function TrackingMap({ token, initialPositions = [] }: TrackingMapProps) {
  const [positions, setPositions] = useState<Map<string, CourierPosition>>(
    new Map(initialPositions.map((p) => [p.courier_id, p]))
  );

  useEffect(() => {
    const socket = connectTrackingSocket(token);

    socket.on('location:updated', (data: CourierPosition) => {
      setPositions((prev) => new Map(prev).set(data.courier_id, data));
    });

    return () => disconnectTrackingSocket();
  }, [token]);

  return (
    <MapContainer
      center={[4.710989, -74.072092]} // Bogotá por defecto
      zoom={13}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {Array.from(positions.values()).map((pos) => (
        <Marker key={pos.courier_id} position={[pos.latitude, pos.longitude]}>
          <Popup>
            Mensajero: {pos.courier_id.slice(0, 8)}...
            <br />
            Última actualización: {new Date(pos.timestamp).toLocaleTimeString()}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

---

## 4. Cargar posiciones iniciales

Antes de conectar el socket, carga la última posición conocida de cada mensajero activo para que el mapa no empiece vacío.

```ts
// Obtener mensajeros activos
const couriers = await fetch('/api/mensajeros/activos', { headers }).then(r => r.json());

// Cargar última posición de cada uno en paralelo
const initialPositions = await Promise.allSettled(
  couriers.data.map((c: any) =>
    fetch(`/api/tracking/${c.id}/last`, { headers })
      .then(r => r.json())
      .then(res => ({ ...res.data, courier_id: c.id }))
  )
).then(results =>
  results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<any>).value)
);

// Pasar al componente
<TrackingMap token={accessToken} initialPositions={initialPositions} />
```

---

## 5. Uso completo en una página

```tsx
// pages/tracking.tsx (Next.js) o equivalente
import { TrackingMap } from '../components/TrackingMap';
import { useAuth } from '../hooks/useAuth'; // tu hook de auth

export default function TrackingPage() {
  const { token } = useAuth();

  if (!token) return <p>No autorizado</p>;

  return <TrackingMap token={token} />;
}
```

---

## Referencia de eventos Socket.IO

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `location:updated` | Server → Client | Nueva posición de un mensajero |

### Payload `location:updated`

```ts
{
  courier_id: string;   // UUID del mensajero
  latitude: number;     // -90 a 90
  longitude: number;    // -180 a 180
  accuracy?: number;    // Precisión en metros (opcional)
  timestamp: string;    // ISO 8601 — ej: "2026-01-01T12:00:00.000Z"
}
```

---

## Notas importantes

- El socket se autentica con el mismo JWT del login. Si el token expira, reconectar con el nuevo token.
- Solo se reciben ubicaciones de mensajeros de la misma empresa (`company_id` del token).
- El mensajero solo emite ubicación cuando está en estado `IN_SERVICE`. Si no hay eventos, el mensajero no está activo.
- OpenStreetMap no requiere API key. Los tiles son gratuitos para uso razonable.
- Para producción, considera usar un tile server propio o [Stadia Maps](https://stadiamaps.com/) para evitar rate limits de OSM.
