"""Errores de negocio/infraestructura de la API demo-conectada.

Mapeo a HTTP (sección 9.4 del plan + etapa C):
- NotFoundVariantError        → 404 { code: 'NOT_FOUND' }
- BusinessValidationError      → 422 { code: 'VALIDATION_ERROR' }
- SupabaseConnectionError      → 503 { code: 'SERVICE_UNAVAILABLE' }
- SupabasePermissionError     → 403 { code: 'PERMISSION_DENIED' } (HTTP 401/403 upstream)
- ProviderUnavailableError     → 503 { code: 'SERVICE_UNAVAILABLE' }
"""

class NotFoundVariantError(LookupError):
    """La variante pedida no existe → HTTP 404 { code: 'NOT_FOUND' }."""

    def __init__(self, variant_id: str) -> None:
        super().__init__(f"Variante desconocida: {variant_id}")
        self.variant_id = variant_id


class BusinessValidationError(ValueError):
    """Filtro no soportado → HTTP 422 { code: 'VALIDATION_ERROR' }."""


class SupabaseConnectionError(RuntimeError):
    """Fallo de red/servicio al leer Supabase → 503 SERVICE_UNAVAILABLE."""


class SupabasePermissionError(RuntimeError):
    """Supabase denegó permisos de lectura → 403 PERMISSION_DENIED.

    Con una clave pública se deben revisar los permisos SELECT y las políticas
    RLS del rol aplicable. La autenticación inválida se clasifica como error de
    conexión y no como bloqueo de RLS.
    """


class ProviderUnavailableError(RuntimeError):
    """El modo de datos solicitado no está disponible → 503."""
