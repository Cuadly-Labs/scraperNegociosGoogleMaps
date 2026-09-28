'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Search, Database, Users, MapPin } from 'lucide-react'

const NAV = [
  { href: '/dashboard',         label: 'Inicio',       icon: LayoutDashboard },
  { href: '/dashboard/scraper', label: 'Scraper',      icon: Search },
  { href: '/dashboard/crm',     label: 'Base de Leads', icon: Database },
  { href: '/dashboard/clients', label: 'Clientes',     icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="sidebar">
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

      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '10px', borderRadius: 8, background: 'var(--bg3)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
            Entorno local
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text3)' }}>
            Sin autenticación
          </div>
        </div>
      </div>
    </div>
  )
}
