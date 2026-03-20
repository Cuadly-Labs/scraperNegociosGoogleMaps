# ScrapCRM 🗺

Mini SaaS de scraping + CRM para leads de Google Maps.  
Stack: **Next.js 14 · Supabase · Playwright · Python**

---

## 🚀 Setup local (10 minutos)

### 1. Supabase

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/migrations/001_schema.sql`
3. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key (secret)

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SCRAPER_PYTHON_BIN=python3
```

### 3. Frontend (Next.js)

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 4. Scraper Python (entorno separado)

```bash
cd scraper
pip install -r requirements.txt
python -m playwright install chromium
```

Prueba que funciona:
```bash
python scraper_api.py \
  --job-id test --user-id test \
  --supabase-url $NEXT_PUBLIC_SUPABASE_URL \
  --supabase-key $SUPABASE_SERVICE_ROLE_KEY \
  --query "dentistas" --location "Madrid" \
  --mode simple --max 10
```

---

## 📁 Estructura

```
scrapcrm/
├── app/
│   ├── api/scraper/       # API routes (start, cancel)
│   ├── dashboard/         # Páginas protegidas
│   │   ├── page.tsx       # Panel principal con stats
│   │   ├── scraper/       # UI del scraper
│   │   ├── crm/           # Base de leads con filtros
│   │   └── clients/       # CRM clientes con timeline
│   ├── login/             # Auth
│   └── register/
├── components/
│   └── Sidebar.tsx
├── lib/
│   ├── supabase/          # Clientes server/client
│   └── types.ts           # Tipos TypeScript
├── scraper/
│   ├── scraper_api.py     # Scraper Python con reporte a Supabase
│   ├── zone_mapper.py     # Grid de coordenadas por zona
│   └── requirements.txt
└── supabase/
    └── migrations/001_schema.sql
```

---

## ✨ Funcionalidades

### Scraper
- Modo **zona simple** (texto libre) o **cuadrícula por región** (378 celdas en la Comunidad de Madrid)
- Progreso en tiempo real via polling a Supabase
- Extrae: nombre, categoría, dirección, ciudad, teléfono, web, email (visita la web), rating, reseñas, horario, precio
- Deduplicación automática

### CRM — Base de Leads
- **12 filtros**: estado, ciudad, tiene web/email/teléfono, rating mínimo, reseñas mínimas, precio, búsqueda de texto
- **6 estados**: Sin contactar · Contactado · Sin respuesta · Rechazado · Interesado · **Cliente**
- Cambio de estado inline en la tabla
- Panel lateral de detalle con toda la info, links directos (llamar, email, web, maps)
- Notas editables por lead
- Exportar a CSV con filtros aplicados
- Paginación de 50 en 50

### Clientes
- Vista dedicada a leads marcados como "Cliente"
- Timeline de contactos: llamada, email, reunión, WhatsApp, nota
- Resultado de cada contacto
- Fecha del último contacto

---

## 🌐 Despliegue en Vercel

```bash
# 1. Instala Vercel CLI
npm i -g vercel

# 2. Despliega
vercel

# 3. Añade variables de entorno en Vercel Dashboard:
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SUPABASE_SERVICE_ROLE_KEY
```

> ⚠️ **Importante**: El scraper Python necesita ejecutarse en una máquina con Chromium instalado.
> En Vercel solo se despliega el frontend/API. El scraper lo puedes lanzar desde tu Mac o un VPS.
> Para uso en producción, considera usar un servidor propio (Railway, Render, DigitalOcean) que ejecute
> el Python. El frontend siempre puede estar en Vercel.

### Opción recomendada para producción:
- **Frontend**: Vercel (gratis)
- **BD + Auth**: Supabase (gratis hasta 500MB)
- **Scraper**: Tu Mac o un VPS de Railway/Render (desde $5/mes)

---

## 🔑 Plan gratuito incluido

- 500 scrapes por usuario (configurable en el schema)
- Supabase free tier: 500MB BD, 50.000 usuarios auth
- Vercel free tier: ilimitado para Next.js estático/SSR

---

## 📦 Añadir más usuarios

El registro está abierto por defecto. Para cerrar el registro y añadir usuarios manualmente:
1. Desactiva la página `/register`
2. Usa Supabase Dashboard → Authentication → Users → "Invite user"




unzip scrapcrm.zip
cd scrapcrm

git init
git add .
git commit -m "feat: initial ScrapCRM"
git branch -M main
git remote add origin https://github.com/jgarciarourjc/googleScraper.git
git push -u origin main