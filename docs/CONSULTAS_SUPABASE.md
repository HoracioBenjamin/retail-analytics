# Consultas Supabase — Etapa C (solo lectura)

**Alcance:** cada consulta SELECT que lee `services/analytics-api` en modo
`connected` para alimentar las pantallas. **No hay INSERT/UPDATE/DELETE,
ni creación de tablas, vistas, funciones o políticas.** El acceso usa la
**clave pública (anon/publishable)** vía la API REST (PostgREST) de
Supabase, y por lo tanto **respeta las políticas RLS existentes** tal cual
están definidas — no se desactivan ni se usan credenciales privilegiadas.

> Regla de lectura: las columnas listadas son las mínimas necesarias.
> Nunca se consultan datos personales (nombre, email, teléfono, RUT,
> direcciones) para las pantallas analíticas.

---

## 1. Reglas de negocio adoptadas (C0)

| Regla | Definición | Evidencia |
|---|---|---|
| **Venta confirmada** | Fila de `detalles_pedido` cuyo `pedidos.estado = 'exitoso'` | Código de la tienda: webhook MercadoPago marca `exitoso` (aprobado), `pendiente`, `erroneo` |
| **Inventario en bodega** | `stock.cantidad`, nivel `producto × talla` (UNIQUE `(producto_id, talla)`) | Esquema confirmado |
| **Moneda** | Montos en CLP (enteros): `SUM(cantidad × precio_unitario)` | `precio_unitario bigint` en `detalles_pedido` |
| **Período de venta** | Fecha del pedido: `pedidos.created_at` (única fecha real disponible) | No existe fecha separada de pago/despacho |
| **Unidades en camino** | **No existen en el esquema** → 0; documentado como dato faltante para reglas de reposición cuando llegue el modelo | No hay tabla de compras/órdenes de proveedor |

**Relaciones confirmadas por el esquema (ninguna inventada):**

- `detalles_pedido.producto_id → productos.id` (FK) · `detalles_pedido.pedido_id → pedidos.id` (FK) · `talla` es texto libre que se casa con `stock.talla`.
- `productos.marca_id → marcas.id` · `productos.color_id → colores.id` · `productos.categoria_id → categorias.id`.
- `stock.producto_id → productos.id` *(FK no declarada en el CSV pero UNIQUE (producto_id, talla); confirmar en C2 con lectura real)*.

---

## 2. Consultas usadas por la aplicación

### 2.1 Catálogo/filtros — `GET /api/v1/filters`

Modelos, colores y tallas disponibles (los filtros de todas las pantallas).

```sql
SELECT p.id,
       p.nombre AS modelo,
       m.nombre AS marca,
       c.nombre AS color,
       cat.nombre AS categoria
FROM productos p
LEFT JOIN marcas m    ON m.id = p.marca_id
LEFT JOIN colores c   ON c.id = p.color_id
LEFT JOIN categorias cat ON cat.id = p.categoria_id
ORDER BY p.nombre;
```

- **Columnas:** identificadores y nombres de catálogo. Sin datos personales.
- **Equivalente REST:** `GET /rest/v1/productos?select=id,nombre,marcas(nombre),colores(nombre),categorias(nombre)` (embedding por FK).

### 2.2 Inventario — stock por variante (pantalla Variantes)

```sql
SELECT s.producto_id,
       p.nombre AS modelo,
       c.nombre AS color,
       s.talla,
       s.cantidad
FROM stock s
JOIN productos p ON p.id = s.producto_id
JOIN colores c   ON c.id = p.color_id
ORDER BY p.nombre, c.nombre, s.talla;
```

- **Columnas:** nivel de inventario real por `producto × talla`.
- **Equivalente REST:** `GET /rest/v1/stock?select=producto_id,talla,cantidad,productos!inner(nombre,colores(nombre))`.

### 2.3 Ventas confirmadas — histórico (Resumen, Variantes, Pronósticos)

```sql
SELECT p.created_at        AS fecha_pedido,
       d.producto_id,
       d.talla,
       d.cantidad,
       d.precio_unitario
FROM detalles_pedido d
JOIN pedidos p ON p.id = d.pedido_id
WHERE p.estado = 'exitoso'
ORDER BY p.created_at;
```

- **Filtros:** `estado = 'exitoso'` (regla de venta confirmada).
- **Columnas:** fecha, variante, unidades y monto. **Excluye** todo dato personal del pedido.
- **Equivalente REST:** `GET /rest/v1/detalles_pedido?select=producto_id,talla,cantidad,precio_unitario,pedidos!inner(created_at,estado)&pedidos.estado=eq.exitoso` con paginación por rangos.

### 2.4 Rango temporal del dataset (Estado de datos / Resumen)

```sql
SELECT MIN(p.created_at) AS primera_venta,
       MAX(p.created_at) AS ultima_venta
FROM pedidos p
WHERE p.estado = 'exitoso';
```

- **Equivalente REST** (PostgREST no aplica MIN/MAX directamente): dos lecturas
  ordenadas limitadas a 1 fila —
  `GET /rest/v1/pedidos?select=created_at&estado=eq.exitoso&order=created_at.asc&limit=1`
  y la misma con `order=created_at.desc&limit=1`.

### 2.5 Conteos mínimos (diagnóstico de conexión, pantalla Estado de datos)

Números de registros para verificar acceso y volumen — **sin exponer contenido**:

```sql
SELECT (SELECT COUNT(*) FROM productos)                              AS productos,
       (SELECT COUNT(*) FROM stock)                                  AS stock,
       (SELECT COUNT(*) FROM pedidos WHERE estado = 'exitoso')       AS pedidos_exitosos,
       (SELECT COUNT(*) FROM detalles_pedido d
          JOIN pedidos p ON p.id = d.pedido_id AND p.estado='exitoso') AS lineas_venta;
```

- **Equivalente REST:** `GET /rest/v1/productos?select=count` con encabezado
  `Prefer: count=exact` (se lee del `Content-Range`), idem para las demás tablas.

---

## 3. ⚠️ Distinción importante: SQL Editor ≠ permisos reales de la app

El **SQL Editor de Supabase ejecuta con el rol `postgres` (dueño)**, que pasa por
encima de RLS. Si una consulta funciona ahí, **NO demuestra** que la aplicación
pueda ejecutarla: la app usa la **clave anon** y PostgREST solo devuelve lo que
las políticas RLS permiten a ese rol.

Para validar los permisos reales, en el SQL Editor corre primero:

```sql
SET LOCAL ROLE anon;
-- y después la consulta 2.1 / 2.2 / 2.3 a probar
```

Si la consulta con `anon` devuelve error `permission denied` o filas vacías por
RLS, la pantalla lo mostrará como **error de permisos** (no como conexión errónea,
ni como "no hay datos"), y lo documentaremos; **no se modificarán políticas**.
(Alternativa equivalente: probar la API REST con la clave pública usando
`curl https://...supabase.co/rest/v1/productos?select=count -H "apikey: <clave>"`.)

---

## 4. Supuestos y datos faltantes (declarados, no inventados)

1. **Talla como texto libre:** `detalles_pedido.talla` y `stock.talla` no tienen
   tabla de dimensiones → la igualdad se hace por string exacto. Si la tienda
   alguna vez escribe `"40"` vs `" EU 40"`, esas líneas no cruzan (se hace visible:
   verificación de conteos por talla en C2).
2. **Montos:** `precio_unitario × cantidad` por línea; si los montos por pedido
   (`pedidos.total`) no coinciden con la suma de líneas (descuentos/envío),
   los KPIs de "ventas" usan la suma de líneas y se documenta la diferencia.
3. **No hay unidades en tránsito, ni costos, ni lead times reales en la DB:**
   las reglas de reposición del futuro modelo necesitarán decidir de dónde salen —
   hilo abierto documentado, sin datos inventados.
4. **Fechas de la base:** la temporalidad disponible es `pedidos.created_at`; si
   historia real, los KPIs reflejarán ese rango y la pantalla de Estado de datos
   lo mostrará tal cual (sin rellenar períodos).
5. **Volumen:** lecturas paginadas; con listas de > 5 000 líneas de venta la
   API trae por bloques. Cota práctica por tamaño de tienda de práctica.

---

## 5. Dónde se configuran las credenciales (solo nombres)

Archivo local **`services/analytics-api/.env`** (excluido de Git):

| Variable | Contenido esperado |
|---|---|
| `APP_MODE` | `connected` para usar Supabase (o `demo` para fixture) |
| `SUPABASE_URL` | Project URL (Settings → API) |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública **anon** (API keys) — **nunca** `service_role` |

El escritorio (`apps/desktop/.env`) solo define `MAIN_VITE_DATA_MODE`
(`demo-local` | `demo-api` | `connected`) y `MAIN_VITE_ANALYTICS_API_URL`.
Ninguna clave vive en Electron.
