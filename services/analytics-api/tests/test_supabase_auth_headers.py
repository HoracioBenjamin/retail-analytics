"""Regresiones offline de autenticación y permisos REST de Supabase."""

import httpx
import pytest

from app.core.config import Settings
from app.repositories.supabase_rest import SupabaseRestRepository
from app.services.exceptions import SupabaseConnectionError, SupabasePermissionError


@pytest.mark.parametrize("key,bearer", [
    ("sb_publishable_clave_ficticia", False),
    ("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-ficticia", True),
])
def test_public_key_headers_and_pagination(key: str, bearer: bool) -> None:
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["apikey"] == key
        assert ("authorization" in request.headers) is bearer
        if bearer:
            assert request.headers["authorization"] == f"Bearer {key}"
        seen.append(request.headers["range"])
        index = len(seen) - 1
        return httpx.Response(206, json=[{"producto_id": index}], headers={
            "Content-Range": f"{index}-{index}/2",
        })

    repo = SupabaseRestRepository(Settings(
        supabase_url="https://ejemplo.supabase.co", supabase_publishable_key=key,
    ), transport=httpx.MockTransport(handler))
    assert len(repo.lineas_venta()) == 2
    assert seen == ["0-999", "1-1000"]


@pytest.mark.parametrize("method", ["lineas_venta", "conteos_diagnostico"])
@pytest.mark.parametrize("status,body,exception", [
    (401, {"code": "PGRST301", "message": "Invalid JWT"}, SupabaseConnectionError),
    (401, {"message": "Invalid API key"}, SupabaseConnectionError),
    (401, {"code": "42501"}, SupabasePermissionError),
    (403, {"code": "42501"}, SupabasePermissionError),
])
def test_credentials_and_permissions_are_distinct(method, status, body, exception) -> None:
    # La respuesta podría contener detalles sensibles; no reproducirlos en la UI.
    body = {**body, "details": "no-publicar-respuesta-proveedor"}
    repo = SupabaseRestRepository(Settings(
        supabase_url="https://ejemplo.supabase.co",
        supabase_publishable_key="sb_publishable_clave_ficticia",
    ), transport=httpx.MockTransport(lambda _: httpx.Response(status, json=body)))
    with pytest.raises(exception) as error:
        getattr(repo, method)()
    assert "no-publicar-respuesta-proveedor" not in str(error.value)
    assert "sb_publishable_clave_ficticia" not in str(error.value)
    if exception is SupabaseConnectionError:
        assert "no confirma un bloqueo" in str(error.value)
