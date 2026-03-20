export type BusinessStatus =
  | 'not_contacted'
  | 'contacted'
  | 'no_response'
  | 'rejected'
  | 'interested'
  | 'client'

export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'

export interface Business {
  id: string
  user_id: string
  job_id?: string
  name: string
  category?: string
  address?: string
  city?: string
  province?: string
  postal_code?: string
  phone?: string
  website?: string
  email?: string
  rating?: number
  reviews_count?: number
  hours?: string
  price_range?: string
  description?: string
  google_maps_url?: string
  plus_code?: string
  status: BusinessStatus
  notes?: string
  tags: string[]
  assigned_to?: string
  last_contact?: string
  next_followup?: string
  created_at: string
  updated_at: string
}

export interface ScrapeJob {
  id: string
  user_id: string
  query: string
  zone?: string
  mode: 'simple' | 'grid'
  cell_km?: number
  max_results: number
  max_total?: number
  status: JobStatus
  progress: number
  total: number
  phase?: string
  businesses_found: number
  error_msg?: string
  started_at?: string
  finished_at?: string
  created_at: string
}

export interface Followup {
  id: string
  user_id: string
  business_id: string
  type: 'call' | 'email' | 'meeting' | 'note' | 'whatsapp'
  content?: string
  outcome?: string
  scheduled_at?: string
  completed_at?: string
  created_at: string
}

export const STATUS_CONFIG: Record<BusinessStatus, { label: string; color: string; bg: string }> = {
  not_contacted: { label: 'Sin contactar',  color: '#6b7280', bg: '#f3f4f6' },
  contacted:     { label: 'Contactado',     color: '#2563eb', bg: '#dbeafe' },
  no_response:   { label: 'Sin respuesta',  color: '#d97706', bg: '#fef3c7' },
  rejected:      { label: 'Rechazado',      color: '#dc2626', bg: '#fee2e2' },
  interested:    { label: 'Interesado',     color: '#7c3aed', bg: '#ede9fe' },
  client:        { label: 'Cliente',        color: '#059669', bg: '#d1fae5' },
}

export const PRESET_ZONES = [
  'comunidad de madrid', 'madrid ciudad', 'cataluña', 'barcelona ciudad',
  'barcelona provincia', 'andalucía', 'comunidad valenciana', 'país vasco',
  'galicia', 'castilla y león', 'aragón', 'murcia ciudad', 'sevilla ciudad',
  'valencia ciudad', 'bilbao', 'zaragoza ciudad', 'málaga ciudad',
]
