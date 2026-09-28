import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/local-db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { jobId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  if (!body.jobId) return NextResponse.json({ error: 'jobId requerido' }, { status: 400 })
  if (!getJob(body.jobId)) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })

  updateJob(body.jobId, {
    status: 'cancelled',
    finished_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
