import { NextResponse } from 'next/server'
import { getActiveJob, listJobs } from '@/lib/local-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ jobs: listJobs(10), activeJob: getActiveJob() })
}
