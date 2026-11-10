# Diagnóstico de recomendaciones — 2026-11-09

Investigación de solo lectura del cálculo y de la API local activa
(`127.0.0.1:8000`). No se cambiaron reglas, parámetros, inventario ni Supabase.
Los números describen la respuesta consultada y pueden cambiar al actualizar datos.

## Resultado observado

- Modo activo confirmado por `/health`: `connected`.
- `/api/v1/recommendations`: 31 variantes en total, 9 `defer_purchase`,
  22 `review_data`, 0 `replenish`, 0 `maintain`.
- Las 22 revisiones tienen exactamente el mismo motivo: falta configurar
  `SUPPLIER_LEAD_TIME_WEEKS` con el plazo real del proveedor.
- No es una pérdida de filas por paginación: las 31 recomendaciones caben
  en la primera respuesta y el frontend solicita hasta 200.

## Por qué no aparece «Reponer»

En `services/analytics-api/app/services/analytics_service_connected.py`,
`_recommendation_for` calcula cobertura = stock / demanda semanal estimada.
Luego aplica las reglas en este orden:

1. Menos de 28 días de historia, menos de dos días con ventas o demanda no
   positiva: revisar datos, sin cantidad calculable.
2. Cobertura mayor de 8 semanas: posponer compras, cantidad 0.
3. Falta plazo de proveedor: revisar datos, sin cantidad calculable.
4. Con plazo configurado, cobertura menor que plazo + una semana de seguridad:
   reponer. Cantidad = máximo entre 0 y el redondeo hacia arriba de
   demanda semanal × (plazo + una semana de revisión + una de seguridad) − stock.
5. Resto: mantener, cantidad 0.

Las respuestas activas confirman que las 22 revisiones llegan al paso 3.
No se debe asignar un plazo arbitrario solo para generar compras positivas.
Existe una prueba de la rama de reposición en
`services/analytics-api/tests/test_connected.py`,
`test_stockout_recommendation_requires_sufficient_history`.
En esta investigación no se ejecutó esa prueba ni se instalaron dependencias.

## Casos concretos de la respuesta activa

| Variante | Stock actual | Ventas de todo el histórico | Cobertura estimada | Resultado actual |
|---|---:|---:|---:|---|
| p57-45 · PUMA Five-0 gris, talla 45 | 2 | 216 | 0,50 semanas | Revisar: falta plazo del proveedor |
| p61-43 · Threshold Hiker negro, talla 43 | 6 | 170 | 1,96 semanas | Revisar: falta plazo del proveedor |
| p59-44 · Terrex Skychaser negro, talla 44 | 6 | 141 | 1,95 semanas | Revisar: falta plazo del proveedor |
| p58-4 · Intruder Essential beige, talla 4 | 38 | 137 | 13,78 semanas | Posponer compras |

Las ventas mostradas son acumuladas del histórico disponible
(2025-10-20 a 2026-11-10 según la API), no ventas semanales.
La cobertura usa la demanda estimada por el baseline Croston-SBA;
su precisión no está validada. Los datos de stock y ventas no demuestran
por sí solos que esa estimación sea correcta.

## Por qué el Resumen muestra cinco excesos

La API ordena por acción: reponer → posponer compras → revisar datos → mantener.
Dentro de cada acción ordena por identificador de variante.
`OverviewPage.tsx` excluye mantener y toma las primeras cinco recomendaciones.
Al no existir reposiciones y haber nueve excesos, las cinco son excesos.
No representa una selección equilibrada entre tipos de acción ni una ordenación
por cobertura o urgencia dentro de cada tipo.

## Problemas de presentación confirmados

- «Sugerido: 0 unidades» significa cero unidades adicionales a comprar,
  no cero ventas, ni falta de stock, ni ausencia de recomendación.
- «Exceso / baja rotación» mezcla dos conceptos: la regla determina exceso
  de cobertura, no una clasificación independiente de rotación. Una variante
  puede vender mucho y aun así tener stock para demasiadas semanas.
- «Datos insuficientes» también se utiliza cuando hay suficiente historia,
  pero falta el plazo del proveedor. La causa concreta queda en la explicación,
  que la tabla recorta a dos líneas.
- El Resumen obtiene recomendaciones globales con `useRecommendations({})`;
  sus filtros de modelo/color/talla/período no acotan esa lista prioritaria.
  Es un problema adicional de coherencia del ámbito, distinto del plazo faltante.

## Cambios de diseño propuestos durante el diagnóstico

Actualización posterior: se aplicaron los textos, stock/cobertura y un bloque
visible de casos pendientes en Resumen. Las reglas de cálculo y el ámbito de
los filtros se conservaron; la investigación anterior describe el estado previo.

- Mostrar «No comprar por ahora» para posponer, «Sin compra adicional» para
  mantener y «Reponer N unidades» para compras positivas.
- Mostrar el bloqueo específico «Falta plazo del proveedor», junto a stock,
  demanda estimada y cobertura, evitando ocultar variantes con poca cobertura.
- Separar necesidad de compra de nivel de demanda: «vende más» no implica
  automáticamente «comprar más» si el inventario ya alcanza.
- Distinguir en el Resumen las reposiciones, los excesos y los casos pendientes
  de evaluación; explicar cuando no se puede evaluar la reposición.
- Alinear el ámbito de los filtros y el criterio de prioridad con lo indicado
  en los encabezados.

Para habilitar compras calculadas falta conocer el plazo real de entrega del
proveedor y confirmar si un plazo único aplica a todo el catálogo. La configuración
actual admite un solo plazo global; plazos por proveedor requerirían otro alcance.
