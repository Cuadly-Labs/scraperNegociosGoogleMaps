import { NextResponse } from 'next/server'
import { getJob } from '@/lib/local-db'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const job = getJob(params.id)
  if (!job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
  return NextResponse.json({ data: job })
}
