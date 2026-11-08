# react-ts

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

## Métricas y reportes

En el módulo **Métricas y reportes** puedes filtrar por período, modelo,
color y talla; consultar indicadores de ventas e inventario; y descargar un
reporte general en PDF. El PDF se guarda en la ubicación elegida mediante el
diálogo nativo de Windows. La tendencia de “Todo el histórico” muestra las
últimas 12 semanas, mientras que los indicadores respetan el período filtrado.

Los valores se consultan a través de la API analítica configurada. En modo
demostración se identifican como datos de demostración; en modo conectado
corresponden a la fuente conectada. Incluye una estimación separada de demanda
sin cobertura a 4 semanas y ventas brutas potenciales expuestas, valorizada
con el precio promedio del período seleccionado. No representa ventas perdidas
confirmadas: no descuenta reabastecimientos futuros. La utilidad perdida no se
calcula porque el origen no contiene costo unitario ni margen por variante.

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
