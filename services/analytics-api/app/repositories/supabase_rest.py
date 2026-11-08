"""Lectura de solo lectura contra la API REST de Supabase (PostgREST).

Etapa C: la app JAMÁS escribe en la base. Por defecto usa la clave pública
(anon/publishable), que respeta RLS. En desarrollo local se puede configurar
una Secret Key para omitir RLS; nunca debe salir de este backend.

Diseño:
- PostgREST no expone GROUP BY con agregados Multiples: las filas mínimas
  (producto/talla/fecha/cantidad/monto) se leen paginadas y los KPIs se
  agregan en Python (ver docs/CONSULTAS_SUPABASE.md).
- Nunca se consultan columnas con datos personales.
- Errores tipados: conexión/autenticación, permisos y esquema.
- El contenido de los KEY/URL nunca se registra ni devuelve en mensajes.
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Any

import httpx

from app.core.config import Settings
from app.services.exceptions import SupabaseConnectionError, SupabasePermissionError

PAGE = 1000  # tamaño de página PostgREST (rango 0-999)


class SupabaseRestRepository:
    """Fachada de solo lectura de Supabase mediante la API REST."""

    def __init__(
        self,
        settings: Settings,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._settings = settings
        self._transport = transport  # inyectable para pruebas (httpx.MockTransport)
        self._base = settings.supabase_rest_base

    # ── HTTP interno ────────────────────────────────────────────────────────

    def _client(self) -> httpx.Client:
        key = self._settings.supabase_api_key.strip()
        headers = {
            "apikey": key,
            "Accept": "application/json",
            # conteo exacto en el Content-Range (diagnóstico sin exponer filas)
            "Prefer": "count=exact",
        }
        # sb_publishable_* no es un JWT: usarlo como Bearer produce Invalid JWT.
        # Conservar compatibilidad con las claves anon JWT antiguas.
        if key.startswith("eyJ") and key.count(".") == 2:
            headers["Authorization"] = f"Bearer {key}"
        return httpx.Client(
            base_url=self._base,
            headers=headers,
            timeout=httpx.Timeout(30.0),
            transport=self._transport,
        )

    @staticmethod
    def _check_access(response: httpx.Response, path: str) -> None:
        if response.status_code not in (401, 403):
            return
        try:
            body = response.json()
        except ValueError:
            body = None
        code = body.get("code") if isinstance(body, dict) else None
        # PostgREST también devuelve 401 a anon cuando PostgreSQL deniega SELECT.
        # Distinguir ese caso de una clave inválida sin exponer el cuerpo recibido.
        if response.status_code == 401 and code != "42501":
            raise SupabaseConnectionError(
                "Supabase rechazó la autenticación de la API (HTTP 401). "
                "Revise SUPABASE_URL y la clave SUPABASE_* configurada en el .env "
                "del backend. Las claves sb_publishable_ y sb_secret_ deben enviarse "
                "en apikey, no como Bearer. "
                "Este error no confirma un bloqueo de RLS."
            )
        raise SupabasePermissionError(
            f"Supabase denegó la lectura de '{path}' (HTTP {response.status_code}). "
            "Revise los permisos SELECT y las políticas aplicables al rol anon "
            "(docs/CONSULTAS_SUPABASE.md §3). Esta consulta no usa una sesión "
            "de Authentication: asignar admin a esas cuentas no cambia este acceso."
        )

    def _fetch_all(self, path: str, params: dict[str, Any], max_rows: int) -> list[dict]:
        """Pagina una consulta SELECT con encabezados Range hasta agotar
        el total informado por PostgREST (o alcanzar max_rows → error)."""
        rows: list[dict] = []
        params = {"select": "*", **params}
        start = 0
        total: int | None = None
        with self._client() as client:
            while True:
                try:
                    response = client.get(
                        path,
                        params=params,
                        headers={"Range": f"{start}-{start + PAGE - 1}"},
                    )
                except (httpx.ConnectError, httpx.TimeoutException) as exc:
                    raise SupabaseConnectionError(
                        "No se pudo conectar con Supabase REST (verify red/URL en "
                        ".env: SUPABASE_URL)."
                    ) from exc
                self._check_access(response, path)
                if response.status_code == 404:
                    raise SupabaseConnectionError(
                        f"El recurso '{path}' no existe en el esquema accesible "
                        "(HTTP 404). Revise el nombre de tabla/expresión REST."
                    )
                if response.status_code >= 500:
                    raise SupabaseConnectionError(
                        f"Supabase respondió HTTP {response.status_code} al leer '{path}'."
                    )
                if response.status_code not in (200, 206):  # 206 = rango paginado
                    # PostgREST explica el problema en el cuerpo (p.ej. sintaxis
                    # de embed/order). Solo se muestra ese mensaje técnico.
                    detail = ""
                    try:
                        body = response.json()
                        detail = (str(body.get("message", ""))[:300]
                            if isinstance(body, dict) else "")
                    except Exception:  # noqa: BLE001 — puede no ser JSON
                        detail = ""
                    raise SupabaseConnectionError(
                        f"HTTP {response.status_code} inesperado al leer '{path}'."
                        + (f" Detalle Supabase: {detail}" if detail else "")
                    )
                batch = response.json()
                rows.extend(batch)
                content_range = response.headers.get("Content-Range")
                if content_range and "/" in content_range:
                    count_part = content_range.rsplit("/", 1)[-1]
                    if count_part.isdigit():
                        total = int(count_part)
                if not batch:
                    break
                start += len(batch)
                if total is not None and start >= total:
                    break
                if max_rows and len(rows) >= max_rows:
                    raise SupabaseConnectionError(
                        f"La lectura de '{path}' superó {max_rows} filas (cota de "
                        "paginación). Revise el volumen de datos en "
                        "docs/CONSULTAS_SUPABASE.md §4."
                    )
        return rows

    def _fetch_one(self, path: str, params: dict[str, Any]) -> dict | None:
        rows = self._fetch_all(path, params, max_rows=1)
        return rows[0] if rows else None

    # ── Consultas de negocio (espejo de docs/CONSULTAS_SUPABASE.md §2) ────

    def productos(self) -> list[dict]:
        """Catálogo con marcas/colores/categorías embebidos por FK (2.1)."""
        return self._fetch_all(
            "/productos",
            {
                "select": "id,nombre,marcas(nombre),colores(nombre),categorias(nombre)",
                "order": "id.asc",
            },
            max_rows=10_000,
        )

    def stock(self) -> list[dict]:
        """Nivel de inventario producto × talla (2.2)."""
        return self._fetch_all(
            "/stock",
            {
                "select": "producto_id,talla,cantidad",
                "order": "producto_id.asc,talla.asc",
            },
            max_rows=20_000,
        )

    def lineas_venta(self) -> list[dict]:
        """Líneas de pedidos CONFIRMADOS (estado 'exitoso') con fecha (2.3).
        Sin datos personales: solo producto/talla/cantidad/monto/fecha.
        Sin ORDER por embebidos (sintaxis frágil en PostgREST): el orden lo
        aplica Python al agregar."""
        return self._fetch_all(
            "/detalles_pedido",
            {
                "select": (
                    "producto_id,talla,cantidad,precio_unitario,"
                    "pedidos!inner(created_at,fecha_pago,estado)"
                ),
                "pedidos.estado": "eq.exitoso",
            },
            max_rows=50_000,
        )

    def rango_ventas(self) -> tuple[str | None, str | None]:
        """(mín, máx) de pedidos.created_at con ventas confirmadas (2.4)."""
        first = self._fetch_one(
            "/pedidos",
            {
                "select": "created_at",
                "estado": "eq.exitoso",
                "order": "created_at.asc",
                "limit": "1",
            },
        )
        last = self._fetch_one(
            "/pedidos",
            {
                "select": "created_at",
                "estado": "eq.exitoso",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        return (first or {}).get("created_at"), (last or {}).get("created_at")

    def conteos_diagnostico(self) -> dict[str, int]:
        """Conteos mínimos para diagnosticar acceso y volumen (2.5)."""
        counts: dict[str, int] = {}
        for name, path, extra in (
            ("productos", "/productos", {}),
            ("stock", "/stock", {}),
            ("pedidos_exitosos", "/pedidos", {"estado": "eq.exitoso"}),
            ("pedidos_todos", "/pedidos", {}),
            ("lineas_venta_todas", "/detalles_pedido", {}),
            (
                "lineas_venta_exitosas",
                "/detalles_pedido",
                {"select": "pedidos!inner(estado)", "pedidos.estado": "eq.exitoso"},
            ),
        ):
            with self._client() as client:
                try:
                    response = client.get(path, params={**extra, "limit": "0"})
                except (httpx.ConnectError, httpx.TimeoutException) as exc:
                    raise SupabaseConnectionError(
                        "No se pudo conectar con Supabase REST (verificar red/URL)."
                    ) from exc
                self._check_access(response, path)
                if response.status_code not in (200, 206):  # 206 = rango con conteo
                    raise SupabaseConnectionError(
                        f"HTTP {response.status_code} al contar '{path}'."
                    )
                content_range = response.headers.get("Content-Range", "*/0")
                count_part = content_range.rsplit("/", 1)[-1]
                counts[name] = int(count_part) if count_part.isdigit() else 0
        return counts


# ── Cache simple por proceso (dataset «caliente» 20 s) ─────────────────


class ConnectedSnapshot:
    """Colección de lecturas de Supabase con expiración corta."""

    def __init__(self, repo: SupabaseRestRepository, ttl_seconds: int = 20) -> None:
        self.repo = repo
        self.ttl = ttl_seconds
        self.productos: list[dict] = []
        self.stock: list[dict] = []
        self.lineas: list[dict] = []
        self.conteos: dict[str, int] = {}
        self._loaded_at: float = 0.0
        self._refresh_lock = Lock()

    def ensure_fresh(self) -> None:
        with self._refresh_lock:
            now = time.monotonic()
            if self._loaded_at and now - self._loaded_at < self.ttl:
                return
            self.productos = self.repo.productos()
            self.stock = self.repo.stock()
            self.lineas = self.repo.lineas_venta()
            self.conteos = self.repo.conteos_diagnostico()
            self._loaded_at = time.monotonic()


_snapshot: ConnectedSnapshot | None = None


def get_connected_repo() -> ConnectedSnapshot:
    """Snapshot compartido del dataset conectado ( frescura ≤ 60 s )."""
    global _snapshot
    from app.core.config import get_settings

    settings = get_settings()
    settings.validate()
    if _snapshot is None:
        _snapshot = ConnectedSnapshot(SupabaseRestRepository(settings))
    return _snapshot


def reset_connected_cache() -> None:
    """Para pruebas: descarta el snapshot en caché."""
    global _snapshot
    _snapshot = None
