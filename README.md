# ScrapCRM 🗺

Mini CRM local para hacer pruebas con leads de Google Maps.

La aplicación no usa cuentas, login, sesiones, Supabase, GitHub Actions ni ningún servicio externo para guardar datos. Los datos se guardan en `~/.scrapcrm/scrapcrm.sqlite` y el scraper Python usa esa misma base SQLite.

## Puesta en marcha

Requiere Node.js 18.17 o superior y Python 3. La base SQLite se ejecuta mediante
el módulo estándar de Python, sin addons nativos de Node.

```bash
npm install
cd scraper
pip install -r requirements.txt
python -m playwright install chromium
cd ..
npm run dev
```

Si `next dev` vuelve al prompt sin mostrar un error, ejecuta `npm run dev:trace`.
Ese modo imprime si el proceso recibió `SIGTERM`, `SIGINT` o `SIGHUP`; son señales
externas, no un fallo del scraper.

Abre <http://localhost:3000>. La raíz entra directamente en el dashboard.

La configuración es opcional. Puedes copiar `.env.local.example` a `.env.local` para elegir el intérprete de Python o una ruta personalizada para SQLite:

```env
SCRAPER_PYTHON_BIN=python3
# LOCAL_DB_PATH=/ruta/absoluta/scrapcrm.sqlite
```

## Scraper local

El botón «Iniciar Scraping» crea el job en SQLite y ejecuta `scraper/scraper_api.py` como proceso local. El progreso, la cancelación y los negocios se actualizan en la misma base.

Para probarlo manualmente:

```bash
python scraper/scraper_api.py \
  --job-id prueba \
  --db-path "$HOME/.scrapcrm/scrapcrm.sqlite" \
  --query "dentistas" \
  --location "Madrid" \
  --mode simple \
  --max 10 \
  --headless
```

También puedes usar `npm run scraper -- ...`.

## Funcionalidades

- Dashboard con estadísticas y jobs recientes.
- Scraper por zona simple o cuadrícula regional.
- CRM de leads con filtros, estados, notas y exportación CSV.
- Gestión de clientes y timeline de contactos.
- Base de datos SQLite local, fácil de borrar o inspeccionar.

## Estructura relevante

```text
app/
├── api/local/             # API local para CRM, jobs y followups
├── api/scraper/           # Lanza/cancela el scraper Python
└── dashboard/             # Dashboard, scraper, CRM y clientes
lib/local-db.ts            # SQLite y operaciones de datos
scraper/                   # Scraper Python y mapeo de zonas
data/                      # Datos locales opcionales, ignorados por Git
```

Este modo está pensado para desarrollo y pruebas en local, no para publicar la aplicación tal cual en internet.
