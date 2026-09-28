import { NextRequest, NextResponse } from 'next/server'
import { updateBusiness } from '@/lib/local-db'
import { BusinessStatus } from '@/lib/types'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const patch: { status?: BusinessStatus; notes?: string; last_contact?: string } = {}
  if (typeof body.status === 'string') patch.status = body.status as BusinessStatus
  if (typeof body.notes === 'string' || body.notes === null) patch.notes = body.notes as string
  if (typeof body.last_contact === 'string' || body.last_contact === null) patch.last_contact = body.last_contact as string

  const business = updateBusiness(params.id, patch)
  if (!business) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  return NextResponse.json({ data: business })
}
