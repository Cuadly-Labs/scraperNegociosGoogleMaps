'use client'
import { useState, useEffect, useRef } from 'react'
import { PRESET_ZONES } from '@/lib/types'
import { Play, StopCircle } from 'lucide-react'

export default function ScraperPage() {
  const [mode, setMode] = useState<'simple' | 'grid'>('simple')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [gridZone, setGridZone] = useState('')
  const [cellKm, setCellKm] = useState('0')
  const [maxResults, setMaxResults] = useState('50')
  const [maxTotal, setMaxTotal] = useState('1000')
  const [scrollPause, setScrollPause] = useState('2.0')
  const [activeJob, setActiveJob] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const pollRef = useRef<NodeJS.Timeout>()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadActiveJob()
    loadRecentJobs()
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  async function loadRecentJobs() {
    const response = await fetch('/api/local/jobs')
    const payload = await response.json()
    setRecentJobs(payload.jobs || [])
  }

  async function loadActiveJob() {
    const response = await fetch('/api/local/jobs')
    const payload = await response.json()
    if (payload.activeJob) {
      setActiveJob(payload.activeJob)
      startPolling(payload.activeJob.id)
    }
  }

  function startPolling(jobId: string) {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollJob(jobId), 1500)
  }

  async function startScrape() {
    if (!query.trim()) return
    setLogs(['🚀 Iniciando scrape...'])

    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, mode, gridZone, cellKm, maxResults, maxTotal, scrollPause, headless: true })
      })
      const payload = await res.json()
      if (!res.ok || payload.error) {
        setLogs(l => [...l, `❌ ${payload.error || 'No se pudo iniciar el scraper'}`])
        return
      }
      setActiveJob(payload.job)
      startPolling(payload.job.id)
    } catch (error) {
      setLogs(l => [...l, `❌ No se pudo conectar con el servidor: ${error instanceof Error ? error.message : 'error desconocido'}`])
    }
  }

  async function pollJob(jobId: string) {
    const response = await fetch(`/api/local/jobs/${jobId}`)
    if (!response.ok) return
    const payload = await response.json()
    const data = payload.data
    if (!data) return
    setActiveJob(data)
    setLogs(l => {
      const msg = `[${data.progress}/${data.total}] ${data.phase}`
      if (l[l.length - 1] === msg) return l
      return [...l.slice(-80), msg]
    })
    if (['done', 'error', 'cancelled'].includes(data.status)) {
      clearInterval(pollRef.current)
      if (data.status === 'done') setLogs(l => [...l, `✅ Completado: ${data.businesses_found} negocios`])
      if (data.status === 'error') setLogs(l => [...l, `❌ Error: ${data.error_msg}`])
      loadRecentJobs()
    }
  }

  async function cancelJob() {
    if (!activeJob) return
    await fetch('/api/scraper/cancel', {
      method: 'POST',
      body: JSON.stringify({ jobId: activeJob.id })
    })
    clearInterval(pollRef.current)
    setActiveJob(null)
  }

  const running = Boolean(activeJob && ['pending', 'running'].includes(activeJob.status))
  const pct = activeJob?.total > 0 ? Math.round((activeJob.progress / activeJob.total) * 100) : 0

  const statusColor: Record<string, string> = {
    done: 'var(--green)', running: 'var(--amber)', error: 'var(--red)',
    pending: 'var(--text3)', cancelled: 'var(--text3)',
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 6 }}>Scraper</h1>
        <p style={{ color: 'var(--text2)' }}>Extrae negocios de Google Maps sin API</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Config */}
        <div className="card" style={{ padding: 24 }}>
          {running ? (
            <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg3)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, color: 'var(--text2)', fontSize: '0.9rem' }}>
                Hay un scrape en curso. Espera a que termine para lanzar otro.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" disabled>
                  <Play size={15} /> Iniciar Scraping
                </button>
                <button className="btn btn-danger" onClick={cancelJob}>
                  <StopCircle size={15} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg3)',
                borderRadius: 10, padding: 4 }}>
                {(['simple', 'grid'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'Syne', fontWeight: 600, fontSize: '0.84rem',
                    transition: 'all 0.15s',
                    background: mode === m ? 'var(--accent)' : 'transparent',
                    color: mode === m ? 'white' : 'var(--text2)',
                  }}>
                    {m === 'simple' ? '🎯 Zona simple' : '🗺 Cuadrícula por región'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Query */}
                <div style={{ gridColumn: '1/-1' }}>
                  <label>Qué buscar *</label>
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    placeholder='ej: "dentistas", "restaurantes italianos", "fontaneros"' />
                </div>

                {mode === 'simple' ? (<>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label>Zona / Ciudad</label>
                    <input value={location} onChange={e => setLocation(e.target.value)}
                      placeholder='ej: Madrid centro, Alcobendas, Getafe' />
                  </div>
                  <div>
                    <label>Máximo resultados</label>
                    <select value={maxResults} onChange={e => setMaxResults(e.target.value)}>
                      {['20','50','100','200'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </>) : (<>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label>Región predefinida</label>
                    <select value={gridZone} onChange={e => setGridZone(e.target.value)}>
                      <option value="">— Selecciona zona —</option>
                      {PRESET_ZONES.map(z => (
                        <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Tamaño de celda</label>
                    <select value={cellKm} onChange={e => setCellKm(e.target.value)}>
                      <option value="0">Auto (recomendado)</option>
                      <option value="4">4 km — ciudad densa</option>
                      <option value="8">8 km — área metropolitana</option>
                      <option value="12">12 km — provincia</option>
                      <option value="20">20 km — región grande</option>
                    </select>
                  </div>
                  <div>
                    <label>Máx resultados / celda</label>
                    <select value={maxResults} onChange={e => setMaxResults(e.target.value)}>
                      {['20','50','100'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Máximo total</label>
                    <select value={maxTotal} onChange={e => setMaxTotal(e.target.value)}>
                      {['500','1000','2000','5000'].map(v => (
                        <option key={v} value={v}>{parseInt(v).toLocaleString()}</option>
                      ))}
                    </select>
                  </div>
                </>)}

                <div>
                  <label>Pausa scroll</label>
                  <select value={scrollPause} onChange={e => setScrollPause(e.target.value)}>
                    <option value="1.5">1.5s rápido</option>
                    <option value="2.0">2.0s normal</option>
                    <option value="3.0">3.0s seguro</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={startScrape} disabled={!query.trim()}>
                  <Play size={15} /> Iniciar Scraping
                </button>
              </div>
            </>
          )}

          {/* Progress */}
          {activeJob && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6,
                fontSize: '0.82rem', color: 'var(--text2)' }}>
                <span>{activeJob.phase || 'Iniciando...'}</span>
                <span style={{ fontWeight: 600, color: running ? 'var(--amber)' : statusColor[activeJob.status] }}>
                  {running ? `${pct}%` : activeJob.status}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width 0.4s',
                  background: running
                    ? 'linear-gradient(90deg, var(--accent), var(--accent2))'
                    : activeJob.status === 'done' ? 'var(--green)' : 'var(--red)',
                  width: activeJob.status === 'done' ? '100%' : `${pct}%`
                }} />
              </div>
              {activeJob.businesses_found > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--green)', fontWeight: 500 }}>
                  ✓ {activeJob.businesses_found} negocios guardados
                </div>
              )}
            </div>
          )}

          {/* Log terminal */}
          {logs.length > 0 && (
            <div ref={logRef} style={{
              marginTop: 16, background: '#0a0a12', borderRadius: 8,
              padding: 14, maxHeight: 220, overflowY: 'auto',
              fontFamily: 'monospace', fontSize: '0.78rem', color: '#a0f0a0',
              lineHeight: 1.6, whiteSpace: 'pre-wrap',
              border: '1px solid var(--border)'
            }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>

        {/* Recent jobs sidebar */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Historial de scrapes</h3>
          {!recentJobs.length ? (
            <p style={{ color: 'var(--text3)', fontSize: '0.84rem' }}>Sin scrapes aún</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentJobs.map(job => (
                <div key={job.id} style={{
                  padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)',
                  borderLeft: `3px solid ${statusColor[job.status] || 'var(--border)'}`
                }}>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: 3 }}>{job.query}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {job.zone || job.location || 'libre'} · {job.mode}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: statusColor[job.status], fontWeight: 600 }}>
                      {job.status}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                      {job.businesses_found} leads
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
