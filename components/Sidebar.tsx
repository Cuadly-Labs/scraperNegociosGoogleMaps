'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Search, Database, Users, LogOut, MapPin, Settings
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',         label: 'Inicio',     icon: LayoutDashboard },
  { href: '/dashboard/scraper', label: 'Scraper',    icon: Search },
  { href: '/dashboard/crm',     label: 'Base de Leads', icon: Database },
  { href: '/dashboard/clients', label: 'Clientes',   icon: Users },
]

export default function Sidebar({ user, profile }: { user: any, profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <MapPin size={16} color="white" />
          </div>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
            ScrapCRM
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none', fontSize: '0.87rem', fontWeight: 500,
              transition: 'all 0.15s',
              background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: active ? 'var(--accent2)' : 'var(--text2)',
              borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          padding: '10px', borderRadius: 8, marginBottom: 8,
          background: 'var(--bg3)'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)', marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.full_name || user.email?.split('@')[0]}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text3)' }}>
            {profile?.scrapes_used || 0} / {profile?.scrapes_limit || 500} scrapes
          </div>
          <div style={{
            marginTop: 6, height: 3, borderRadius: 99, background: 'var(--border)',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
              width: `${Math.min(100, ((profile?.scrapes_used || 0) / (profile?.scrapes_limit || 500)) * 100)}%`,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
        <button onClick={signOut} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--text3)', fontSize: '0.84rem',
          transition: 'all 0.15s'
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--red)'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
