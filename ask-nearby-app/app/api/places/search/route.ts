import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const lat = req.nextUrl.searchParams.get('lat')
  const lng = req.nextUrl.searchParams.get('lng')
  if (!q) return NextResponse.json([])
  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '8', countrycodes: 'us' })
  if (lat && lng) params.set('viewbox', `${Number(lng)-0.35},${Number(lat)+0.35},${Number(lng)+0.35},${Number(lat)-0.35}`)
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'NearByFamilyTest/1.0', 'Accept-Language': 'en-US,en;q=0.9' },
    next: { revalidate: 0 }
  })
  if (!res.ok) return NextResponse.json([], { status: 200 })
  const data = await res.json()
  return NextResponse.json(data.map((x:any)=>({
    id: String(x.place_id),
    name: x.name || x.display_name.split(',')[0],
    address: x.display_name,
    lat: Number(x.lat),
    lng: Number(x.lon)
  })))
}
