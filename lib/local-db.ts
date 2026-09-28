import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { Business, BusinessStatus, Followup, ScrapeJob } from '@/lib/types'

// La base vive fuera del workspace para que Next.js no la vigile y no reinicie
// el servidor cada vez que el scraper actualiza progreso o guarda un lead.
const DEFAULT_DB_PATH = path.join(os.homedir(), '.scrapcrm', 'scrapcrm.sqlite')
const dbPath = path.resolve(process.env.LOCAL_DB_PATH || DEFAULT_DB_PATH)

type SqlParams = unknown[] | Record<string, unknown>

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(toJsonSafe)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]))
  }
  return value
}

function runSqlite(action: 'exec' | 'run' | 'get' | 'all', sql: string, params: SqlParams = []) {
  const runner = path.join(process.cwd(), 'scraper', 'local_db_runner.py')
  const python = process.env.SCRAPER_PYTHON_BIN || 'python3'
  const payload = JSON.stringify(toJsonSafe({ dbPath, action, sql, params }))
  const output = execFileSync(python, [runner], {
    cwd: process.cwd(),
    input: payload,
    encoding: 'utf8',
    timeout: 35000,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  const result = JSON.parse(output) as { ok: boolean; value?: unknown; error?: string }
  if (!result.ok) throw new Error(result.error || 'SQLite error')
  return result.value
}

class LocalStatement {
  constructor(private readonly sql: string) {}

  private params(values: unknown[]): SqlParams {
    return values.length === 1 && values[0] && typeof values[0] === 'object' && !Array.isArray(values[0])
      ? values[0] as Record<string, unknown>
      : values
  }

  run(...values: unknown[]) {
    return runSqlite('run', this.sql, this.params(values))
  }

  get(...values: unknown[]) {
    return runSqlite('get', this.sql, this.params(values))
  }

  all(...values: unknown[]) {
    return runSqlite('all', this.sql, this.params(values))
  }
}

class LocalDatabase {
  exec(sql: string) {
    return runSqlite('exec', sql)
  }

  prepare(sql: string) {
    return new LocalStatement(sql)
  }
}

let db: LocalDatabase | null = null

function getDb(): LocalDatabase {
  if (db) return db

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new LocalDatabase()
  db.exec('PRAGMA busy_timeout = 30000; PRAGMA foreign_keys = ON;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      zone TEXT,
      mode TEXT NOT NULL DEFAULT 'simple',
      cell_km REAL DEFAULT 8,
      max_results INTEGER DEFAULT 50,
      max_total INTEGER DEFAULT 1000,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      phase TEXT DEFAULT '',
      businesses_found INTEGER DEFAULT 0,
      error_msg TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      job_id TEXT REFERENCES scrape_jobs(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      postal_code TEXT,
      phone TEXT,
      website TEXT,
      email TEXT,
      rating REAL,
      reviews_count INTEGER,
      hours TEXT,
      price_range TEXT,
      description TEXT,
      google_maps_url TEXT,
      plus_code TEXT,
      status TEXT NOT NULL DEFAULT 'not_contacted',
      notes TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      assigned_to TEXT,
      last_contact TEXT,
      next_followup TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(name, address)
    );

    CREATE TABLE IF NOT EXISTS followups (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT,
      outcome TEXT,
      scheduled_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS businesses_status_idx ON businesses(status);
    CREATE INDEX IF NOT EXISTS businesses_city_idx ON businesses(city);
    CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON scrape_jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS followups_business_idx ON followups(business_id, created_at DESC);
  `)

  return db
}

const now = () => new Date().toISOString()
const newId = () => randomUUID()

function toBusiness(row: Record<string, unknown>): Business {
  let tags: string[] = []
  try {
    tags = JSON.parse(String(row.tags || '[]'))
  } catch {
    tags = []
  }
  return { ...row, tags } as Business
}

function toJob(row: Record<string, unknown>): ScrapeJob {
  return row as unknown as ScrapeJob
}

function toFollowup(row: Record<string, unknown>): Followup {
  return row as unknown as Followup
}

export function getDatabasePath() {
  return dbPath
}

export function createJob(input: {
  query: string
  zone?: string
  mode: 'simple' | 'grid'
  cellKm: number
  maxResults: number
  maxTotal: number
}) {
  const job: ScrapeJob = {
    id: newId(),
    query: input.query,
    zone: input.zone || undefined,
    mode: input.mode,
    cell_km: input.cellKm,
    max_results: input.maxResults,
    max_total: input.maxTotal,
    status: 'pending',
    progress: 0,
    total: 0,
    phase: '',
    businesses_found: 0,
    created_at: now(),
  }

  getDb().prepare(`
    INSERT INTO scrape_jobs
      (id, query, zone, mode, cell_km, max_results, max_total, status, progress, total,
       phase, businesses_found, created_at)
    VALUES (@id, @query, @zone, @mode, @cell_km, @max_results, @max_total, @status, @progress,
            @total, @phase, @businesses_found, @created_at)
  `).run(job)
  return job
}

export function updateJob(id: string, patch: Partial<ScrapeJob>) {
  const allowed = [
    'status', 'progress', 'total', 'phase', 'businesses_found', 'error_msg',
    'started_at', 'finished_at',
  ] as const
  const entries = allowed
    .filter(key => patch[key] !== undefined)
    .map(key => [key, patch[key]] as const)
  if (!entries.length) return getJob(id)

  const values: Record<string, unknown> = { id }
  const setters = entries.map(([key, value]) => {
    values[key] = value
    return `${key} = @${key}`
  })
  getDb().prepare(`UPDATE scrape_jobs SET ${setters.join(', ')} WHERE id = @id`).run(values)
  return getJob(id)
}

export function getJob(id: string) {
  const row = getDb().prepare('SELECT * FROM scrape_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? toJob(row) : null
}

export function listJobs(limit = 10) {
  const rows = getDb().prepare('SELECT * FROM scrape_jobs ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]
  return rows.map(toJob)
}

export function getActiveJob() {
  const row = getDb().prepare(`
    SELECT * FROM scrape_jobs
    WHERE status IN ('pending', 'running')
    ORDER BY created_at DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined
  return row ? toJob(row) : null
}

export type BusinessFilters = {
  search?: string
  status?: BusinessStatus | ''
  city?: string
  hasWeb?: string
  hasEmail?: string
  hasPhone?: string
  minRating?: string
  minReviews?: string
  price?: string
  sortBy?: string
  sortAsc?: boolean
  page?: number
  pageSize?: number
}

export function listBusinesses(filters: BusinessFilters = {}) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.search) {
    conditions.push('(name LIKE ? OR address LIKE ? OR category LIKE ?)')
    const search = `%${filters.search}%`
    params.push(search, search, search)
  }
  if (filters.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters.city) {
    conditions.push('city = ?')
    params.push(filters.city)
  }
  if (filters.hasWeb === 'yes') conditions.push("website IS NOT NULL AND website <> ''")
  if (filters.hasWeb === 'no') conditions.push("(website IS NULL OR website = '')")
  if (filters.hasEmail === 'yes') conditions.push("email IS NOT NULL AND email <> ''")
  if (filters.hasEmail === 'no') conditions.push("(email IS NULL OR email = '')")
  if (filters.hasPhone === 'yes') conditions.push("phone IS NOT NULL AND phone <> ''")
  if (filters.hasPhone === 'no') conditions.push("(phone IS NULL OR phone = '')")
  if (filters.minRating) {
    conditions.push('rating >= ?')
    params.push(Number(filters.minRating))
  }
  if (filters.minReviews) {
    conditions.push('reviews_count >= ?')
    params.push(Number(filters.minReviews))
  }
  if (filters.price) {
    conditions.push('price_range = ?')
    params.push(filters.price)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const sortColumns: Record<string, string> = {
    created_at: 'created_at', rating: 'rating', reviews_count: 'reviews_count', name: 'name',
  }
  const sort = sortColumns[filters.sortBy || 'created_at'] || 'created_at'
  const direction = filters.sortAsc ? 'ASC' : 'DESC'
  const countRow = getDb().prepare(`SELECT COUNT(*) AS count FROM businesses ${where}`).get(...params) as { count: number }
  const page = Math.max(0, filters.page || 0)
  const pageSize = Math.min(1000, Math.max(1, filters.pageSize || 50))
  const rows = getDb().prepare(`
    SELECT * FROM businesses ${where}
    ORDER BY ${sort} ${direction}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, page * pageSize) as Record<string, unknown>[]

  return { data: rows.map(toBusiness), total: countRow.count }
}

export function listCities() {
  const rows = getDb().prepare("SELECT DISTINCT city FROM businesses WHERE city IS NOT NULL AND city <> '' ORDER BY city").all() as { city: string }[]
  return rows.map(row => row.city)
}

export function updateBusiness(id: string, patch: Partial<Pick<Business, 'status' | 'notes' | 'last_contact'>>) {
  const values: Record<string, unknown> = { id, updated_at: now() }
  const setters = ['updated_at = @updated_at']
  for (const key of ['status', 'notes', 'last_contact'] as const) {
    if (patch[key] !== undefined) {
      values[key] = patch[key]
      setters.push(`${key} = @${key}`)
    }
  }
  getDb().prepare(`UPDATE businesses SET ${setters.join(', ')} WHERE id = @id`).run(values)
  const row = getDb().prepare('SELECT * FROM businesses WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? toBusiness(row) : null
}

export function listFollowups(businessId: string) {
  const rows = getDb().prepare(`
    SELECT * FROM followups WHERE business_id = ? ORDER BY created_at DESC
  `).all(businessId) as Record<string, unknown>[]
  return rows.map(toFollowup)
}

export function addFollowup(input: {
  businessId: string
  type: string
  content: string
  outcome?: string
  scheduledAt?: string | null
}) {
  const followup: Followup = {
    id: newId(),
    business_id: input.businessId,
    type: input.type as Followup['type'],
    content: input.content,
    outcome: input.outcome || undefined,
    scheduled_at: input.scheduledAt || undefined,
    completed_at: now(),
    created_at: now(),
  }
  const database = getDb()
  database.prepare(`
    INSERT INTO followups (id, business_id, type, content, outcome, scheduled_at, completed_at, created_at)
    VALUES (@id, @business_id, @type, @content, @outcome, @scheduled_at, @completed_at, @created_at)
  `).run(followup)
  database.prepare('UPDATE businesses SET last_contact = ?, updated_at = ? WHERE id = ?')
    .run(followup.completed_at, now(), input.businessId)
  return followup
}

export function getDashboardData() {
  const database = getDb()
  const total = (database.prepare('SELECT COUNT(*) AS count FROM businesses').get() as { count: number }).count
  const clients = (database.prepare("SELECT COUNT(*) AS count FROM businesses WHERE status = 'client'").get() as { count: number }).count
  const contacted = (database.prepare("SELECT COUNT(*) AS count FROM businesses WHERE status <> 'not_contacted'").get() as { count: number }).count
  const recentJobs = listJobs(5)
  const topRated = (database.prepare(`
    SELECT name, rating, reviews_count, city, status FROM businesses
    WHERE rating IS NOT NULL ORDER BY rating DESC LIMIT 5
  `).all() as Record<string, unknown>[]).map(row => ({ ...row, rating: Number(row.rating) }))
  return { total, clients, contacted, recentJobs, topRated }
}
