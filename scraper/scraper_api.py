#!/usr/bin/env python3
"""
scraper_api.py — Scraper local integrado con SQLite.
Reporta progreso en tiempo real y guarda negocios directamente en la base local.

Uso (lanzado por Next.js API route):
  python scraper_api.py \
    --job-id <uuid> --db-path ../data/scrapcrm.sqlite \
    --query "dentistas" --mode grid --grid-zone "comunidad de madrid" \
    --max 50 --max-total 1000 --headless
"""

import re
import sys
import json
import sqlite3
import time
import logging
import argparse
import unicodedata
import uuid
from pathlib import Path
from datetime import datetime, timezone

# ── Add scraper dir to path so we can import zone_mapper ─────────────────────
sys.path.insert(0, str(Path(__file__).parent))

try:
    from playwright.sync_api import sync_playwright, Page, Browser
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && python -m playwright install chromium", file=sys.stderr)
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ─── SQLite reporter ──────────────────────────────────────────────────────────

def ensure_database(db_path: str):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path, timeout=30) as db:
        db.execute('PRAGMA busy_timeout=30000')
        db.execute('PRAGMA foreign_keys=ON')
        db.executescript('''
            CREATE TABLE IF NOT EXISTS scrape_jobs (
              id TEXT PRIMARY KEY, query TEXT NOT NULL, zone TEXT,
              mode TEXT NOT NULL DEFAULT 'simple', cell_km REAL DEFAULT 8,
              max_results INTEGER DEFAULT 50, max_total INTEGER DEFAULT 1000,
              status TEXT NOT NULL DEFAULT 'pending', progress INTEGER DEFAULT 0,
              total INTEGER DEFAULT 0, phase TEXT DEFAULT '', businesses_found INTEGER DEFAULT 0,
              error_msg TEXT, started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS businesses (
              id TEXT PRIMARY KEY, job_id TEXT REFERENCES scrape_jobs(id) ON DELETE SET NULL,
              name TEXT NOT NULL, category TEXT, address TEXT, city TEXT, province TEXT,
              postal_code TEXT, phone TEXT, website TEXT, email TEXT, rating REAL,
              reviews_count INTEGER, hours TEXT, price_range TEXT, description TEXT,
              google_maps_url TEXT, plus_code TEXT, status TEXT NOT NULL DEFAULT 'not_contacted',
              notes TEXT, tags TEXT NOT NULL DEFAULT '[]', assigned_to TEXT,
              last_contact TEXT, next_followup TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              UNIQUE(name, address)
            );
            CREATE TABLE IF NOT EXISTS followups (
              id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
              type TEXT NOT NULL, content TEXT, outcome TEXT, scheduled_at TEXT,
              completed_at TEXT, created_at TEXT NOT NULL
            );
        ''')

class JobReporter:
    def __init__(self, db_path: str, job_id: str):
        self.db_path = db_path
        self.job_id = job_id
        self._businesses_found = 0

    def _execute(self, sql: str, params=(), fetch=False):
        with sqlite3.connect(self.db_path, timeout=30) as db:
            db.execute('PRAGMA busy_timeout=30000')
            cursor = db.execute(sql, params)
            return cursor.fetchone() if fetch else None

    def update(self, progress: int, total: int, phase: str):
        try:
            self._execute('''
                UPDATE scrape_jobs SET progress = ?, total = ?, phase = ?, businesses_found = ?
                WHERE id = ?
            ''', (progress, total, phase[:200], self._businesses_found, self.job_id))
        except Exception as e:
            log.warning(f"Reporter update failed: {e}")

    def is_cancelled(self) -> bool:
        try:
            row = self._execute('SELECT status FROM scrape_jobs WHERE id = ?', (self.job_id,), fetch=True)
            return bool(row and row[0] == 'cancelled')
        except Exception:
            return False

    def done(self, businesses_found: int):
        try:
            self._execute('''
                UPDATE scrape_jobs SET status = 'done', progress = ?, total = ?,
                businesses_found = ?, phase = ?, finished_at = ? WHERE id = ?
            ''', (businesses_found, businesses_found, businesses_found,
                  f'Completado: {businesses_found} negocios', datetime.now(timezone.utc).isoformat(), self.job_id))
        except Exception as e:
            log.warning(f"Reporter done failed: {e}")

    def error(self, msg: str):
        try:
            self._execute('''
                UPDATE scrape_jobs SET status = 'error', error_msg = ?, finished_at = ?
                WHERE id = ?
            ''', (msg[:500], datetime.now(timezone.utc).isoformat(), self.job_id))
        except Exception as e:
            log.warning(f"Reporter error failed: {e}")

    def save_business(self, biz: dict) -> bool:
        """Upsert a business to SQLite. Returns True if saved."""
        try:
            record = {
                'id': str(uuid.uuid4()),
                'job_id': self.job_id,
                **{k: v for k, v in biz.items() if v not in (None, '', [])},
            }
            # Extract city/province from address
            if record.get('address') and not record.get('city'):
                city, province = extract_city(record['address'])
                if city: record['city'] = city
                if province: record['province'] = province

            # Parse rating to float
            if 'rating' in record:
                record['rating'] = parse_rating(record['rating'])

            # Parse reviews_count to int
            if 'reviews_count' in record:
                record['reviews_count'] = parse_reviews(record['reviews_count'])

            record.setdefault('tags', '[]')
            record['updated_at'] = datetime.now(timezone.utc).isoformat()
            record['created_at'] = record['updated_at']
            columns = [
                'id', 'job_id', 'name', 'category', 'address', 'city', 'province', 'postal_code',
                'phone', 'website', 'email', 'rating', 'reviews_count', 'hours', 'price_range',
                'description', 'google_maps_url', 'plus_code', 'tags', 'created_at', 'updated_at',
            ]
            values = [record.get(column) for column in columns]
            placeholders = ', '.join('?' for _ in columns)
            updates = ', '.join(
                f"{column} = COALESCE(excluded.{column}, businesses.{column})"
                for column in columns if column not in ('id', 'name', 'address', 'created_at')
            )
            self._execute(f'''
                INSERT INTO businesses ({', '.join(columns)}) VALUES ({placeholders})
                ON CONFLICT(name, address) DO UPDATE SET {updates}
            ''', values)
            self._businesses_found += 1
            return True
        except Exception as e:
            log.warning(f"save_business failed: {e}")
            return False


# ─── Helpers ─────────────────────────────────────────────────────────────────

def extract_city(address: str) -> tuple[str, str]:
    """Best-effort city/province extraction from Spanish address."""
    if not address:
        return '', ''
    parts = [p.strip() for p in address.split(',')]
    city, province = '', ''

    # Typical Spanish format: Street, Number, PostalCode City, Province
    for part in reversed(parts):
        part = part.strip()
        # Skip if it looks like a street number or postal code
        if re.match(r'^\d{5}$', part):
            continue
        # PostalCode + City
        m = re.match(r'^\d{5}\s+(.+)$', part)
        if m:
            city = m.group(1).strip()
            continue
        if not city and not re.match(r'^\d', part) and len(part) > 3:
            city = part
        elif city and not province and not re.match(r'^\d', part):
            province = part
            break

    return city[:100], province[:100]


def parse_rating(rating_raw) -> float | None:
    if rating_raw is None:
        return None
    if isinstance(rating_raw, (int, float)):
        return float(rating_raw)
    s = str(rating_raw)
    # Extract number like "4,5" or "4.5 stars" or "Valoración de 4,5"
    m = re.search(r'(\d+)[,.](\d+)', s)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")
    m = re.search(r'(\d+)', s)
    if m:
        return float(m.group(1))
    return None


def parse_reviews(reviews_raw) -> int | None:
    if reviews_raw is None:
        return None
    if isinstance(reviews_raw, int):
        return reviews_raw
    s = str(reviews_raw).replace('.', '').replace(',', '').replace('(', '').replace(')', '')
    m = re.search(r'(\d+)', s)
    return int(m.group(1)) if m else None


# ─── Scraper core (adapted from scraper.py) ──────────────────────────────────

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
EMAIL_BLACKLIST = {"example.com", "sentry.io", "wixpress.com", "schema.org",
                   "googleapis.com", "cloudflare.com", "w3.org", "sentry-next.wixpress.com"}

def is_valid_email(e: str) -> bool:
    domain = e.split("@")[-1].lower()
    return not any(bl in domain for bl in EMAIL_BLACKLIST) and \
           not domain.endswith((".png", ".jpg", ".svg", ".gif", ".webp"))


def accept_consent(page: Page):
    try:
        btn = page.locator('button:has-text("Accept all"), button:has-text("Aceptar todo")').first
        if btn.is_visible(timeout=3000):
            btn.click()
            page.wait_for_timeout(1000)
    except Exception:
        pass


def extract_business(page: Page, url: str) -> dict:
    b: dict = {'google_maps_url': url}

    def safe_text(selector: str, timeout=4000) -> str:
        try:
            return page.locator(selector).first.inner_text(timeout=timeout).strip()
        except Exception:
            return ''

    def safe_attr(selector: str, attr: str, timeout=3000) -> str:
        try:
            return page.locator(selector).first.get_attribute(attr, timeout=timeout) or ''
        except Exception:
            return ''

    b['name']     = safe_text('h1.DUwDvf, h1[data-attrid="title"]')
    b['category'] = safe_text('button.DkEaL')
    b['address']  = safe_text('[data-item-id="address"] .Io6YTe, [data-tooltip="Copy address"] .Io6YTe')
    b['phone']    = safe_text('[data-item-id^="phone"] .Io6YTe, [data-tooltip="Copy phone number"] .Io6YTe')
    b['website']  = safe_text('[data-item-id="authority"] .Io6YTe, a[data-item-id="authority"]')
    b['hours']    = safe_text('[data-item-id*="oh"] .Io6YTe')
    b['plus_code']= safe_text('[data-item-id="oloc"] .Io6YTe')

    # Rating
    rating_lbl = safe_attr('span[aria-label*="star"], span[aria-label*="estrella"]', 'aria-label')
    if rating_lbl:
        b['rating'] = rating_lbl
    else:
        b['rating'] = safe_text('div.F7nice span[aria-hidden="true"]')

    # Reviews
    b['reviews_count'] = safe_text('span[aria-label*="reseña"], span[aria-label*="review"]')

    # Price
    try:
        b['price_range'] = page.locator('span.mgr77e span[aria-label]').first.get_attribute('aria-label', timeout=2000) or ''
    except Exception:
        pass

    b['description'] = safe_text('div.WeS02d .PYvSYb, div[jsaction*="editorial"] span', timeout=2000)

    return {k: v for k, v in b.items() if v}


def find_email(page: Page, website: str) -> str:
    try:
        url = website if website.startswith('http') else f'https://{website}'
        ctx = page.context
        new_page = ctx.new_page()
        try:
            new_page.goto(url, wait_until='domcontentloaded', timeout=12000)
            html = new_page.content()
            emails = [e for e in EMAIL_RE.findall(html) if is_valid_email(e)]
            if emails:
                return emails[0]
            for slug in ['/contact', '/contacto', '/contact-us']:
                try:
                    new_page.goto(url.rstrip('/') + slug, wait_until='domcontentloaded', timeout=8000)
                    emails2 = [e for e in EMAIL_RE.findall(new_page.content()) if is_valid_email(e)]
                    if emails2:
                        return emails2[0]
                except Exception:
                    continue
        finally:
            new_page.close()
    except Exception:
        pass
    return ''


def scroll_and_collect(page: Page, target: int, seen_urls: set, scroll_pause: float) -> list[str]:
    """Scroll the feed and collect place URLs."""
    try:
        page.wait_for_selector('div[role="article"]', timeout=10000)
    except Exception:
        return []

    stall = 0
    loaded = 0
    while stall < 5:
        n = len(page.query_selector_all('div[role="article"]'))
        if n >= target:
            break
        if n == loaded:
            stall += 1
        else:
            stall = 0
            loaded = n
        try:
            page.evaluate('document.querySelector(\'div[role="feed"]\').scrollBy(0, 2000)')
        except Exception:
            pass
        page.wait_for_timeout(int(scroll_pause * 1000))

    new_urls = []
    for el in page.query_selector_all('div[role="article"] a[href*="/maps/place/"]'):
        href = el.get_attribute('href') or ''
        if href and href not in seen_urls:
            seen_urls.add(href)
            new_urls.append(href)
    return new_urls


# ─── Main scrape orchestrator ─────────────────────────────────────────────────

def run_simple(page: Page, query: str, location: str, max_results: int,
               scroll_pause: float, reporter: JobReporter, seen_urls: set):
    search_term = f"{query} {location}".strip()
    url = 'https://www.google.com/maps/search/' + search_term.replace(' ', '+')
    reporter.update(0, max_results, f"Buscando: {search_term}")

    page.goto(url, wait_until='domcontentloaded', timeout=25000)
    accept_consent(page)
    page.wait_for_timeout(2000)

    urls = scroll_and_collect(page, max_results, seen_urls, scroll_pause)
    log.info(f"Simple mode: {len(urls)} URLs")
    return urls


def run_grid(page: Page, query: str, zone_name: str, cell_km: float,
             max_results: int, max_total: int, scroll_pause: float,
             reporter: JobReporter, seen_urls: set):
    from zone_mapper import resolve_zone, build_grid, get_cell_size_for_density

    bbox = resolve_zone(zone_name)
    if not bbox:
        log.warning(f"Zone '{zone_name}' not found, falling back to simple search")
        return run_simple(page, query, zone_name, max_results, scroll_pause, reporter, seen_urls)

    if cell_km <= 0:
        cell_km = get_cell_size_for_density(zone_name)

    cells = build_grid(*bbox, cell_km=cell_km)
    total_cells = len(cells)
    log.info(f"Grid: {total_cells} cells of {cell_km}km for '{zone_name}'")

    all_urls = []

    for i, cell in enumerate(cells, 1):
        if reporter.is_cancelled():
            log.info("Job cancelled by user")
            return all_urls

        reporter.update(i, total_cells,
                        f"[FASE 1] Celda {i}/{total_cells} · {cell.lat_center:.3f},{cell.lon_center:.3f} · {len(all_urls)} URLs")

        url = (f"https://www.google.com/maps/search/{query.replace(' ', '+')}/"
               f"@{cell.lat_center},{cell.lon_center},13z")
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=20000)
            try:
                page.wait_for_selector('div[role="article"]', timeout=8000)
            except Exception:
                continue
            page.wait_for_timeout(1000)

            new = scroll_and_collect(page, max_results, seen_urls, scroll_pause)
            all_urls.extend(new)
            log.info(f"  Cell {cell.label}: +{len(new)} URLs (total {len(all_urls)})")

            if len(all_urls) >= max_total * 2:
                break
        except Exception as e:
            log.warning(f"  Cell {cell.label} error: {e}")

    return all_urls


def extract_all(page: Page, urls: list[str], reporter: JobReporter,
                scroll_pause: float, max_total: int):
    seen_names: set = set()
    total = len(urls)

    for i, url in enumerate(urls[:max_total * 2], 1):
        if reporter._businesses_found >= max_total:
            break
        if reporter.is_cancelled():
            break

        reporter.update(i, total,
                        f"[FASE 2] Negocio {i}/{total} · guardados: {reporter._businesses_found}")

        try:
            page.goto(url, wait_until='domcontentloaded', timeout=20000)
            page.wait_for_timeout(1200)
            biz = extract_business(page, url)

            if not biz.get('name'):
                continue

            key = f"{biz['name'].lower()}|{biz.get('address', '').lower()}"
            if key in seen_names:
                continue
            seen_names.add(key)

            # Try to get email from website
            if biz.get('website') and not biz.get('email'):
                biz['email'] = find_email(page, biz['website'])

            reporter.save_business(biz)
            log.info(f"  ✓ [{reporter._businesses_found}] {biz['name']} | {biz.get('phone','')} | {biz.get('email','')}")

        except Exception as e:
            log.warning(f"  ✗ {url[:60]}: {e}")


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--job-id',       required=True)
    parser.add_argument('--db-path',      required=True)
    parser.add_argument('--query',        required=True)
    parser.add_argument('--mode',         default='simple')
    parser.add_argument('--location',     default='')
    parser.add_argument('--grid-zone',    default='')
    parser.add_argument('--cell-km',      type=float, default=0)
    parser.add_argument('--max',          type=int, default=50)
    parser.add_argument('--max-total',    type=int, default=1000)
    parser.add_argument('--scroll-pause', type=float, default=2.0)
    parser.add_argument('--headless',     action='store_true')
    args = parser.parse_args()

    ensure_database(args.db_path)
    reporter = JobReporter(args.db_path, args.job_id)

    log.info(f"Job {args.job_id}: query='{args.query}' mode={args.mode} headless={args.headless}")

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=args.headless,
                args=['--lang=es-ES,es', '--no-sandbox', '--disable-dev-shm-usage']
            )
            ctx = browser.new_context(
                locale='es-ES',
                viewport={'width': 1280, 'height': 900},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            )
            page = ctx.new_page()

            # Initial consent
            page.goto('https://www.google.com/maps', wait_until='domcontentloaded', timeout=20000)
            accept_consent(page)

            seen_urls: set = set()

            if args.mode == 'grid':
                urls = run_grid(page, args.query, args.grid_zone, args.cell_km,
                                args.max, args.max_total, args.scroll_pause, reporter, seen_urls)
            else:
                urls = run_simple(page, args.query, args.location, args.max,
                                  args.scroll_pause, reporter, seen_urls)

            if urls and not reporter.is_cancelled():
                extract_all(page, urls, reporter, args.scroll_pause, args.max_total)

            browser.close()

        reporter.done(reporter._businesses_found)
        log.info(f"Job {args.job_id} completed: {reporter._businesses_found} businesses")

    except Exception as e:
        log.error(f"Job {args.job_id} failed: {e}")
        reporter.error(str(e))
        sys.exit(1)


if __name__ == '__main__':
    main()
