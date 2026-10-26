"""Fixtures de pytest: cliente de prueba contra el fixture canónico real.

Estrategia: los tests usan la MISMA ruta del fixture que usa la app en
producción (resuelta desde app/core/config.py, base services/analytics-api).
Así los números afirmados corresponden al dataset canónico compartido con
el escritorio (Paso 7 conmutará proveedores sobre esta base).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def api() -> TestClient:
    return TestClient(create_app())
