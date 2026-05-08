# 🌸 Bloom

App de escritorio personal en Electron + React + SQLite. Productividad y finanzas en un mismo sitio, con un toque pastel.

## Funcionalidades

- **Inicio**: grid de tableros con su color, estadísticas (tareas / completadas / vencidas) y atajos a Kanban y Gantt.
- **Kanban**: múltiples tableros, columnas reordenables, tarjetas con descripción, fechas, etiquetas, progreso y dependencias (drag and drop con `@dnd-kit`).
- **Gantt**: vista de tareas en línea de tiempo con zoom día/semana/mes, drag para mover, resize de duración, flechas de dependencias, barra de progreso, agrupación por columna y línea de "hoy".
- **Finanzas**: cuentas/wallets en distintas monedas, ingresos/gastos por categoría, resumen mensual con gráficos (`recharts`) y tasas de conversión manuales. Selectores de moneda dinámicos basados en lo que ya usas.
- **10 temas pastel por tablero**: Rosa, Lavanda, Cielo, Menta, Limón, Durazno, Coral, Turquesa, Lila, Nube. Toda la UI cambia (gradiente de fondo + acentos) cuando abres un tablero.
- **Exportar / Importar**:
  - Backup `.db` y export Excel `.xlsx`.
  - Restaurar `.db` (con respaldo automático del actual) y reimportar Excel reemplazando datos.

## Requisitos

- Node 20+
- En Windows, las "Build Tools for Visual Studio" (para compilar `better-sqlite3` la primera vez).

## Comandos

```bash
npm install
npm run dev          # arranca en modo desarrollo
npm run build:win    # genera instalador .exe en dist/ (requiere Windows o cross-build)
npm run icon         # regenera build/icon.ico y build/icon.png desde build/icon.svg
npm run typecheck    # tsc para main + renderer
```

## Estructura

```
src/
  main/         proceso principal Electron + SQLite + IPC + export/import
    db/         schema, migraciones y repositorios
  preload/      contextBridge tipado (window.api.*)
  renderer/    React app (Vite)
    src/
      pages/        HomePage, KanbanPage, GanttPage, FinancesPage
      components/   Kanban, Gantt, finanzas, modales, BoardPromptModal
      hooks/        useAsync, useCurrencies
      lib/          themes, themeStore, navStore, currency
      styles/       globals.css (tailwind + variables CSS del tema)
  shared/      tipos y contrato de API (compartido main/renderer)
build/          icon.svg fuente + icon.ico/.png generados
scripts/        generate-icon.mjs (renderiza el SVG a múltiples tamaños)
.github/workflows/ release-windows.yml (CI para construir el .exe)
```

## Base de datos

Vive en `app.getPath('userData')/dashboard.db`. Las migraciones se aplican al abrir (vía `ensureColumn`), así que actualizar la app no pierde datos. Puedes mover la BBDD entre máquinas con **Datos → Respaldar (.db)** y **Datos → Restaurar (.db)** — al restaurar se hace un respaldo automático del archivo anterior antes de reemplazar.

## Monedas

Las transacciones se guardan en su moneda original. En **Finanzas → Tasas** defines manualmente las equivalencias (ej. `USD → MXN = 17.0`). El resumen y los gráficos convierten todo a la moneda base que elijas en **Resumen**. Los selectores de moneda muestran solo las que ya usas (sacadas de cuentas + tasas), evitando errores de tipeo.

## Build para Windows desde otra plataforma

Hay un workflow de GitHub Actions ([`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml)) que compila `better-sqlite3` nativo y empaca el `.exe` en una runner Windows real:

- **Manual**: Actions → "Build Windows installer" → Run workflow → descarga el artifact.
- **Por tag**: `git tag v1.0.0 && git push origin v1.0.0` adjunta el `.exe` a un GitHub Release auto-generado.

## Icono

El logo es un SVG editable en [`build/icon.svg`](build/icon.svg). El script `npm run icon` lo rasteriza en múltiples tamaños (16, 24, 32, 48, 64, 128, 256) y genera `build/icon.ico` para Windows + `build/icon.png` 512×512 para macOS/Linux. `electron-builder` los toma automáticamente.

---

Desarrollado por [JFrancisco Robles](https://www.jfrankrobles.com/) con cariño para Palomita 🌸
