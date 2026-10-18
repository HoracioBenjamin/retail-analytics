"""Errores de negocio de la API demo (sección 9.4: códigos estables)."""


class NotFoundVariantError(LookupError):
    """La variante pedida no existe → HTTP 404 { code: 'NOT_FOUND' }."""

    def __init__(self, variant_id: str) -> None:
        super().__init__(f"Variante desconocida: {variant_id}")
        self.variant_id = variant_id


class BusinessValidationError(ValueError):
    """Filtro no soportado por el fixture → HTTP 422 { code: 'VALIDATION_ERROR' }."""
