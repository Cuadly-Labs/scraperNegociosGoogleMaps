import { spawn } from 'node:child_process'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createJob, getDatabasePath, getJob, updateJob } from '@/lib/local-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const mode = body.mode === 'grid' ? 'grid' : 'simple'
  const location = typeof body.location === 'string' ? body.location : ''
  const gridZone = typeof body.gridZone === 'string' ? body.gridZone : ''
  const cellKm = Number(body.cellKm || 0) || 0
  const maxResults = Number(body.maxResults || 50) || 50
  const maxTotal = Number(body.maxTotal || 1000) || 1000
  const scrollPause = Number(body.scrollPause || 2) || 2
  const job = createJob({
    query,
    zone: mode === 'grid' ? gridZone : location,
    mode,
    cellKm,
    maxResults,
    maxTotal,
  })

  const python = process.env.SCRAPER_PYTHON_BIN || 'python3'
  const script = path.join(process.cwd(), 'scraper', 'scraper_api.py')
  const args = [
    script,
    '--job-id', job.id,
    '--db-path', getDatabasePath(),
    '--query', query,
    '--mode', mode,
    '--location', location,
    '--grid-zone', gridZone,
    '--cell-km', String(cellKm),
    '--max', String(maxResults),
    '--max-total', String(maxTotal),
    '--scroll-pause', String(scrollPause),
    '--headless',
  ]

  // El modo `npm run dev:trace` usa NODE_OPTIONS para instrumentar Next.
  // No debe heredarse al Python/Playwright del scraper: su Node interno no es
  // el worker de Next y esos hooks pueden alterar el diagnóstico o el proceso.
  const scraperEnv = { ...process.env }
  delete scraperEnv.NODE_OPTIONS
  scraperEnv.PYTHONDONTWRITEBYTECODE = '1'

  let child
  try {
    child = spawn(python, args, {
      cwd: process.cwd(),
      env: scraperEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    updateJob(job.id, {
      status: 'error',
      error_msg: error instanceof Error ? error.message : 'No se pudo iniciar Python',
      finished_at: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'No se pudo iniciar el scraper local' }, { status: 500 })
  }

  child.stdout?.on('data', chunk => console.log(`[scraper ${job.id}] ${chunk.toString().trimEnd()}`))
  child.stderr?.on('data', chunk => console.error(`[scraper ${job.id}] ${chunk.toString().trimEnd()}`))
  child.on('error', error => {
    updateJob(job.id, {
      status: 'error',
      error_msg: error.message,
      finished_at: new Date().toISOString(),
    })
  })
  child.on('close', code => {
    if (code === 0) return
    const current = getJob(job.id)
    if (current?.status === 'pending' || current?.status === 'running') {
      updateJob(job.id, {
        status: 'error',
        error_msg: `El scraper terminó con código ${code ?? 'desconocido'}`,
        finished_at: new Date().toISOString(),
      })
    }
  })

  const runningJob = updateJob(job.id, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  return NextResponse.json({ job: runningJob })
}
