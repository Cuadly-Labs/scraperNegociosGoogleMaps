import { NextRequest, NextResponse } from 'next/server'
import { listBusinesses, listCities } from '@/lib/local-db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  if (params.get('cities') === '1') {
    return NextResponse.json({ cities: listCities() })
  }

  const result = listBusinesses({
    search: params.get('search') || undefined,
    status: params.get('status') as never || '',
    city: params.get('city') || undefined,
    hasWeb: params.get('hasWeb') || undefined,
    hasEmail: params.get('hasEmail') || undefined,
    hasPhone: params.get('hasPhone') || undefined,
    minRating: params.get('minRating') || undefined,
    minReviews: params.get('minReviews') || undefined,
    price: params.get('price') || undefined,
    sortBy: params.get('sortBy') || undefined,
    sortAsc: params.get('sortAsc') === 'true',
    page: Number(params.get('page') || 0),
    pageSize: Number(params.get('pageSize') || 50),
  })

  return NextResponse.json(result)
}
