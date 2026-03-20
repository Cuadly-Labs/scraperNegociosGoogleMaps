import { createClient } from '@/lib/supabase/server'
import { Database, Users, Search, TrendingUp, Clock, Star } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    redirect('/login')
  }

  const [{ count: totalBiz }, { count: clients }, { count: contacted }, { data: recentJobs }, { data: topRated }] =
    await Promise.all([
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'client'),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('user_id', user.id).neq('status', 'not_contacted'),
      supabase.from('scrape_jobs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('businesses').select('name,rating,reviews_count,city,status').eq('user_id', user.id)
        .not('rating', 'is', null).order('rating', { ascending: false }).limit(5),
    ])

  const stats = [
    { label: 'Total Leads', value: totalBiz || 0, icon: Database, color: 'var(--accent)' },
    { label: 'Clientes', value: clients || 0, icon: Users, color: 'var(--green)' },
    { label: 'Contactados', value: contacted || 0, icon: TrendingUp, color: 'var(--amber)' },
    { label: 'Conversión', value: totalBiz ? `${Math.round(((clients || 0) / totalBiz) * 100)}%` : '0%', icon: Star, color: 'var(--purple)' },
  ]

  const statusColor: Record<string, string> = {
    done: 'var(--green)', running: 'var(--amber)', error: 'var(--red)',
    pending: 'var(--text3)', cancelled: 'var(--text3)',
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 6 }}>Panel de control</h1>
        <p style={{ color: 'var(--text2)' }}>Resumen de tu actividad de scraping y leads</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: -10, right: -10,
              width: 60, height: 60, borderRadius: '50%',
              background: color, opacity: 0.07
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text2)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 8, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: '2rem', fontFamily: 'Syne', fontWeight: 800, color }}>{value}</div>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={18} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Jobs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.95rem' }}>Scrapes recientes</h3>
            <Link href="/dashboard/scraper" className="btn btn-ghost btn-sm">Nuevo scrape</Link>
          </div>
          {!recentJobs?.length ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}>
              <Search size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>Aún no has hecho ningún scrape</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentJobs.map((job: any) => (
                <div key={job.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.87rem', fontWeight: 500, marginBottom: 2 }}>{job.query}</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text3)' }}>
                      {job.zone || 'zona libre'} · {job.businesses_found} encontrados
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', fontWeight: 600,
                    color: statusColor[job.status] || 'var(--text3)'
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                    {job.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top rated */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.95rem' }}>Mejor valorados</h3>
            <Link href="/dashboard/crm" className="btn btn-ghost btn-sm">Ver todos</Link>
          </div>
          {!topRated?.length ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}>
              <Star size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>No hay datos aún</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRated.map((biz: any) => (
                <div key={biz.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.87rem', fontWeight: 500, marginBottom: 2 }}>{biz.name}</div>
                    <div style={{ fontSize: '0.77rem', color: 'var(--text3)' }}>{biz.city || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={13} color="var(--amber)" fill="var(--amber)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{biz.rating?.toFixed(1)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>({biz.reviews_count})</span>
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
