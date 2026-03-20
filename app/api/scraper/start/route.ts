import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Pool de cuentas GitHub ────────────────────────────────────────────────────
// Añade hasta 3 tokens, uno por cuenta. Se rotan automáticamente
// para repartir el gasto de minutos entre cuentas.
// En .env.local pon:
//   GITHUB_TOKEN_1=github_pat_cuenta1...
//   GITHUB_TOKEN_2=github_pat_cuenta2...
//   GITHUB_TOKEN_3=github_pat_cuenta3...
//   GITHUB_REPO=tu-usuario/scrapcrm   ← repo donde está el workflow

function getNextToken(): { token: string; repo: string } | null {
  const tokens = [
    { token: process.env.GITHUB_TOKEN_1, repo: process.env.GITHUB_REPO_1 },
    { token: process.env.GITHUB_TOKEN_2, repo: process.env.GITHUB_REPO_2 },
    { token: process.env.GITHUB_TOKEN_3, repo: process.env.GITHUB_REPO_3 },
  ].filter(t => t.token && t.repo) as { token: string; repo: string }[]

  if (!tokens.length) return null

  // Round-robin: usa el índice del minuto actual para rotar
  const idx = Math.floor(Date.now() / 60000) % tokens.length
  return tokens[idx]
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { query, location, mode, gridZone, cellKm, maxResults, maxTotal, scrollPause } = body

  if (!query?.trim()) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const account = getNextToken()
  if (!account) {
    return NextResponse.json(
      { error: 'No GitHub tokens configured. Añade GITHUB_TOKEN_1 y GITHUB_REPO_1 a .env.local' },
      { status: 500 }
    )
  }

  // Crear job en Supabase
  const { data: job, error: jobError } = await supabase
    .from('scrape_jobs')
    .insert({
      user_id:     user.id,
      query:       query.trim(),
      zone:        mode === 'grid' ? gridZone : location,
      mode:        mode || 'simple',
      cell_km:     parseFloat(cellKm) || 0,
      max_results: parseInt(maxResults) || 50,
      max_total:   parseInt(maxTotal) || 1000,
      status:      'pending',
    })
    .select()
    .single()

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })

  // Disparar workflow en GitHub Actions
  const dispatchRes = await fetch(
    `https://api.github.com/repos/${account.repo}/actions/workflows/scraper.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization':        `Bearer ${account.token}`,
        'Accept':               'application/vnd.github+json',
        'Content-Type':         'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          job_id:       job.id,
          user_id:      user.id,
          query:        query.trim(),
          mode:         mode || 'simple',
          location:     location || '',
          grid_zone:    gridZone || '',
          cell_km:      String(cellKm || '0'),
          max_results:  String(maxResults || 50),
          max_total:    String(maxTotal || 1000),
          scroll_pause: String(scrollPause || 2.0),
        },
      }),
    }
  )

  if (!dispatchRes.ok) {
    const err = await dispatchRes.text()
    await supabase.from('scrape_jobs').update({
      status:      'error',
      error_msg:   `GitHub dispatch failed: ${err}`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return NextResponse.json({ error: `GitHub dispatch failed: ${err}` }, { status: 500 })
  }

  await supabase.from('scrape_jobs').update({
    status:     'running',
    started_at: new Date().toISOString(),
  }).eq('id', job.id)

  return NextResponse.json({ job })
}
