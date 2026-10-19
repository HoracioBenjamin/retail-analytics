"""FastAPI app de la API demo (Entrega B).

- Monta `/health` y los endpoints `/api/v1/*` del plan (sección 9.4).
- errores con sobre uniforme `{ "error": { "code", "message" } }`:
  404 NOT_FOUND (variante desconocida), 422 VALIDATION_ERROR (filtros no
  soportados o mal formados).
- Sin CORS: el proceso principal de Electron consume la API con fetch,
  no un navegador (plan, sección 11). Si algún día existiera una vista
  web dev, se permitiría SOLO ese origen exacto, documentado.
- No existe endpoint de entrenamiento ni BackgroundTasks que lo simule.
"""

import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.status import HTTP_422_UNPROCESSABLE_CONTENT

from app.api.v1.router import api_v1_router, health_router
from app.core.config import validate_settings_or_fail
from app.services.exceptions import (
    BusinessValidationError,
    NotFoundVariantError,
    ProviderUnavailableError,
    SupabaseConnectionError,
    SupabasePermissionError,
)

logger = logging.getLogger("analytics-api")


def create_app() -> FastAPI:
    # Punto 5 del Paso 6: modos no implementados abortan de forma clara.
    settings = validate_settings_or_fail()

    app = FastAPI(
        title="Zapatillas Duoc Analytics — API demo",
        version="0.1.0",
        description=(
            "API demo de la base A+B. Sirve el dataset canónico "
            "fixtures/demo-v1.json con contratos idénticos al proveedor "
            "demo-local del escritorio. Sin credenciales ni modelo entrenado."
        ),
        docs_url="/docs",
        redoc_url=None,
    )

    app.include_router(health_router)
    app.include_router(api_v1_router, prefix="/api/v1")

    @app.exception_handler(NotFoundVariantError)
    async def not_found_variant(request: Request, exc: NotFoundVariantError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "error": {"code": "NOT_FOUND", "message": str(exc)}
            },
        )

    @app.exception_handler(BusinessValidationError)
    async def business_validation(request: Request, exc: BusinessValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": {"code": "VALIDATION_ERROR", "message": str(exc)}
            },
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI ya asigna 422 a query params mal formados; se reencuadra al
        # sobre uniforme con código estable para el escritorio.
        first = (exc.errors() or [{}])[0]
        message = f"Filtro inválido: {first.get('msg', 'parámetros inválidos')}."
        return JSONResponse(
            status_code=HTTP_422_UNPROCESSABLE_CONTENT,
            content={"error": {"code": "VALIDATION_ERROR", "message": message}},
        )

    @app.exception_handler(SupabasePermissionError)
    async def supabase_permissions(request: Request, exc: SupabasePermissionError) -> JSONResponse:
        # RLS bloqueó la lectura con la clave pública: NO se omiten políticas.
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "PERMISSION_DENIED", "message": str(exc)}},
        )

    @app.exception_handler(SupabaseConnectionError)
    async def supabase_connection(request: Request, exc: SupabaseConnectionError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "SERVICE_UNAVAILABLE", "message": str(exc)}},
        )

    @app.exception_handler(ProviderUnavailableError)
    async def provider_unavailable(request: Request, exc: ProviderUnavailableError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": "SERVICE_UNAVAILABLE", "message": str(exc)}},
        )

    # La instancia guarda settings PARA LA COMPOSICIÓN de /health.
    app.state.settings = settings
    return app


app = create_app()
