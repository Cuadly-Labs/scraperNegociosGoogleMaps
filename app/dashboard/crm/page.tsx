'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Business, STATUS_CONFIG, BusinessStatus } from '@/lib/types'
import {
  Search, Filter, Download, ChevronDown, Star, Globe, Mail,
  Phone, MapPin, ExternalLink, Edit3, X, Check
} from 'lucide-react'

const STATUSES = Object.entries(STATUS_CONFIG) as [BusinessStatus, typeof STATUS_CONFIG[BusinessStatus]][]

export default function CRMPage() {
  const supabase = createClient()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Business | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | ''>('')
  const [cityFilter, setCityFilter] = useState('')
  const [hasWebFilter, setHasWebFilter] = useState<string>('')
  const [hasEmailFilter, setHasEmailFilter] = useState<string>('')
  const [hasPhoneFilter, setHasPhoneFilter] = useState<string>('')
  const [minRating, setMinRating] = useState('')
  const [minReviews, setMinReviews] = useState('')
  const [priceFilter, setPriceFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const [cities, setCities] = useState<string[]>([])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => { loadCities() }, [])
  useEffect(() => { setPage(0); loadBusinesses(0) }, [search, statusFilter, cityFilter, hasWebFilter, hasEmailFilter, hasPhoneFilter, minRating, minReviews, priceFilter, sortBy, sortAsc])
  useEffect(() => { loadBusinesses(page) }, [page])

  async function loadCities() {
    const { data } = await supabase.from('businesses').select('city').not('city', 'is', null)
    const unique = [...new Set((data || []).map((d: any) => d.city).filter(Boolean))].sort()
    setCities(unique as string[])
  }

  async function loadBusinesses(p = 0) {
    setLoading(true)
    let q = supabase.from('businesses').select('*', { count: 'exact' })

    if (search) q = q.or(`name.ilike.%${search}%,address.ilike.%${search}%,category.ilike.%${search}%`)
    if (statusFilter) q = q.eq('status', statusFilter)
    if (cityFilter) q = q.eq('city', cityFilter)
    if (hasWebFilter === 'yes') q = q.not('website', 'is', null).neq('website', '')
    if (hasWebFilter === 'no') q = q.or('website.is.null,website.eq.')
    if (hasEmailFilter === 'yes') q = q.not('email', 'is', null).neq('email', '')
    if (hasEmailFilter === 'no') q = q.or('email.is.null,email.eq.')
    if (hasPhoneFilter === 'yes') q = q.not('phone', 'is', null).neq('phone', '')
    if (hasPhoneFilter === 'no') q = q.or('phone.is.null,phone.eq.')
    if (minRating) q = q.gte('rating', parseFloat(minRating))
    if (minReviews) q = q.gte('reviews_count', parseInt(minReviews))
    if (priceFilter) q = q.eq('price_range', priceFilter)

    q = q.order(sortBy, { ascending: sortAsc }).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

    const { data, count } = await q
    setBusinesses(data as Business[] || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function updateStatus(id: string, status: BusinessStatus) {
    await supabase.from('businesses').update({ status }).eq('id', id)
    setBusinesses(bs => bs.map(b => b.id === id ? { ...b, status } : b))
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s)
  }

  async function saveNote(id: string) {
    await supabase.from('businesses').update({ notes: noteText }).eq('id', id)
    setBusinesses(bs => bs.map(b => b.id === id ? { ...b, notes: noteText } : b))
    if (selected?.id === id) setSelected(s => s ? { ...s, notes: noteText } : s)
    setEditingNote(null)
  }

  async function exportCSV() {
    let q = supabase.from('businesses').select('*')
    if (statusFilter) q = q.eq('status', statusFilter)
    const { data } = await q
    if (!data?.length) return
    const headers = ['Nombre','Categoría','Dirección','Ciudad','Teléfono','Web','Email',
      'Valoración','Reseñas','Estado','Notas','URL Maps']
    const rows = data.map(b => [
      b.name, b.category, b.address, b.city, b.phone, b.website, b.email,
      b.rating, b.reviews_count, b.status, b.notes, b.google_maps_url
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `leads_${Date.now()}.csv`
    a.click()
  }

  const FilterSelect = ({ label, value, onChange, options }: any) => (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ paddingRight: 28, fontSize: '0.82rem', padding: '7px 28px 7px 10px' }}>
        <option value="">{label}</option>
        {options.map(([v, l]: [string, string]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
    </div>
  )

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: 'calc(100vh - 64px)' }}>
      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', marginBottom: 4 }}>Base de Leads</h1>
              <p style={{ color: 'var(--text2)', fontSize: '0.87rem' }}>
                {total.toLocaleString()} negocios encontrados
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {/* Filters row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nombre, dirección..." style={{ paddingLeft: 32, fontSize: '0.85rem' }} />
            </div>

            <FilterSelect label="Estado" value={statusFilter} onChange={setStatusFilter}
              options={STATUSES.map(([k, v]) => [k, v.label])} />

            <FilterSelect label="Ciudad" value={cityFilter} onChange={setCityFilter}
              options={cities.map(c => [c, c])} />

            <FilterSelect label="Web" value={hasWebFilter} onChange={setHasWebFilter}
              options={[['yes','Con web'],['no','Sin web']]} />

            <FilterSelect label="Email" value={hasEmailFilter} onChange={setHasEmailFilter}
              options={[['yes','Con email'],['no','Sin email']]} />

            <FilterSelect label="Teléfono" value={hasPhoneFilter} onChange={setHasPhoneFilter}
              options={[['yes','Con teléfono'],['no','Sin teléfono']]} />

            <FilterSelect label="Rating mín" value={minRating} onChange={setMinRating}
              options={[['3','≥ 3★'],['4','≥ 4★'],['4.5','≥ 4.5★']]} />

            <FilterSelect label="Reseñas mín" value={minReviews} onChange={setMinReviews}
              options={[['10','≥ 10'],['50','≥ 50'],['100','≥ 100'],['500','≥ 500']]} />

            <FilterSelect label="Ordenar" value={sortBy} onChange={setSortBy}
              options={[['created_at','Fecha'],['rating','Rating'],['reviews_count','Reseñas'],['name','Nombre']]} />
          </div>

          {/* Status quick filters */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setStatusFilter('')} style={{
              padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)',
              background: !statusFilter ? 'var(--accent)' : 'transparent',
              color: !statusFilter ? 'white' : 'var(--text2)',
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 600
            }}>Todos ({total})</button>
            {STATUSES.map(([k, v]) => (
              <button key={k} onClick={() => setStatusFilter(k)} style={{
                padding: '4px 10px', borderRadius: 99,
                border: `1px solid ${statusFilter === k ? v.color : 'var(--border)'}`,
                background: statusFilter === k ? v.bg + '33' : 'transparent',
                color: statusFilter === k ? v.color : 'var(--text2)',
                fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Syne', fontWeight: 600
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div className="spin" style={{ width: 24, height: 24, border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
            </div>
          ) : (
            <table>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 2 }}>
                <tr>
                  <th>Negocio</th>
                  <th>Contacto</th>
                  <th style={{ textAlign: 'center' }}>Rating</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map(biz => (
                  <tr key={biz.id} onClick={() => setSelected(biz)}
                    style={{ cursor: 'pointer', background: selected?.id === biz.id ? 'rgba(99,102,241,0.08)' : '' }}>
                    <td>
                      <div style={{ fontWeight: 500, marginBottom: 2, fontSize: '0.88rem' }}>{biz.name}</div>
                      {biz.category && <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{biz.category}</div>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {biz.phone && <span title={biz.phone} style={{ color: 'var(--green)' }}><Phone size={13} /></span>}
                        {biz.email && <span title={biz.email} style={{ color: 'var(--blue)' }}><Mail size={13} /></span>}
                        {biz.website && <span title={biz.website} style={{ color: 'var(--purple)' }}><Globe size={13} /></span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {biz.rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                          <Star size={12} color="var(--amber)" fill="var(--amber)" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{biz.rating.toFixed(1)}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>({biz.reviews_count})</span>
                        </div>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>{biz.city || '—'}</td>
                    <td>
                      <select value={biz.status} onChange={e => { e.stopPropagation(); updateStatus(biz.id, e.target.value as BusinessStatus) }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          padding: '4px 8px', fontSize: '0.78rem', width: 'auto',
                          background: STATUS_CONFIG[biz.status].bg + '33',
                          color: STATUS_CONFIG[biz.status].color,
                          border: `1px solid ${STATUS_CONFIG[biz.status].color}44`,
                          borderRadius: 99, fontWeight: 600
                        }}>
                        {STATUSES.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>←</button>
            <span style={{ padding: '6px 12px', fontSize: '0.84rem', color: 'var(--text2)' }}>
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>→</button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="card" style={{
          width: 320, flexShrink: 0, padding: 20, overflowY: 'auto',
          maxHeight: 'calc(100vh - 64px)', position: 'sticky', top: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', lineHeight: 1.3 }}>{selected.name}</h3>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2
            }}><X size={16} /></button>
          </div>

          {selected.category && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 12 }}>{selected.category}</div>
          )}

          {/* Status selector */}
          <div style={{ marginBottom: 16 }}>
            <label>Estado CRM</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {STATUSES.map(([k, v]) => (
                <button key={k} onClick={() => updateStatus(selected.id, k)} style={{
                  padding: '4px 9px', borderRadius: 99, fontSize: '0.75rem', cursor: 'pointer',
                  fontWeight: 600, border: `1px solid ${selected.status === k ? v.color : 'var(--border)'}`,
                  background: selected.status === k ? v.bg + '44' : 'transparent',
                  color: selected.status === k ? v.color : 'var(--text3)',
                }}>{v.label}</button>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {selected.phone && (
              <a href={`tel:${selected.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--text)', textDecoration: 'none', fontSize: '0.85rem' }}>
                <Phone size={14} color="var(--green)" /> {selected.phone}
              </a>
            )}
            {selected.email && (
              <a href={`mailto:${selected.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--text)', textDecoration: 'none', fontSize: '0.85rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Mail size={14} color="var(--blue)" /> {selected.email}
              </a>
            )}
            {selected.website && (
              <a href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 8,
                  color: 'var(--text)', textDecoration: 'none', fontSize: '0.85rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Globe size={14} color="var(--purple)" /> {selected.website}
              </a>
            )}
            {selected.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.82rem', color: 'var(--text2)' }}>
                <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {selected.address}
              </div>
            )}
            {selected.google_maps_url && (
              <a href={selected.google_maps_url} target="_blank" rel="noopener"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem',
                  color: 'var(--accent2)', textDecoration: 'none' }}>
                <ExternalLink size={13} /> Ver en Google Maps
              </a>
            )}
          </div>

          {/* Rating */}
          {selected.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
              padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8 }}>
              <Star size={14} color="var(--amber)" fill="var(--amber)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selected.rating.toFixed(1)}</span>
              <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>({selected.reviews_count} reseñas)</span>
              {selected.price_range && <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '0.82rem', fontWeight: 600 }}>{selected.price_range}</span>}
            </div>
          )}

          {/* Hours */}
          {selected.hours && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 16 }}>
              🕐 {selected.hours}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ margin: 0 }}>Notas</label>
              {editingNote !== selected.id ? (
                <button onClick={() => { setEditingNote(selected.id); setNoteText(selected.notes || '') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                  <Edit3 size={13} />
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => saveNote(selected.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)' }}><Check size={13} /></button>
                  <button onClick={() => setEditingNote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={13} /></button>
                </div>
              )}
            </div>
            {editingNote === selected.id ? (
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                rows={4} style={{ resize: 'vertical', fontSize: '0.83rem' }}
                placeholder="Añade notas sobre este lead..." />
            ) : (
              <div style={{
                minHeight: 60, padding: '8px 10px', borderRadius: 8, background: 'var(--bg3)',
                fontSize: '0.83rem', color: selected.notes ? 'var(--text)' : 'var(--text3)',
                lineHeight: 1.5
              }}>
                {selected.notes || 'Sin notas. Haz clic en ✏ para añadir.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
