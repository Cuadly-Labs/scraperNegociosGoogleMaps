'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Loader2, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)'
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }} className="fade-up">
        <CheckCircle size={48} color="var(--green)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 10 }}>¡Cuenta creada!</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
          Revisa tu email para confirmar la cuenta. Después podrás iniciar sesión.
        </p>
        <Link href="/login" className="btn btn-primary">Ir al login</Link>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)'
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
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Empieza gratis — 500 negocios incluidos</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 24, fontWeight: 600 }}>Crear cuenta</h2>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label>Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" minLength={6} required />
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
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text2)', fontSize: '0.87rem' }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 500 }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
