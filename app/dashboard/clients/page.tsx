'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Business, Followup } from '@/lib/types'
import { Phone, Mail, Globe, Plus, Check, Calendar, MessageSquare, Users, Star } from 'lucide-react'

const FOLLOWUP_TYPES = [
  { value: 'call', label: '📞 Llamada', color: '#10b981' },
  { value: 'email', label: '📧 Email', color: '#3b82f6' },
  { value: 'meeting', label: '🤝 Reunión', color: '#8b5cf6' },
  { value: 'whatsapp', label: '💬 WhatsApp', color: '#22c55e' },
  { value: 'note', label: '📝 Nota', color: '#f59e0b' },
]

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Business[]>([])
  const [selected, setSelected] = useState<Business | null>(null)
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [newFollowup, setNewFollowup] = useState({ type: 'call', content: '', outcome: '', scheduled_at: '' })

  useEffect(() => { loadClients() }, [])
  useEffect(() => { if (selected) loadFollowups(selected.id) }, [selected])

  async function loadClients() {
    const { data } = await supabase.from('businesses').select('*')
      .eq('status', 'client').order('updated_at', { ascending: false })
    setClients(data as Business[] || [])
    setLoading(false)
  }

  async function loadFollowups(businessId: string) {
    const { data } = await supabase.from('followups').select('*')
      .eq('business_id', businessId).order('created_at', { ascending: false })
    setFollowups(data as Followup[] || [])
  }

  async function addFollowup() {
    if (!selected || !newFollowup.content) return
    const { data } = await supabase.from('followups').insert({
      business_id: selected.id,
      ...newFollowup,
      scheduled_at: newFollowup.scheduled_at || null,
      completed_at: new Date().toISOString(),
    }).select().single()
    if (data) {
      setFollowups(f => [data as Followup, ...f])
      setNewFollowup({ type: 'call', content: '', outcome: '', scheduled_at: '' })
      setAddingFollowup(false)
      // Update last contact
      await supabase.from('businesses').update({ last_contact: new Date().toISOString() }).eq('id', selected.id)
    }
  }

  const typeConfig = (type: string) => FOLLOWUP_TYPES.find(t => t.value === type) || FOLLOWUP_TYPES[0]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spin" style={{ width: 28, height: 28, border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
    </div>
  )

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: 6 }}>Clientes</h1>
        <p style={{ color: 'var(--text2)' }}>{clients.length} clientes activos — seguimiento y gestión</p>
      </div>

      {!clients.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <Users size={48} style={{ color: 'var(--text3)', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Sin clientes aún</h3>
          <p style={{ color: 'var(--text2)', fontSize: '0.87rem', maxWidth: 320, margin: '0 auto' }}>
            Cuando marques un lead como "Cliente" en la Base de Leads, aparecerá aquí para su seguimiento.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Client list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clients.map(client => (
              <div key={client.id} onClick={() => setSelected(client)} className="card" style={{
                cursor: 'pointer', padding: '14px 16px',
                borderColor: selected?.id === client.id ? 'var(--accent)' : 'var(--border)',
                background: selected?.id === client.id ? 'rgba(99,102,241,0.08)' : 'var(--bg2)',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{client.name}</div>
                <div style={{ fontSize: '0.77rem', color: 'var(--text3)', marginBottom: 8 }}>
                  {client.city || client.address?.split(',')[0] || '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {client.phone && <Phone size={12} color="var(--green)" />}
                  {client.email && <Mail size={12} color="var(--blue)" />}
                  {client.website && <Globe size={12} color="var(--purple)" />}
                  {client.rating && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: '0.77rem', color: 'var(--amber)' }}>
                      <Star size={11} fill="var(--amber)" /> {client.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                {client.last_contact && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 6 }}>
                    Último contacto: {new Date(client.last_contact).toLocaleDateString('es-ES')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Client detail + followups */}
          {selected ? (
            <div>
              {/* Header */}
              <div className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', marginBottom: 6 }}>{selected.name}</h2>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {selected.phone && (
                        <a href={`tel:${selected.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6,
                          color: 'var(--green)', textDecoration: 'none', fontSize: '0.87rem' }}>
                          <Phone size={14} /> {selected.phone}
                        </a>
                      )}
                      {selected.email && (
                        <a href={`mailto:${selected.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6,
                          color: 'var(--blue)', textDecoration: 'none', fontSize: '0.87rem' }}>
                          <Mail size={14} /> {selected.email}
                        </a>
                      )}
                      {selected.website && (
                        <a href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                          target="_blank" rel="noopener"
                          style={{ display: 'flex', alignItems: 'center', gap: 6,
                            color: 'var(--purple)', textDecoration: 'none', fontSize: '0.87rem' }}>
                          <Globe size={14} /> {selected.website}
                        </a>
                      )}
                    </div>
                    {selected.notes && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg3)',
                        borderRadius: 8, fontSize: '0.83rem', color: 'var(--text2)', borderLeft: '3px solid var(--accent)' }}>
                        {selected.notes}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setAddingFollowup(true)}>
                    <Plus size={14} /> Añadir contacto
                  </button>
                </div>
              </div>

              {/* Add followup form */}
              {addingFollowup && (
                <div className="card" style={{ marginBottom: 16, padding: 20, borderColor: 'var(--accent)' }}>
                  <h4 style={{ marginBottom: 14, fontSize: '0.9rem' }}>Registrar contacto</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label>Tipo</label>
                      <select value={newFollowup.type} onChange={e => setNewFollowup(f => ({ ...f, type: e.target.value }))}>
                        {FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Fecha (opcional)</label>
                      <input type="datetime-local" value={newFollowup.scheduled_at}
                        onChange={e => setNewFollowup(f => ({ ...f, scheduled_at: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Descripción *</label>
                      <textarea value={newFollowup.content} rows={2}
                        onChange={e => setNewFollowup(f => ({ ...f, content: e.target.value }))}
                        placeholder="Qué ocurrió en este contacto..." />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label>Resultado</label>
                      <input value={newFollowup.outcome}
                        onChange={e => setNewFollowup(f => ({ ...f, outcome: e.target.value }))}
                        placeholder="Pendiente de respuesta, interesado en propuesta..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={addFollowup} disabled={!newFollowup.content}>
                      <Check size={14} /> Guardar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingFollowup(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={15} color="var(--accent)" /> Historial de contactos
                  <span style={{ marginLeft: 'auto', fontSize: '0.77rem', color: 'var(--text3)', fontWeight: 400 }}>
                    {followups.length} registros
                  </span>
                </h3>
                {!followups.length ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}>
                    <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontSize: '0.84rem' }}>Sin contactos registrados aún</p>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 1,
                      background: 'var(--border)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {followups.map(fu => {
                        const t = typeConfig(fu.type)
                        return (
                          <div key={fu.id} style={{ display: 'flex', gap: 14 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                              background: t.color + '22', border: `2px solid ${t.color}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.85rem', zIndex: 1
                            }}>
                              {t.label.split(' ')[0]}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: t.color }}>
                                  {t.label.split(' ').slice(1).join(' ')}
                                </span>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text3)' }}>
                                  {new Date(fu.created_at).toLocaleDateString('es-ES', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.84rem', color: 'var(--text)', marginBottom: 4,
                                padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
                                {fu.content}
                              </div>
                              {fu.outcome && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Check size={11} color="var(--green)" /> {fu.outcome}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 300, color: 'var(--text3)' }}>
              Selecciona un cliente para ver su historial
            </div>
          )}
        </div>
      )}
    </div>
  )
}
