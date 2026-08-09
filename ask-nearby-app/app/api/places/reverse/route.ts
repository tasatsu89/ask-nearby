import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat')
  const lng = req.nextUrl.searchParams.get('lng')
  if (!lat || !lng) return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2', addressdetails: '1' })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': 'NearByFamilyTest/1.0', 'Accept-Language': 'en-US,en;q=0.9' },
    next: { revalidate: 0 }
  })
  if (!res.ok) return NextResponse.json({ name: 'Current location', address: '' })
  const x = await res.json()
  return NextResponse.json({ name: x.name || x.display_name?.split(',')[0] || 'Current location', address: x.display_name || '', lat: Number(lat), lng: Number(lng) })
}
