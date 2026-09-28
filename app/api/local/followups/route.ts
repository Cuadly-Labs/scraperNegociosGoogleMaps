import { NextRequest, NextResponse } from 'next/server'
import { addFollowup, listFollowups } from '@/lib/local-db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId requerido' }, { status: 400 })
  return NextResponse.json({ data: listFollowups(businessId) })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  if (typeof body.businessId !== 'string' || typeof body.type !== 'string' || typeof body.content !== 'string' || !body.content.trim()) {
    return NextResponse.json({ error: 'businessId, type y content son obligatorios' }, { status: 400 })
  }

  const followup = addFollowup({
    businessId: body.businessId,
    type: body.type,
    content: body.content.trim(),
    outcome: typeof body.outcome === 'string' ? body.outcome : '',
    scheduledAt: typeof body.scheduledAt === 'string' ? body.scheduledAt || null : null,
  })
  return NextResponse.json({ data: followup }, { status: 201 })
}
