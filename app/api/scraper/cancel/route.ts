import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await req.json()
  await supabase.from('scrape_jobs').update({
    status: 'cancelled',
    finished_at: new Date().toISOString(),
  }).eq('id', jobId).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
