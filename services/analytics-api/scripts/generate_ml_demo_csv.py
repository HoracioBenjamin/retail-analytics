"""Generate synthetic, import-ready CSVs from the existing Supabase catalog.

This script performs read-only REST requests and writes CSV files locally. It
never inserts or updates Supabase rows. Run from this service's virtualenv.
"""

from __future__ import annotations

import csv
import math
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx

from app.core.config import get_settings

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "generated_ml_demo_data"
WEEKS = 52
TIMEZONE = timezone.utc

ORDER_FIELDS = (
    "id",
    "created_at",
    "perfil_id",
    "nombre_cliente",
    "email",
    "telefono",
    "total",
    "estado",
    "metodo_pago_id",
    "fecha_pago",
)
DETAIL_FIELDS = (
    "id",
    "pedido_id",
    "producto_id",
    "talla",
    "cantidad",
    "precio_unitario",
)


def stable_uuid(namespace: str, value: str) -> str:
    """Create a deterministic UUID-shaped value accepted by PostgreSQL."""
    return str(uuid5(NAMESPACE_URL, f"{namespace}:{value}"))


def read_catalog() -> tuple[list[dict], list[dict]]:
    settings = get_settings()
    settings.validate()
    headers = {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {settings.supabase_publishable_key}",
        "Accept": "application/json",
    }
    with httpx.Client(
        base_url=settings.supabase_rest_base,
        headers=headers,
        timeout=httpx.Timeout(20.0),
    ) as client:
        products_response = client.get(
            "/productos",
            params={"select": "id,precio,precio_oferta,en_oferta", "order": "id.asc"},
        )
        stock_response = client.get(
            "/stock",
            params={"select": "producto_id,talla", "order": "producto_id.asc,talla.asc"},
        )

    for table, response in (
        ("productos", products_response),
        ("stock", stock_response),
    ):
        if response.status_code != 200:
            raise RuntimeError(
                f"No se pudo leer {table} desde Supabase (HTTP {response.status_code}); "
                "revisa permisos SELECT para la clave pública. No se muestran detalles "
                "ni valores de configuración."
            )

    products = products_response.json()
    stocks = stock_response.json()
    if not products or not stocks:
        raise RuntimeError("Supabase no devolvió productos y stock legibles.")
    return products, stocks


def unit_price(product: dict) -> int:
    price = product.get("precio_oferta") if product.get("en_oferta") else None
    price = price or product.get("precio")
    if price is None or int(price) <= 0:
        raise ValueError(f"Producto {product.get('id')} no tiene precio válido.")
    return int(price)


def synthetic_units(variant_number: int, week_number: int, week_start: date) -> int:
    base_rate = (0.35, 0.70, 1.20, 2.00, 3.20)[variant_number % 5]
    if variant_number % 4 == 0 and week_number % 3 == 0:
        return 0
    if variant_number % 4 == 1 and week_number % 5 == 0:
        return 0

    trend = 0.65 + (0.70 * week_number / (WEEKS - 1))
    if week_start.month in (5, 6, 7):
        seasonality = 1.35
    elif week_start.month in (11, 12):
        seasonality = 1.25
    else:
        seasonality = 1.0
    return max(1, math.ceil(base_rate * trend * seasonality))


def generate_rows(products: list[dict], stocks: list[dict]) -> tuple[list[dict], list[dict]]:
    product_by_id = {int(product["id"]): product for product in products}
    variants = [
        stock
        for stock in stocks
        if int(stock["producto_id"]) in product_by_id and str(stock.get("talla", "")).strip()
    ]
    variants.sort(key=lambda row: (int(row["producto_id"]), str(row["talla"])))
    if not variants:
        raise RuntimeError("No hay variantes producto/talla compatibles para generar CSV.")

    today = date.today()
    latest_week = today - timedelta(days=today.weekday() + 7)
    first_week = latest_week - timedelta(weeks=WEEKS - 1)
    orders: list[dict] = []
    details: list[dict] = []

    for variant_number, stock in enumerate(variants, start=1):
        product_id = int(stock["producto_id"])
        size = str(stock["talla"]).strip()
        price = unit_price(product_by_id[product_id])
        for week_number in range(WEEKS):
            week_start = first_week + timedelta(weeks=week_number)
            quantity = synthetic_units(variant_number, week_number, week_start)
            if quantity == 0:
                continue

            key = f"{product_id}:{size}:{week_start.isoformat()}"
            order_id = stable_uuid("duoc-ml-demo-order", key)
            detail_id = stable_uuid("duoc-ml-demo-detail", key)
            sold_at = datetime.combine(week_start, time(12), tzinfo=TIMEZONE).isoformat()
            orders.append(
                {
                    "id": order_id,
                    "created_at": sold_at,
                    "perfil_id": "",
                    "nombre_cliente": "CLIENTE SINTETICO ML",
                    "email": f"ml-demo+{order_id.replace('-', '')}@example.invalid",
                    "telefono": "0000000000",
                    "total": quantity * price,
                    "estado": "exitoso",
                    "metodo_pago_id": "",
                    "fecha_pago": sold_at,
                }
            )
            details.append(
                {
                    "id": detail_id,
                    "pedido_id": order_id,
                    "producto_id": product_id,
                    "talla": size,
                    "cantidad": quantity,
                    "precio_unitario": price,
                }
            )
    return orders, details


def write_csv(path: Path, fieldnames: tuple[str, ...], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    products, stocks = read_catalog()
    orders, details = generate_rows(products, stocks)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    orders_path = OUTPUT_DIR / "pedidos_ml_demo.csv"
    details_path = OUTPUT_DIR / "detalles_pedido_ml_demo.csv"
    write_csv(orders_path, ORDER_FIELDS, orders)
    write_csv(details_path, DETAIL_FIELDS, details)
    print(f"Variantes usadas: {len({(row['producto_id'], row['talla']) for row in details})}")
    print(f"Pedidos sintéticos: {len(orders)}")
    print(f"Líneas sintéticas: {len(details)}")
    print(f"CSV pedidos: {orders_path}")
    print(f"CSV detalles: {details_path}")
    print("Importa primero pedidos_ml_demo.csv y después detalles_pedido_ml_demo.csv.")
    print("Solo son archivos CSV; no se insertó ni modificó información en Supabase.")


if __name__ == "__main__":
    main()
