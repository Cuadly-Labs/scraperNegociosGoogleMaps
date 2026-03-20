'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Loader2 } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error ?? 'No se pudo iniciar sesión')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.05) 0%, transparent 50%)'
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }} className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            marginBottom: 16
          }}>
            <MapPin size={22} color="white" />
          </div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>ScrapCRM</h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Lead Intelligence Platform</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 24, fontWeight: 600 }}>Iniciar sesión</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" required />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 13px', fontSize: '0.85rem', color: 'var(--red)' }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text2)', fontSize: '0.87rem' }}>
            ¿No tienes cuenta?{' '}
            <Link href="/register" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 500 }}>
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
